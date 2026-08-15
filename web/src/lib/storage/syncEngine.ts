import { db } from './db';
import { createBrowserClientHelper } from '@/lib/supabase/client';
import { pendingPush, toIso } from './syncFields';
import { emitSyncChange } from './syncEvents';
import {
  historyToRemoteResume,
  historyToRemoteLetter,
  remoteResumeToHistory,
  remoteLetterToHistory,
  applicationToRemoteRow,
  remoteRowToApplication,
  jobToRemoteSavedJob,
  remoteSavedJobToJob,
  profileToRemoteSetting,
  remoteSettingToProfile,
  jobProfileToRemoteSetting,
  remoteSettingToJobProfile,
  type RemoteUserSettingRow,
} from './syncMapping';

let isSyncing = false;

/**
 * Filtre les lignes dont une version distante plus récente existe déjà, pour
 * éviter qu'un push aveugle (upsert inconditionnel) écrase le travail d'un
 * autre appareil fait pendant qu'on était hors-ligne. Les lignes écartées ne
 * sont pas marquées `synced_at` : le `pullAll()` qui suit dans `syncAll()`
 * rapatriera la version distante gagnante.
 */
export async function filterOutStalePush<T extends { id: string; client_updated_at: string }>(
  supabase: NonNullable<ReturnType<typeof createBrowserClientHelper>>,
  table: 'resumes' | 'letters' | 'applications' | 'saved_jobs' | 'user_settings',
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const { data: remoteRows } = await supabase.from(table).select('id, client_updated_at').in('id', ids);
  const remoteMap = new Map((remoteRows ?? []).map((r: { id: string; client_updated_at: string }) => [r.id, r.client_updated_at]));
  return rows.filter((r) => {
    const remoteTime = remoteMap.get(r.id);
    if (!remoteTime) return true; // pas encore de ligne distante
    return new Date(r.client_updated_at).getTime() >= new Date(remoteTime).getTime();
  });
}

export function resolveConflict(
  local: { updated_at?: string; updatedAt?: number },
  remote: { client_updated_at: string },
): 'local' | 'remote' {
  const localTimeStr = local.updated_at
    ? local.updated_at
    : local.updatedAt
    ? toIso(local.updatedAt)
    : '1970-01-01T00:00:00.000Z';
  const localMs = new Date(localTimeStr).getTime();
  const remoteMs = new Date(remote.client_updated_at).getTime();

  return localMs >= remoteMs ? 'local' : 'remote';
}

/**
 * Le schéma distant `resumes`/`letters` ne stocke que titre + contenu : les
 * champs propres à `HistoryEntry` (rattachement à une candidature, notes,
 * template PDF choisi…) n'y transitent jamais. Un `put()` intégral du mapping
 * distant les effacerait à chaque pull gagnant — on ne remplace donc que les
 * champs réellement synchronisés, en conservant le reste de l'entrée locale.
 */
export function mergeRemoteHistory(
  local: import('./db').HistoryEntry | undefined,
  mapped: import('./db').HistoryEntry,
): import('./db').HistoryEntry {
  if (!local) return mapped;
  return {
    ...mapped,
    applicationId: local.applicationId,
    label: local.label,
    notes: local.notes,
    job_desc: local.job_desc,
    pdf_views: local.pdf_views,
    editor_reloads: local.editor_reloads,
    last_viewed_at: local.last_viewed_at,
    templateId: local.templateId,
  };
}

export function sanitizeImportedItem<T extends Record<string, unknown>>(item: T): T {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const result: Record<string, unknown> = {
    ...item,
    synced_at: null,
  };

  if ('updated_at' in item || !('updatedAt' in item)) {
    result.updated_at = nowIso;
  }
  if ('updatedAt' in item) {
    result.updatedAt = nowMs;
  }

  if ('deleted_at' in item) {
    result.deleted_at = item.deleted_at;
  }

  return result as T;
}

export async function purgeLocalData(): Promise<void> {
  try {
    await db.transaction('rw', [db.history, db.jobs, db.applications, db.snapshots, db.drafts, db.profile, db.jobProfile], async () => {
      await db.history.clear();
      await db.jobs.clear();
      await db.applications.clear();
      await db.snapshots.clear();
      await db.drafts.clear();
      await db.profile.clear();
      await db.jobProfile.clear();
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sync_user_id');
      localStorage.removeItem('sync_cursor_resumes');
      localStorage.removeItem('sync_cursor_letters');
      localStorage.removeItem('sync_cursor_applications');
      localStorage.removeItem('sync_cursor_saved_jobs');
      localStorage.removeItem('sync_cursor_user_settings');
    }
  } catch (e) {
    console.warn('purgeLocalData error:', e);
  }
}

export async function ensureMatchingUser(currentUserId: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  const storedOwner = localStorage.getItem('sync_user_id');
  if (storedOwner && storedOwner !== currentUserId) {
    await purgeLocalData();
  }
  localStorage.setItem('sync_user_id', currentUserId);
}

/**
 * Envoie les données locales en attente. Rend `true` seulement si TOUT est
 * effectivement arrivé côté serveur.
 *
 * Supabase ne lève pas d'exception quand il refuse une écriture (table absente,
 * RLS, réseau) : il renvoie un objet `error` que le code doit lire. Sans cette
 * valeur de retour, l'appelant confondait « le serveur a répondu » avec « le
 * serveur a rangé », et l'interface annonçait « Enregistré sur votre compte »
 * alors que rien n'était parti.
 */
export async function pushAll(): Promise<boolean> {
  const supabase = createBrowserClientHelper();
  if (!supabase) return false;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return false;

  await ensureMatchingUser(user.id);

  let toutEstParti = true;

  // 1. History (CVs & Letters)
  const allHistory = await db.history.toArray();
  const historyPush = pendingPush(
    allHistory.map((h) => ({
      ...h,
      updated_at: h.updated_at || h.created_at,
    })),
  );

  if (historyPush.length > 0) {
    const resumesToPush = historyPush
      .filter((h) => h.doc_type === 'CV')
      .map((h) => historyToRemoteResume(h, user.id));
    const lettersToPush = historyPush
      .filter((h) => h.doc_type === 'Lettre')
      .map((h) => historyToRemoteLetter(h, user.id));

    const nowIso = new Date().toISOString();

    if (resumesToPush.length > 0) {
      const freshResumes = await filterOutStalePush(supabase, 'resumes', resumesToPush);
      if (freshResumes.length > 0) {
        const { error } = await supabase.from('resumes').upsert(freshResumes);
        if (!error) {
          const ids = freshResumes.map((r) => r.id);
          await (db.history.where('id').anyOf(ids) as unknown as { modify: (changes: Record<string, unknown>) => Promise<number> })
            .modify({ synced_at: nowIso });
        } else {
          toutEstParti = false;
        }
      }
    }

    if (lettersToPush.length > 0) {
      const freshLetters = await filterOutStalePush(supabase, 'letters', lettersToPush);
      if (freshLetters.length > 0) {
        const { error } = await supabase.from('letters').upsert(freshLetters);
        if (!error) {
          const ids = freshLetters.map((l) => l.id);
          await (db.history.where('id').anyOf(ids) as unknown as { modify: (changes: Record<string, unknown>) => Promise<number> })
            .modify({ synced_at: nowIso });
        } else {
          toutEstParti = false;
        }
      }
    }
  }

  // 2. Applications
  const allApps = await db.applications.toArray();
  const appsPush = pendingPush(allApps);
  if (appsPush.length > 0) {
    const appsToPush = appsPush.map((a) => applicationToRemoteRow(a, user.id));
    const freshApps = await filterOutStalePush(supabase, 'applications', appsToPush);
    if (freshApps.length > 0) {
      const { error } = await supabase.from('applications').upsert(freshApps);
      if (!error) {
        const nowIso = new Date().toISOString();
        const ids = freshApps.map((a) => a.id);
        await db.applications
          .where('id')
          .anyOf(ids)
          .modify({ synced_at: nowIso });
      } else {
        toutEstParti = false;
      }
    }
  }

  // 3. Saved Jobs
  const allJobs = await db.jobs.toArray();
  const jobsPush = pendingPush(allJobs);
  if (jobsPush.length > 0) {
    const jobsToPush = jobsPush.map((j) => jobToRemoteSavedJob(j, user.id));
    const freshJobs = await filterOutStalePush(supabase, 'saved_jobs', jobsToPush);
    if (freshJobs.length > 0) {
      const { error } = await supabase.from('saved_jobs').upsert(freshJobs);
      if (!error) {
        const nowIso = new Date().toISOString();
        const ids = freshJobs.map((j) => j.id);
        await db.jobs
          .where('id')
          .anyOf(ids)
          .modify({ synced_at: nowIso });
      } else {
        toutEstParti = false;
      }
    }
  }

  // 4. Réglages (profil « Mes infos », critères de recherche d'offres).
  //    Deux singletons : une ligne distante chacun, arbitrée comme le reste.
  const settingsToPush: RemoteUserSettingRow[] = [];

  const localProfile = await db.profile.get('me');
  if (localProfile && pendingPush([localProfile]).length > 0) {
    settingsToPush.push(profileToRemoteSetting(localProfile, user.id));
  }

  const localJobProfile = await db.jobProfile.get('me');
  if (localJobProfile && pendingPush([localJobProfile]).length > 0) {
    settingsToPush.push(jobProfileToRemoteSetting(localJobProfile, user.id));
  }

  if (settingsToPush.length > 0) {
    const freshSettings = await filterOutStalePush(supabase, 'user_settings', settingsToPush);
    if (freshSettings.length > 0) {
      const { error } = await supabase.from('user_settings').upsert(freshSettings);
      if (!error) {
        const nowIso = new Date().toISOString();
        for (const row of freshSettings) {
          if (row.id === 'profile') await db.profile.update('me', { synced_at: nowIso });
          else await db.jobProfile.update('me', { synced_at: nowIso });
        }
      } else {
        toutEstParti = false;
      }
    }
  }

  return toutEstParti;
}

export async function pullAll(): Promise<void> {
  const supabase = createBrowserClientHelper();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;

  await ensureMatchingUser(user.id);

  let aEcrit = false;

  const getCursor = (key: string) =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(key) || '1970-01-01T00:00:00.000Z' : '1970-01-01T00:00:00.000Z';
  const setCursor = (key: string, val: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
  };

  // 1. Pull Resumes
  const resumeCursor = getCursor('sync_cursor_resumes');
  const { data: remoteResumes } = await supabase
    .from('resumes')
    .select('*')
    .gt('updated_at', resumeCursor);

  if (remoteResumes && remoteResumes.length > 0) {
    let maxUpdatedAt = resumeCursor;
    for (const rRow of remoteResumes) {
      if (rRow.updated_at && rRow.updated_at > maxUpdatedAt) {
        maxUpdatedAt = rRow.updated_at;
      }
      const local = await db.history.get(rRow.id);
      if (!local || resolveConflict(local, rRow) === 'remote') {
        await db.history.put(mergeRemoteHistory(local, remoteResumeToHistory(rRow)));
        aEcrit = true;
      }
    }
    setCursor('sync_cursor_resumes', maxUpdatedAt);
  }

  // 2. Pull Letters
  const letterCursor = getCursor('sync_cursor_letters');
  const { data: remoteLetters } = await supabase
    .from('letters')
    .select('*')
    .gt('updated_at', letterCursor);

  if (remoteLetters && remoteLetters.length > 0) {
    let maxUpdatedAt = letterCursor;
    for (const lRow of remoteLetters) {
      if (lRow.updated_at && lRow.updated_at > maxUpdatedAt) {
        maxUpdatedAt = lRow.updated_at;
      }
      const local = await db.history.get(lRow.id);
      if (!local || resolveConflict(local, lRow) === 'remote') {
        await db.history.put(mergeRemoteHistory(local, remoteLetterToHistory(lRow)));
        aEcrit = true;
      }
    }
    setCursor('sync_cursor_letters', maxUpdatedAt);
  }

  // 3. Pull Applications
  const appCursor = getCursor('sync_cursor_applications');
  const { data: remoteApps } = await supabase
    .from('applications')
    .select('*')
    .gt('updated_at', appCursor);

  if (remoteApps && remoteApps.length > 0) {
    let maxUpdatedAt = appCursor;
    for (const aRow of remoteApps) {
      if (aRow.updated_at && aRow.updated_at > maxUpdatedAt) {
        maxUpdatedAt = aRow.updated_at;
      }
      const local = await db.applications.get(aRow.id);
      if (!local) {
        await db.applications.put(remoteRowToApplication(aRow));
        aEcrit = true;
      } else if (resolveConflict(local, aRow) === 'remote') {
        await db.applications.put(remoteRowToApplication(aRow));
        aEcrit = true;
      }
    }
    setCursor('sync_cursor_applications', maxUpdatedAt);
  }

  // 4. Pull Saved Jobs
  const jobCursor = getCursor('sync_cursor_saved_jobs');
  const { data: remoteJobs } = await supabase
    .from('saved_jobs')
    .select('*')
    .gt('updated_at', jobCursor);

  if (remoteJobs && remoteJobs.length > 0) {
    let maxUpdatedAt = jobCursor;
    for (const jRow of remoteJobs) {
      if (jRow.updated_at && jRow.updated_at > maxUpdatedAt) {
        maxUpdatedAt = jRow.updated_at;
      }
      const local = await db.jobs.get(jRow.id);
      if (!local) {
        await db.jobs.put(remoteSavedJobToJob(jRow));
        aEcrit = true;
      } else if (resolveConflict(local, jRow) === 'remote') {
        await db.jobs.put(remoteSavedJobToJob(jRow));
        aEcrit = true;
      }
    }
    setCursor('sync_cursor_saved_jobs', maxUpdatedAt);
  }

  // 5. Pull Réglages. `synced_at` est posé à maintenant : une valeur qui vient
  //    d'arriver ne doit pas repartir au push suivant.
  const settingsCursor = getCursor('sync_cursor_user_settings');
  const { data: remoteSettings } = await supabase
    .from('user_settings')
    .select('*')
    .gt('updated_at', settingsCursor);

  if (remoteSettings && remoteSettings.length > 0) {
    let maxUpdatedAt = settingsCursor;
    const nowIso = new Date().toISOString();
    for (const sRow of remoteSettings as RemoteUserSettingRow[]) {
      if (sRow.updated_at && sRow.updated_at > maxUpdatedAt) {
        maxUpdatedAt = sRow.updated_at;
      }
      if (sRow.id === 'profile') {
        const local = await db.profile.get('me');
        if (!local || resolveConflict(local, sRow) === 'remote') {
          await db.profile.put({ ...remoteSettingToProfile(sRow), synced_at: nowIso });
          aEcrit = true;
        }
      } else if (sRow.id === 'jobProfile') {
        const local = await db.jobProfile.get('me');
        if (!local || resolveConflict(local, sRow) === 'remote') {
          await db.jobProfile.put({ ...remoteSettingToJobProfile(sRow), synced_at: nowIso });
          aEcrit = true;
        }
      }
    }
    setCursor('sync_cursor_user_settings', maxUpdatedAt);
  }

  if (aEcrit) emitSyncChange();
}

export async function syncAll(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;
  try {
    await pushAll();
    await pullAll();
  } catch (e) {
    console.warn('syncAll error:', e);
  } finally {
    isSyncing = false;
  }
}

import { db } from './db';
import { createBrowserClientHelper } from '@/lib/supabase/client';
import { pendingPush, toIso } from './syncFields';
import {
  historyToRemoteResume,
  historyToRemoteLetter,
  remoteResumeToHistory,
  remoteLetterToHistory,
  applicationToRemoteRow,
  remoteRowToApplication,
  jobToRemoteSavedJob,
  remoteSavedJobToJob,
} from './syncMapping';

let isSyncing = false;

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
    await db.transaction('rw', [db.history, db.jobs, db.applications, db.snapshots, db.drafts], async () => {
      await db.history.clear();
      await db.jobs.clear();
      await db.applications.clear();
      await db.snapshots.clear();
      await db.drafts.clear();
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sync_user_id');
      localStorage.removeItem('sync_cursor_resumes');
      localStorage.removeItem('sync_cursor_letters');
      localStorage.removeItem('sync_cursor_applications');
      localStorage.removeItem('sync_cursor_saved_jobs');
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

export async function pushAll(): Promise<void> {
  const supabase = createBrowserClientHelper();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;

  await ensureMatchingUser(user.id);

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
      const { error } = await supabase.from('resumes').upsert(resumesToPush);
      if (!error) {
        const ids = resumesToPush.map((r) => r.id);
        await db.history
          .where('id')
          .anyOf(ids)
          .modify({ synced_at: nowIso });
      }
    }

    if (lettersToPush.length > 0) {
      const { error } = await supabase.from('letters').upsert(lettersToPush);
      if (!error) {
        const ids = lettersToPush.map((l) => l.id);
        await db.history
          .where('id')
          .anyOf(ids)
          .modify({ synced_at: nowIso });
      }
    }
  }

  // 2. Applications
  const allApps = await db.applications.toArray();
  const appsPush = pendingPush(allApps);
  if (appsPush.length > 0) {
    const appsToPush = appsPush.map((a) => applicationToRemoteRow(a, user.id));
    const { error } = await supabase.from('applications').upsert(appsToPush);
    if (!error) {
      const nowIso = new Date().toISOString();
      const ids = appsToPush.map((a) => a.id);
      await db.applications
        .where('id')
        .anyOf(ids)
        .modify({ synced_at: nowIso });
    }
  }

  // 3. Saved Jobs
  const allJobs = await db.jobs.toArray();
  const jobsPush = pendingPush(allJobs);
  if (jobsPush.length > 0) {
    const jobsToPush = jobsPush.map((j) => jobToRemoteSavedJob(j, user.id));
    const { error } = await supabase.from('saved_jobs').upsert(jobsToPush);
    if (!error) {
      const nowIso = new Date().toISOString();
      const ids = jobsToPush.map((j) => j.id);
      await db.jobs
        .where('id')
        .anyOf(ids)
        .modify({ synced_at: nowIso });
    }
  }
}

export async function pullAll(): Promise<void> {
  const supabase = createBrowserClientHelper();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;

  await ensureMatchingUser(user.id);

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
      if (!local) {
        await db.history.put(remoteResumeToHistory(rRow));
      } else if (resolveConflict(local, rRow) === 'remote') {
        await db.history.put(remoteResumeToHistory(rRow));
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
      if (!local) {
        await db.history.put(remoteLetterToHistory(lRow));
      } else if (resolveConflict(local, lRow) === 'remote') {
        await db.history.put(remoteLetterToHistory(lRow));
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
      } else if (resolveConflict(local, aRow) === 'remote') {
        await db.applications.put(remoteRowToApplication(aRow));
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
      } else if (resolveConflict(local, jRow) === 'remote') {
        await db.jobs.put(remoteSavedJobToJob(jRow));
      }
    }
    setCursor('sync_cursor_saved_jobs', maxUpdatedAt);
  }
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

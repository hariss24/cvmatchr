import type { HistoryEntry, JobEntry, JobProfileRow } from './db';
import type { Application, ApplicationEvent } from '@/lib/applications/types';
import type { DocData } from '@/state/docStore';
import type { UserProfile } from '@/lib/profile/profile';
import { toIso } from './syncFields';

export interface RemoteResumeRow {
  user_id?: string;
  id: string;
  title: string;
  content: Record<string, unknown>;
  is_primary?: boolean;
  deleted_at?: string | null;
  client_updated_at: string;
  updated_at?: string;
}

export interface RemoteLetterRow {
  user_id?: string;
  id: string;
  title: string;
  company?: string | null;
  job_title?: string | null;
  content: Record<string, unknown>;
  deleted_at?: string | null;
  client_updated_at: string;
  updated_at?: string;
}

export interface RemoteApplicationRow {
  user_id?: string;
  id: string;
  company: string;
  job_title: string;
  url?: string | null;
  status?: string;
  notes?: string | null;
  payload: Record<string, unknown>;
  applied_at?: string | null;
  deleted_at?: string | null;
  client_updated_at: string;
  updated_at?: string;
}

export interface RemoteSavedJobRow {
  user_id?: string;
  id: string;
  job_data: Record<string, unknown>;
  deleted_at?: string | null;
  client_updated_at: string;
  updated_at?: string;
}

export function historyToRemoteResume(entry: HistoryEntry, userId: string): RemoteResumeRow {
  const isoUpdate = toIso(entry.updated_at || entry.created_at);
  return {
    user_id: userId,
    id: entry.id,
    title: entry.label || entry.filename || entry.company || 'CV',
    content: entry.json as unknown as Record<string, unknown>,
    is_primary: false,
    deleted_at: entry.deleted_at ?? null,
    client_updated_at: isoUpdate,
  };
}

export function remoteResumeToHistory(row: RemoteResumeRow): HistoryEntry {
  return {
    id: row.id,
    created_at: row.client_updated_at,
    updated_at: row.client_updated_at,
    doc_type: 'CV',
    company: row.title || 'CV',
    role: '',
    job_desc: '',
    filename: row.title || 'cv.json',
    notes: '',
    pdf_views: 0,
    editor_reloads: 0,
    deleted_at: row.deleted_at ?? null,
    synced_at: row.updated_at || new Date().toISOString(),
    json: row.content as unknown as DocData,
    templateId: null,
  };
}

export function historyToRemoteLetter(entry: HistoryEntry, userId: string): RemoteLetterRow {
  const isoUpdate = toIso(entry.updated_at || entry.created_at);
  return {
    user_id: userId,
    id: entry.id,
    title: entry.filename || entry.company || 'Lettre',
    company: entry.company || '',
    job_title: entry.role || '',
    content: entry.json as unknown as Record<string, unknown>,
    deleted_at: entry.deleted_at ?? null,
    client_updated_at: isoUpdate,
  };
}

export function remoteLetterToHistory(row: RemoteLetterRow): HistoryEntry {
  return {
    id: row.id,
    created_at: row.client_updated_at,
    updated_at: row.client_updated_at,
    doc_type: 'Lettre',
    company: row.company || row.title || 'Lettre',
    role: row.job_title || '',
    job_desc: '',
    filename: row.title || 'lettre.json',
    notes: '',
    pdf_views: 0,
    editor_reloads: 0,
    deleted_at: row.deleted_at ?? null,
    synced_at: row.updated_at || new Date().toISOString(),
    json: row.content as unknown as DocData,
    templateId: null,
  };
}

export function applicationToRemoteRow(app: Application, userId: string): RemoteApplicationRow {
  const isoUpdate = toIso(app.updatedAt || app.createdAt);
  const appliedEvent = app.events?.find((e) => e.type === 'applied');
  const appliedAt = appliedEvent ? new Date(appliedEvent.date).toISOString() : null;
  return {
    user_id: userId,
    id: app.id,
    company: app.company,
    job_title: app.role,
    url: app.jobUrl || '',
    status: 'draft',
    notes: app.notes || '',
    payload: {
      events: app.events || [],
      normKey: app.normKey,
      jobText: app.jobText,
      source: app.source,
    },
    applied_at: appliedAt,
    deleted_at: app.deleted_at ?? null,
    client_updated_at: isoUpdate,
  };
}

export function remoteRowToApplication(row: RemoteApplicationRow): Application {
  const payload = (row.payload || {}) as Record<string, unknown>;
  const events = Array.isArray(payload.events) ? (payload.events as unknown as ApplicationEvent[]) : [];
  const ts = new Date(row.client_updated_at).getTime();
  return {
    id: row.id,
    createdAt: ts,
    updatedAt: ts,
    company: row.company || '',
    role: row.job_title || '',
    normKey: (payload.normKey as string) || '',
    jobText: (payload.jobText as string) || '',
    jobUrl: row.url || '',
    source: (payload.source as Application['source']) || 'manual',
    events,
    notes: row.notes || '',
    deleted_at: row.deleted_at ?? null,
    synced_at: row.updated_at || new Date().toISOString(),
  };
}

export function jobToRemoteSavedJob(job: JobEntry, userId: string): RemoteSavedJobRow {
  const isoUpdate = toIso(job.updatedAt || job.createdAt);
  return {
    user_id: userId,
    id: job.id,
    job_data: job as unknown as Record<string, unknown>,
    deleted_at: job.deleted_at ?? null,
    client_updated_at: isoUpdate,
  };
}

export function remoteSavedJobToJob(row: RemoteSavedJobRow): JobEntry {
  const job = (row.job_data || {}) as unknown as JobEntry;
  return {
    ...job,
    id: row.id,
    deleted_at: row.deleted_at ?? null,
    synced_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Réglages répliqués. `id` porte la clé du réglage ('profile' | 'jobProfile')
 * et non un UUID : ce sont des singletons par utilisateur, et la colonne
 * s'appelle `id` pour rester compatible avec `filterOutStalePush()`.
 */
export interface RemoteUserSettingRow {
  user_id?: string;
  id: 'profile' | 'jobProfile';
  content: Record<string, unknown>;
  deleted_at?: string | null;
  client_updated_at: string;
  updated_at?: string;
}

export function profileToRemoteSetting(p: UserProfile, userId: string): RemoteUserSettingRow {
  return {
    user_id: userId,
    id: 'profile',
    content: { ...p } as unknown as Record<string, unknown>,
    client_updated_at: toIso(p.updatedAt || Date.now()),
  };
}

export function remoteSettingToProfile(row: RemoteUserSettingRow): UserProfile {
  const c = row.content as Partial<UserProfile>;
  return {
    id: 'me',
    prenom: c.prenom ?? '',
    nom: c.nom ?? '',
    email: c.email ?? '',
    telephone: c.telephone ?? '',
    ville: c.ville ?? '',
    linkedin: c.linkedin ?? '',
    updatedAt: c.updatedAt ?? new Date(row.client_updated_at).getTime(),
    synced_at: null,
  };
}

export function jobProfileToRemoteSetting(row: JobProfileRow, userId: string): RemoteUserSettingRow {
  return {
    user_id: userId,
    id: 'jobProfile',
    content: { profile: row.profile } as unknown as Record<string, unknown>,
    client_updated_at: toIso(row.updatedAt || Date.now()),
  };
}

export function remoteSettingToJobProfile(row: RemoteUserSettingRow): JobProfileRow {
  const c = row.content as { profile?: JobProfileRow['profile'] };
  return {
    id: 'me',
    profile: c.profile as JobProfileRow['profile'],
    updatedAt: new Date(row.client_updated_at).getTime(),
    synced_at: null,
  };
}

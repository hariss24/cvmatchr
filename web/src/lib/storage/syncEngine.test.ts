import { describe, it, expect } from 'vitest';
import { resolveConflict, sanitizeImportedItem, mergeRemoteHistory, filterOutStalePush } from './syncEngine';
import type { HistoryEntry } from './db';

describe('SyncEngine', () => {
  it('garde la version la plus récente en cas de conflit', () => {
    const local = { id: '1', updated_at: '2026-08-10T02:00:00Z' };
    const remote = { id: '1', client_updated_at: '2026-08-10T01:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('local');
  });

  it('garde la version distante si elle est plus récente', () => {
    const local = { id: '1', updated_at: '2026-08-10T01:00:00Z' };
    const remote = { id: '1', client_updated_at: '2026-08-10T03:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('remote');
  });

  it('remet synced_at à null et rafraîchit updated_at à l\'import', () => {
    const raw = { id: 'old', synced_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    const s = sanitizeImportedItem(raw);
    expect(s.synced_at).toBeNull();
    expect(new Date(s.updated_at).getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
  });

  it('préserve deleted_at à l\'import (une suppression importée reste une suppression)', () => {
    const raw = { id: 'x', updated_at: '2026-01-01T00:00:00Z', deleted_at: '2026-01-02T00:00:00Z' };
    expect(sanitizeImportedItem(raw).deleted_at).toBe('2026-01-02T00:00:00Z');
  });

  it('mergeRemoteHistory conserve les champs locaux absents du schéma distant', () => {
    const local: HistoryEntry = {
      id: '1',
      created_at: '2026-01-01T00:00:00Z',
      doc_type: 'CV',
      company: 'ACME',
      role: 'Dev',
      job_desc: 'Description locale',
      filename: 'cv.json',
      notes: 'Notes locales',
      pdf_views: 3,
      editor_reloads: 2,
      applicationId: 'app-42',
      label: 'Mon CV principal',
      json: {} as HistoryEntry['json'],
      templateId: 'sobre' as HistoryEntry['templateId'],
    };
    const mapped: HistoryEntry = {
      id: '1',
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      doc_type: 'CV',
      company: 'Nouveau titre distant',
      role: '',
      job_desc: '',
      filename: 'Nouveau titre distant',
      notes: '',
      pdf_views: 0,
      editor_reloads: 0,
      json: { updated: true } as unknown as HistoryEntry['json'],
      templateId: null,
    };
    const result = mergeRemoteHistory(local, mapped);
    // Contenu synchronisé : vient bien du distant.
    expect(result.json).toEqual({ updated: true });
    expect(result.company).toBe('Nouveau titre distant');
    // Champs locaux hors schéma distant : préservés, pas écrasés par les défauts du mapping.
    expect(result.applicationId).toBe('app-42');
    expect(result.label).toBe('Mon CV principal');
    expect(result.notes).toBe('Notes locales');
    expect(result.job_desc).toBe('Description locale');
    expect(result.pdf_views).toBe(3);
    expect(result.editor_reloads).toBe(2);
    expect(result.templateId).toBe('sobre');
  });

  it('mergeRemoteHistory renvoie le mapping distant tel quel pour une entrée inconnue localement', () => {
    const mapped: HistoryEntry = {
      id: 'new',
      created_at: '2026-01-02T00:00:00Z',
      doc_type: 'CV',
      company: 'ACME',
      role: '',
      job_desc: '',
      filename: 'cv.json',
      notes: '',
      pdf_views: 0,
      editor_reloads: 0,
      json: {} as HistoryEntry['json'],
      templateId: null,
    };
    expect(mergeRemoteHistory(undefined, mapped)).toEqual(mapped);
  });

  function fakeSupabase(remoteRows: Array<{ id: string; client_updated_at: string }>) {
    return {
      from: () => ({
        select: () => ({
          in: async () => ({ data: remoteRows }),
        }),
      }),
    } as unknown as Parameters<typeof filterOutStalePush>[0];
  }

  it('filterOutStalePush écarte une ligne locale plus ancienne que le distant', async () => {
    const rows = [{ id: '1', client_updated_at: '2026-01-01T00:00:00Z' }];
    const supabase = fakeSupabase([{ id: '1', client_updated_at: '2026-01-02T00:00:00Z' }]);
    const result = await filterOutStalePush(supabase, 'resumes', rows);
    expect(result).toEqual([]);
  });

  it('filterOutStalePush garde une ligne locale plus récente ou égale au distant', async () => {
    const rows = [{ id: '1', client_updated_at: '2026-01-03T00:00:00Z' }];
    const supabase = fakeSupabase([{ id: '1', client_updated_at: '2026-01-02T00:00:00Z' }]);
    const result = await filterOutStalePush(supabase, 'resumes', rows);
    expect(result).toEqual(rows);
  });

  it('filterOutStalePush garde une ligne sans équivalent distant (nouvelle création)', async () => {
    const rows = [{ id: 'new', client_updated_at: '2026-01-01T00:00:00Z' }];
    const supabase = fakeSupabase([]);
    const result = await filterOutStalePush(supabase, 'resumes', rows);
    expect(result).toEqual(rows);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage/db', () => ({
  listHistoryEntries: vi.fn(),
  saveHistoryEntry: vi.fn(async () => {}),
  putApplication: vi.fn(async () => {}),
  saveJob: vi.fn(async () => {}),
  saveProfile: vi.fn(async () => {}),
  saveJobProfile: vi.fn(async () => {}),
  saveTemplate: vi.fn(async () => {}),
  loadDraft: vi.fn(async () => null),
  db: {
    history: { toArray: vi.fn(async () => []) },
    applications: { toArray: vi.fn(async () => []) },
    jobs: { toArray: vi.fn(async () => []) },
    profile: { get: vi.fn(async () => null) },
    jobProfile: { get: vi.fn(async () => null) },
    templates: { toArray: vi.fn(async () => []) },
  },
}));

vi.mock('@/lib/storage/master', () => ({
  saveMasterResume: vi.fn(async () => {}),
}));

import { reprendreDonneesLocales } from './reprise';
import { db, saveHistoryEntry } from './db';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('reprise des données locales', () => {
  it("ne reprend qu'une seule fois", async () => {
    localStorage.setItem('reprise_locale_faite', '1');
    expect(await reprendreDonneesLocales()).toBe(0);
    expect(vi.mocked(saveHistoryEntry)).not.toHaveBeenCalled();
  });

  it("reprend les données locales et pose le drapeau", async () => {
    vi.mocked(db.history!.toArray).mockResolvedValueOnce([
      {
        id: 'h-1',
        created_at: '2026-08-15',
        doc_type: 'CV',
        company: 'ACME',
        role: 'Dev',
        job_desc: '',
        filename: 'CV ACME',
        notes: '',
        pdf_views: 0,
        editor_reloads: 0,
        json: { name: 'Hariss' } as never,
        templateId: null,
      },
    ]);

    const count = await reprendreDonneesLocales();
    expect(count).toBe(1);
    expect(saveHistoryEntry).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('reprise_locale_faite')).toBe('1');
  });

  it("ne pose pas le drapeau si une écriture échoue", async () => {
    vi.mocked(db.history!.toArray).mockResolvedValueOnce([
      {
        id: 'h-1',
        created_at: '2026-08-15',
        doc_type: 'CV',
        company: 'ACME',
        role: 'Dev',
        job_desc: '',
        filename: 'CV ACME',
        notes: '',
        pdf_views: 0,
        editor_reloads: 0,
        json: { name: 'Hariss' } as never,
        templateId: null,
      },
    ]);
    vi.mocked(saveHistoryEntry).mockRejectedValueOnce(new Error('Network error'));

    await expect(reprendreDonneesLocales()).rejects.toThrow('Network error');
    expect(localStorage.getItem('reprise_locale_faite')).toBeNull();
  });
});

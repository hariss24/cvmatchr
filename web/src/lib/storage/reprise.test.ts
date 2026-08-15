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
  // `clear` fait partie du contrat depuis le 15/08/2026 : la reprise vide les
  // tables locales elle-même, une fois les données arrivées sur le compte.
  db: {
    history: { toArray: vi.fn(async () => []), clear: vi.fn(async () => {}) },
    applications: { toArray: vi.fn(async () => []), clear: vi.fn(async () => {}) },
    jobs: { toArray: vi.fn(async () => []), clear: vi.fn(async () => {}) },
    profile: { get: vi.fn(async () => null), clear: vi.fn(async () => {}) },
    jobProfile: { get: vi.fn(async () => null), clear: vi.fn(async () => {}) },
    templates: { toArray: vi.fn(async () => []), clear: vi.fn(async () => {}) },
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
  it("vide les tables locales seulement APRÈS les avoir envoyées", async () => {
    // L'ordre est tout : un vidage antérieur (Dexie `stores({history: null})`)
    // s'exécute à l'ouverture de la base et détruit ce que la reprise devait
    // sauver. Incident du 15/08/2026.
    vi.mocked(db.history!.toArray).mockResolvedValueOnce([
      { id: 'doc-1', doc_type: 'CV' } as never,
    ]);
    await reprendreDonneesLocales();
    expect(vi.mocked(saveHistoryEntry)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.history!.clear)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveHistoryEntry).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(db.history!.clear).mock.invocationCallOrder[0]);
  });

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

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage/db', () => ({ saveHistoryEntry: vi.fn(async () => {}) }));
vi.mock('@/lib/applications/store', () => ({
  upsertApplicationForDocument: vi.fn(async () => 'app-1'),
  pruneAnonymousShelf: vi.fn(async () => {}),
}));
vi.mock('@/state/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user-1' } })) },
}));

import { saveHistoryEntry } from '@/lib/storage/db';
import { useDocStore } from '@/state/docStore';
import { useAuthStore } from '@/state/authStore';
import { DEFAULT_RESUME } from '@/lib/resume/defaults';
import { saveCurrentDocument } from './saveDocument';
import { RemoteError } from './remote';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuthStore.getState).mockReturnValue({ user: { id: 'user-1' } } as never);
  useDocStore.setState({
    docType: 'CV',
    json: { ...DEFAULT_RESUME, name: 'Hariss' },
    company: 'ACME',
    role: 'Dev',
    templateId: 'sobre',
  });
});

describe('saveCurrentDocument', () => {
  it('écrit dans l\'historique sans générer aucun PDF', async () => {
    await saveCurrentDocument();
    expect(vi.mocked(saveHistoryEntry)).toHaveBeenCalledTimes(1);
    const entry = vi.mocked(saveHistoryEntry).mock.calls[0][0];
    expect(entry.doc_type).toBe('CV');
    expect(entry.company).toBe('ACME');
    expect(entry.json).toEqual(useDocStore.getState().json);
  });

  it('rend "account" quand l\'envoi aboutit', async () => {
    expect(await saveCurrentDocument()).toBe('account');
  });

  it('lève une RemoteError quand l\'utilisateur n\'est pas connecté', async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({ user: null } as never);
    await expect(saveCurrentDocument()).rejects.toBeInstanceOf(RemoteError);
  });

  it('laisse remonter l\'erreur si saveHistoryEntry lève', async () => {
    vi.mocked(saveHistoryEntry).mockRejectedValueOnce(new RemoteError('Panne serveur'));
    await expect(saveCurrentDocument()).rejects.toThrow('Panne serveur');
  });
});

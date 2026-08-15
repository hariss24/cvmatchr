/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage/db', () => ({ saveHistoryEntry: vi.fn(async () => {}) }));
vi.mock('@/lib/applications/store', () => ({
  upsertApplicationForDocument: vi.fn(async () => 'app-1'),
  pruneAnonymousShelf: vi.fn(async () => {}),
}));
// `pushAll` rend désormais un booléen : `true` seulement si le serveur a
// confirmé l'écriture. Un `undefined` (ancien contrat) vaudrait « refusé ».
vi.mock('@/lib/storage/syncEngine', () => ({ pushAll: vi.fn(async () => true) }));
vi.mock('@/state/authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
}));

import { saveHistoryEntry } from '@/lib/storage/db';
import { pushAll } from '@/lib/storage/syncEngine';
import { useDocStore } from '@/state/docStore';
import { DEFAULT_RESUME } from '@/lib/resume/defaults';
import { saveCurrentDocument } from './saveDocument';

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(vi.mocked(pushAll)).toHaveBeenCalledTimes(1);
  });

  it('rend "device" quand l\'envoi échoue, sans faire échouer l\'enregistrement', async () => {
    vi.mocked(pushAll).mockRejectedValueOnce(new Error('offline'));
    expect(await saveCurrentDocument()).toBe('device');
    expect(vi.mocked(saveHistoryEntry)).toHaveBeenCalledTimes(1);
  });

  it('n\'annonce pas le compte quand le serveur refuse l\'écriture', async () => {
    // Cas réel : la table `user_settings` n'existe pas encore côté Supabase.
    // Le serveur répond — donc aucune exception — mais il refuse. Sans lecture
    // de la réponse, l'interface promettait « Enregistré sur votre compte ».
    vi.mocked(pushAll).mockResolvedValueOnce(false);
    expect(await saveCurrentDocument()).toBe('device');
    expect(vi.mocked(saveHistoryEntry)).toHaveBeenCalledTimes(1);
  });
});

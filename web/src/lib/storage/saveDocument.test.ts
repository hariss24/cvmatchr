/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage/db', () => ({ saveDocumentContent: vi.fn(async () => {}) }));
vi.mock('@/lib/applications/store', () => ({
  upsertApplicationForDocument: vi.fn(async () => 'app-1'),
  pruneAnonymousShelf: vi.fn(async () => {}),
}));
vi.mock('@/state/authStore', () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: 'user-1' } })) },
}));

import { saveDocumentContent } from '@/lib/storage/db';
import { pruneAnonymousShelf } from '@/lib/applications/store';
import { useDocStore } from '@/state/docStore';
import { useAuthStore } from '@/state/authStore';
import { DEFAULT_RESUME } from '@/lib/resume/defaults';
import { saveCurrentDocument } from './saveDocument';
import { RemoteError } from './remote';

const ecrit = vi.mocked(saveDocumentContent);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuthStore.getState).mockReturnValue({ user: { id: 'user-1' } } as never);
  useDocStore.setState({
    docType: 'CV',
    json: { ...DEFAULT_RESUME, name: 'Hariss' },
    company: 'ACME',
    role: 'Dev',
    templateId: 'sobre',
    documentId: null,
  });
});

describe('saveCurrentDocument', () => {
  it('écrit dans l\'historique sans générer aucun PDF', async () => {
    await saveCurrentDocument();
    expect(ecrit).toHaveBeenCalledTimes(1);
    const entry = ecrit.mock.calls[0][0];
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

  it('laisse remonter l\'erreur si l\'écriture lève', async () => {
    ecrit.mockRejectedValueOnce(new RemoteError('Panne serveur'));
    await expect(saveCurrentDocument()).rejects.toThrow('Panne serveur');
  });

  // LE CŒUR DU CHANTIER : enregistrer, ce n'est pas archiver.
  describe('mise à jour plutôt que copie', () => {
    it('donne une identité au document au premier enregistrement', async () => {
      await saveCurrentDocument();
      const pose = useDocStore.getState().documentId;
      expect(pose).toBeTruthy();
      expect(ecrit.mock.calls[0][0].id).toBe(pose);
    });

    it('dix enregistrements successifs ne font qu\'UN document', async () => {
      for (let i = 0; i < 10; i++) await saveCurrentDocument();

      const identifiants = new Set(ecrit.mock.calls.map((c) => c[0].id));
      expect(ecrit).toHaveBeenCalledTimes(10);
      expect(identifiants.size).toBe(1);
    });

    it('met à jour le document ouvert, sans en créer une copie', async () => {
      useDocStore.setState({ documentId: 'doc-existant' });
      await saveCurrentDocument();

      expect(ecrit.mock.calls[0][0].id).toBe('doc-existant');
      expect(useDocStore.getState().documentId).toBe('doc-existant');
    });

    it('crée un SECOND document après une remise à zéro de l\'identité', async () => {
      await saveCurrentDocument();
      const premier = useDocStore.getState().documentId;

      useDocStore.setState({ documentId: null }); // ce que fait « Nouveau CV »
      await saveCurrentDocument();

      expect(useDocStore.getState().documentId).not.toBe(premier);
    });

    it('ne pose pas d\'identité si l\'écriture a échoué', async () => {
      ecrit.mockRejectedValueOnce(new RemoteError('Panne serveur'));
      await expect(saveCurrentDocument()).rejects.toThrow();
      // Sinon le prochain essai croirait mettre à jour un document inexistant.
      expect(useDocStore.getState().documentId).toBeNull();
    });

    it('ne range le rayon anonyme qu\'à la création', async () => {
      vi.mocked(await import('@/lib/applications/store')).upsertApplicationForDocument
        .mockResolvedValue(undefined as never);

      await saveCurrentDocument();
      expect(pruneAnonymousShelf).toHaveBeenCalledTimes(1);

      await saveCurrentDocument();
      expect(pruneAnonymousShelf).toHaveBeenCalledTimes(1);
    });
  });
});

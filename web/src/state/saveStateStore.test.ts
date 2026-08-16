import { describe, it, expect, beforeEach } from 'vitest';
import { useSaveStateStore } from './saveStateStore';

/**
 * `markDirty` / `markSaved('device' | 'account')` ont disparu avec le bouton
 * « Enregistrer » : plus personne ne clique, donc plus rien n'est « modifié mais
 * pas encore envoyé » à annoncer, et plus rien n'est « enregistré sur cet
 * appareil ». Ce que ces tests protégeaient — ne jamais annoncer le compte quand
 * l'envoi a échoué — est désormais vérifié là où la décision se prend :
 * `lib/storage/useAutoSaveCompte.test.ts`.
 */
beforeEach(() => {
  useSaveStateStore.setState({ state: 'idle' });
});

describe('saveStateStore', () => {
  it('part silencieux : rien à dire tant que rien n\'a bougé', () => {
    expect(useSaveStateStore.getState().state).toBe('idle');
  });

  it('distingue les cinq situations sans les confondre', () => {
    const { setState } = useSaveStateStore.getState();
    for (const etat of ['saving', 'saved', 'anonymous', 'error', 'idle'] as const) {
      setState(etat);
      expect(useSaveStateStore.getState().state).toBe(etat);
    }
  });
});

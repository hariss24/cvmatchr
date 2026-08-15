import { describe, it, expect, beforeEach } from 'vitest';
import { useSaveStateStore } from './saveStateStore';

beforeEach(() => {
  useSaveStateStore.setState({ state: 'dirty' });
});

describe('saveStateStore', () => {
  it('part de "non enregistré"', () => {
    expect(useSaveStateStore.getState().state).toBe('dirty');
  });

  it('passe à "compte" après un enregistrement répliqué', () => {
    useSaveStateStore.getState().markSaved('account');
    expect(useSaveStateStore.getState().state).toBe('account');
  });

  it('n\'annonce jamais le compte quand l\'envoi a échoué', () => {
    useSaveStateStore.getState().markSaved('device');
    expect(useSaveStateStore.getState().state).toBe('device');
  });

  it('repasse à "non enregistré" à la première modification', () => {
    useSaveStateStore.getState().markSaved('account');
    useSaveStateStore.getState().markDirty();
    expect(useSaveStateStore.getState().state).toBe('dirty');
  });
});

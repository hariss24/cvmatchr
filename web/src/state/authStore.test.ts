/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('AuthStore', () => {
  // Le store est un singleton de module : on le remet à l'état initial
  // explicitement, sinon l'ordre des fichiers de test change le résultat.
  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, isLoading: true });
  });

  it('démarre non authentifié et en chargement', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it("sort du chargement quand Supabase n'est pas configuré", async () => {
    await useAuthStore.getState().initAuth();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

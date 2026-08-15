/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AuthStore', () => {
  it('démarre non authentifié et en chargement', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({ user: null, session: null, isLoading: true });
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it("sort du chargement quand Supabase n'est pas configuré", async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({ user: null, session: null, isLoading: true });
    await useAuthStore.getState().initAuth();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('AuthStore.signOut — déconnexion et vidage du cache de session', () => {
  const signOutMock = vi.fn().mockResolvedValue({ error: null });
  const cacheClearMock = vi.fn();
  const callOrder: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    callOrder.length = 0;
    signOutMock.mockClear().mockImplementation(async () => {
      callOrder.push('auth.signOut');
      return { error: null };
    });
    cacheClearMock.mockClear().mockImplementation(() => {
      callOrder.push('cacheClear');
    });

    vi.doMock('@/lib/supabase/client', () => ({
      createBrowserClientHelper: () => ({ auth: { signOut: signOutMock } }),
    }));
    vi.doMock('@/lib/storage/sessionCache', () => ({
      cacheClear: cacheClearMock,
    }));
    vi.doMock('@/lib/storage/reprise', () => ({
      reprendreDonneesLocales: vi.fn(),
    }));
  });

  it('appelle auth.signOut puis vide la mémoire de session', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signOut();
    expect(callOrder).toEqual(['auth.signOut', 'cacheClear']);
  });
});

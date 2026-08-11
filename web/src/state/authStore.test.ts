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

describe('AuthStore.signOut — ordre push puis purge', () => {
  const signOutMock = vi.fn().mockResolvedValue({ error: null });
  const pushAllMock = vi.fn().mockResolvedValue(undefined);
  const purgeLocalDataMock = vi.fn().mockResolvedValue(undefined);
  const callOrder: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    callOrder.length = 0;
    signOutMock.mockClear().mockImplementation(async () => {
      callOrder.push('auth.signOut');
      return { error: null };
    });
    pushAllMock.mockClear().mockImplementation(async () => {
      callOrder.push('pushAll');
    });
    purgeLocalDataMock.mockClear().mockImplementation(async () => {
      callOrder.push('purgeLocalData');
    });

    vi.doMock('@/lib/supabase/client', () => ({
      createBrowserClientHelper: () => ({ auth: { signOut: signOutMock } }),
    }));
    vi.doMock('@/lib/storage/syncEngine', () => ({
      purgeLocalData: purgeLocalDataMock,
      ensureMatchingUser: vi.fn(),
      syncAll: vi.fn(),
      pushAll: pushAllMock,
    }));
  });

  it("pousse les changements en attente AVANT de couper la session et purger le local", async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signOut();
    expect(callOrder).toEqual(['pushAll', 'auth.signOut', 'purgeLocalData']);
  });

  it('purge quand même le local si pushAll échoue (ne bloque pas la déconnexion)', async () => {
    pushAllMock.mockRejectedValueOnce(new Error('offline'));
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signOut();
    expect(purgeLocalDataMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
  });
});

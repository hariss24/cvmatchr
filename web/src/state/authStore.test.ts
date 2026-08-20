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

describe('AuthStore — parcours email et mot de passe', () => {
  const signUp = vi.fn();
  const signInWithPassword = vi.fn();
  const verifyOtp = vi.fn();
  const resetPasswordForEmail = vi.fn();
  const updateUser = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    for (const m of [signUp, signInWithPassword, verifyOtp, resetPasswordForEmail, updateUser]) {
      m.mockClear().mockResolvedValue({ data: {}, error: null });
    }
    vi.doMock('@/lib/supabase/client', () => ({
      createBrowserClientHelper: () => ({
        auth: { signUp, signInWithPassword, verifyOtp, resetPasswordForEmail, updateUser },
      }),
    }));
  });

  it('crée un compte avec l\'adresse et le mot de passe fournis', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signUpWithEmail('marc@test.fr', 'motdepasse');
    const [arg] = signUp.mock.calls[0];
    expect(arg.email).toBe('marc@test.fr');
    expect(arg.password).toBe('motdepasse');
    // Le retour doit passer par /auth/confirmer, seule porte qui fonctionne
    // depuis un appareil autre que celui de l'inscription.
    expect(arg.options.emailRedirectTo).toContain('/auth/confirmer');
  });

  // Supabase n'échoue PAS sur une adresse déjà prise quand la confirmation est
  // activée : il renvoie un utilisateur sans identité. Sans ce garde-fou, la
  // personne attendrait un code qui n'arrive jamais.
  it('signale une adresse déjà inscrite, que Supabase annonce sans erreur', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [] } }, error: null,
    });
    const { useAuthStore } = await import('./authStore');
    await expect(
      useAuthStore.getState().signUpWithEmail('deja@test.fr', 'motdepasse'),
    ).rejects.toMatchObject({ message: 'User already registered' });
  });

  it('accepte une inscription qui produit une identité', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ provider: 'email' }] } }, error: null,
    });
    const { useAuthStore } = await import('./authStore');
    await expect(
      useAuthStore.getState().signUpWithEmail('neuf@test.fr', 'motdepasse'),
    ).resolves.toBeUndefined();
  });

  it('connecte avec l\'adresse et le mot de passe fournis', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().signInWithEmail('marc@test.fr', 'motdepasse');
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'marc@test.fr', password: 'motdepasse',
    });
  });

  it('valide le code d\'inscription avec le bon type', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().confirmSignupCode('marc@test.fr', '123456');
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'marc@test.fr', token: '123456', type: 'signup',
    });
  });

  // ⚠️ /auth/confirmer et NON /auth/callback : ce dernier exige une clé de
  // vérification présente dans le navigateur d'origine, si bien qu'un lien
  // ouvert sur le téléphone échouait toujours (constaté le 20/08/2026).
  it("renvoie le lien de réinitialisation vers la porte indépendante de l'appareil", async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().requestPasswordReset('marc@test.fr');
    const [adresse, options] = resetPasswordForEmail.mock.calls[0];
    expect(adresse).toBe('marc@test.fr');
    expect(options.redirectTo).toContain('/auth/confirmer');
    expect(options.redirectTo).not.toContain('/auth/callback');
    expect(options.redirectTo).toContain('next=/connexion/nouveau-mot-de-passe');
  });

  it('change le mot de passe de la session en cours', async () => {
    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().updatePassword('nouveaumotdepasse');
    expect(updateUser).toHaveBeenCalledWith({ password: 'nouveaumotdepasse' });
  });

  it('laisse remonter l\'erreur Supabase sans l\'avaler', async () => {
    signInWithPassword.mockResolvedValue({
      data: {}, error: { message: 'Invalid login credentials' },
    });
    const { useAuthStore } = await import('./authStore');
    await expect(
      useAuthStore.getState().signInWithEmail('marc@test.fr', 'faux'),
    ).rejects.toMatchObject({ message: 'Invalid login credentials' });
  });
});

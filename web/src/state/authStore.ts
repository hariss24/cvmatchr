import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { createBrowserClientHelper } from '@/lib/supabase/client';
import { reprendreDonneesLocales } from '@/lib/storage/reprise';
import { cacheClear } from '@/lib/storage/sessionCache';
import { db } from '@/lib/storage/db';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** `false` quand les variables Supabase sont absentes : l'UI masque le bouton. */
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Flux Google Identity Services : le jeton est obtenu côté navigateur, donc
   *  Google affiche notre domaine et non celui du projet Supabase. */
  signInWithGoogleIdToken: (credential: string, nonce: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  confirmSignupCode: (email: string, token: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isConfigured: false,

  signInWithGoogle: async () => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  },

  signInWithGoogleIdToken: async (credential: string, nonce: string) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    // `nonce` est le nonce BRUT : Google a reçu sa version hachée en SHA-256.
    // Les intervertir fait échouer la vérification côté Supabase.
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
      nonce,
    });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Piège de Supabase, vérifié le 19/08 : quand « Confirm email » est activé,
    // une inscription sur une adresse DÉJÀ prise ne renvoie aucune erreur. Elle
    // renvoie un utilisateur dont la liste `identities` est vide — c'est ainsi
    // que Supabase évite de révéler l'existence du compte.
    //
    // Sans ce test, la personne passe à l'écran « saisissez votre code » et
    // attend indéfiniment un courriel qui n'arrivera jamais. On lève donc le
    // message que `messageErreurAuth` sait déjà traduire.
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('User already registered');
    }
  },

  signInWithEmail: async (email, password) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  // `type: 'signup'` et non `'email'` : c'est le code du courriel de
  // confirmation d'inscription. Se tromper de type fait échouer la
  // vérification sans que le message ne dise pourquoi.
  confirmSignupCode: async (email, token) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
  },

  // Le lien du courriel passe par /auth/callback, qui échange le code contre
  // une session avant de rediriger. `next` y est validé par safeRedirectPath :
  // seul un chemin interne est accepté.
  requestPasswordReset: async (email) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const retour = `${window.location.origin}/auth/callback?next=/connexion/nouveau-mot-de-passe`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: retour,
    });
    if (error) throw error;
  },

  updatePassword: async (password) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  signOut: async () => {
    const supabase = createBrowserClientHelper();
    if (supabase) {
      await supabase.auth.signOut();
    }
    cacheClear();
    try {
      if (db.drafts) await db.drafts.clear();
      if (db.snapshots) await db.snapshots.clear();
    } catch {
      // Nettoyage au mieux
    }
    set({ user: null, session: null, isLoading: false });
  },

  initAuth: async () => {
    if (typeof window === 'undefined') return;
    const supabase = createBrowserClientHelper();
    if (!supabase) {
      set({ isLoading: false, isConfigured: false });
      return;
    }
    const { data } = await supabase.auth.getSession();
    const currentUser = data.session?.user ?? null;
    if (currentUser) {
      void reprendreDonneesLocales();
    }
    set({
      session: data.session,
      user: currentUser,
      isLoading: false,
      isConfigured: true,
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      if (newUser) {
        void reprendreDonneesLocales();
      }
      set({ session, user: newUser, isLoading: false });
    });
  },
}));

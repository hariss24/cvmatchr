import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { createBrowserClientHelper } from '@/lib/supabase/client';
import { purgeLocalData, ensureMatchingUser, syncAll, pushAll } from '@/lib/storage/syncEngine';

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

  signOut: async () => {
    const supabase = createBrowserClientHelper();
    if (supabase) {
      // Pousser les modifications en attente AVANT de couper la session : sans
      // ça, purgeLocalData() efface irréversiblement des changements jamais
      // répliqués côté serveur (rien d'autre ne synchronise juste avant une
      // déconnexion).
      try {
        await pushAll();
      } catch (e) {
        console.warn('pushAll avant déconnexion a échoué :', e);
      }
      await supabase.auth.signOut();
    }
    await purgeLocalData();
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
      await ensureMatchingUser(currentUser.id);
      void syncAll();
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
        void ensureMatchingUser(newUser.id).then(() => syncAll());
      }
      set({ session, user: newUser, isLoading: false });
    });
  },
}));

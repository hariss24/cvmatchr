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

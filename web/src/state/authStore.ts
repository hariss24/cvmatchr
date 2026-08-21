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
  /** Change le mot de passe APRÈS avoir vérifié l'ancien. */
  changePassword: (ancien: string, nouveau: string) => Promise<void>;
  /** Change l'adresse du compte APRÈS avoir vérifié le mot de passe. */
  changeEmail: (motDePasse: string, nouvelle: string) => Promise<void>;
  /** Ferme les sessions ouvertes ailleurs, en gardant celle-ci. */
  signOutOthers: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Même raison que pour la réinitialisation : le lien doit fonctionner
      // depuis n'importe quel appareil, pas seulement celui de l'inscription.
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmer?next=/` },
    });
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

  // ⚠️ Le retour passe par /auth/confirmer et NON /auth/callback. Ce dernier
  // échange un `code` contre une session, ce qui exige une clé de vérification
  // présente dans le navigateur d'origine : un lien ouvert sur le téléphone
  // échouait donc toujours, alors que c'est là qu'on lit ses courriels
  // (constaté le 20/08/2026). `next` est validé par safeRedirectPath : seul un
  // chemin interne est accepté.
  requestPasswordReset: async (email) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const retour = `${window.location.origin}/auth/confirmer?next=/connexion/nouveau-mot-de-passe`;
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

  // ⚠️ Supabase n'offre aucun « vérifier le mot de passe actuel » : `updateUser`
  // se contente d'une session valide. Un ordinateur laissé ouvert suffirait
  // donc à un tiers pour changer le mot de passe et enfermer dehors le
  // propriétaire du compte. On le vérifie en tentant une connexion avec
  // l'ancien — la seule preuve dont on dispose.
  changePassword: async (ancien, nouveau) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const email = useAuthStore.getState().user?.email;
    if (!email) throw new Error('Connectez-vous pour changer votre mot de passe.');

    const { error: refus } = await supabase.auth.signInWithPassword({ email, password: ancien });
    if (refus) throw new Error('Mot de passe actuel incorrect.');

    const { error } = await supabase.auth.updateUser({ password: nouveau });
    if (error) throw error;
  },

  // ⚠️ Même garde-fou que `changePassword`, et pour une raison plus forte
  // encore : l'adresse du compte est ce qui permet de reprendre la main
  // dessus. Quelqu'un qui la détourne sur la sienne s'empare du compte pour de
  // bon, mot de passe oublié compris.
  //
  // ⚠️ `emailRedirectTo` pointe vers /auth/confirmer, jamais /auth/callback :
  // le lien doit fonctionner depuis n'importe quel appareil.
  changeEmail: async (motDePasse, nouvelle) => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const email = useAuthStore.getState().user?.email;
    if (!email) throw new Error('Connectez-vous pour changer votre adresse.');
    if (nouvelle.toLowerCase() === email.toLowerCase()) {
      throw new Error('Cette adresse est déjà celle du compte.');
    }

    const { error: refus } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (refus) throw new Error('Mot de passe actuel incorrect.');

    const { error } = await supabase.auth.updateUser(
      { email: nouvelle },
      { emailRedirectTo: `${window.location.origin}/auth/confirmer?next=/compte` },
    );
    if (error) throw error;
  },

  // `scope: 'others'` et non `'global'` : la personne qui ferme les autres
  // sessions veut rester connectée ici, sinon elle se déconnecterait elle-même
  // en cherchant à se protéger.
  signOutOthers: async () => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) throw error;
  },

  // La suppression exige la clé d'administration : elle passe donc par une
  // route serveur, qui lit l'identité dans la session (voir
  // /api/compte/supprimer). Le nettoyage local reprend celui de `signOut`.
  deleteAccount: async () => {
    const reponse = await fetch('/api/compte/supprimer', { method: 'POST' });
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}));
      throw new Error(corps.error ?? 'Suppression impossible.');
    }
    await useAuthStore.getState().signOut();
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

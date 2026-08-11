'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/state/authStore';

/** Hydrate le store d'authentification au montage. Sans ce composant,
 *  `isLoading` reste `true` et l'UI affiche « Chargement… » indéfiniment. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useAuthStore.getState().initAuth();
  }, []);
  return <>{children}</>;
}

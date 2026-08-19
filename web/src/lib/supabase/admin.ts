import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client à droits d'administration. **Serveur uniquement** : la clé
 * `SUPABASE_SERVICE_ROLE_KEY` contourne toutes les politiques RLS. Elle ne
 * porte volontairement pas le préfixe NEXT_PUBLIC_, sans quoi Next.js
 * l'embarquerait dans le paquet envoyé au navigateur.
 *
 * La garde `typeof window` ci-dessous n'est pas décorative : si un composant
 * client importe ce fichier un jour, l'erreur est immédiate et nommée, au lieu
 * d'un `null` silencieux qu'on mettrait des heures à comprendre. Le paquet
 * `server-only` ferait mieux — au moment du build — mais il n'est pas installé
 * et ce plan n'ajoute aucune dépendance.
 *
 * Renvoie `null` quand la clé est absente : l'app tourne alors en mode dégradé
 * plutôt que de refuser de démarrer — c'est le cas d'un poste de développement
 * ou d'une installation 100 % locale.
 */
export function createAdminClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error(
      "createAdminClient() est réservé au serveur : ne l'importez pas depuis un composant client.",
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return createClient(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

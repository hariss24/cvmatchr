import { createBrowserClientHelper } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Panne d'accès aux données : pas de réseau, refus du serveur, session absente.
 *
 * Levée et non avalée, à dessein. `db.ts` rendait jusqu'ici `[]` ou `null` en
 * cas d'échec : une liste vide et une panne devenaient indiscernables, et
 * l'interface annonçait le succès d'écritures refusées (bug 37e4f4a).
 */
export class RemoteError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RemoteError';
  }
}

export async function requireRemote(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createBrowserClientHelper();
  if (!supabase) throw new RemoteError("Le service de données n'est pas configuré.");
  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id;
  if (!userId) throw new RemoteError('Connectez-vous pour accéder à vos données.');
  return { supabase, userId };
}

export async function currentUserId(): Promise<string | null> {
  const supabase = createBrowserClientHelper();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

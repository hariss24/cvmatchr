import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

/** Renvoie `null` si Supabase n'est pas configuré. */
export async function createServerClientHelper(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : les cookies y sont en lecture seule.
        }
      },
    },
  });
}

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

let cachedClient: SupabaseClient | null = null;

/** Renvoie `null` si Supabase n'est pas configuré : l'appelant doit gérer ce cas. */
export function createBrowserClientHelper(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const env = getSupabaseEnv();
  if (!env) return null;
  cachedClient = createBrowserClient(env.url, env.anonKey);
  return cachedClient;
}

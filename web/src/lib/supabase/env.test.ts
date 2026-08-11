import { describe, it, expect, beforeEach } from 'vitest';
import { isSupabaseConfigured, getSupabaseEnv } from './env';

describe("Garde d'environnement Supabase", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('signale une configuration absente sans lever', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseEnv()).toBeNull();
  });

  it('renvoie les valeurs quand les deux variables sont présentes', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key-test',
    });
  });

  it('considère une seule variable comme non configuré', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(isSupabaseConfigured()).toBe(false);
  });
});

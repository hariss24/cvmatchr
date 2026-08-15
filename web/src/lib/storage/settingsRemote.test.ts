import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_TEMPLATES } from '@/lib/templates/defaults';

let authUser: string | null = 'u-1';
const queryResult: Record<string, unknown> = {};

const fakeQuery = {
  select: () => fakeQuery,
  eq: (_col: string, val: string) => {
    if (val === 'profile') {
      return {
        single: () => Promise.resolve({
          data: queryResult.profile ? { id: 'profile', content: queryResult.profile } : null,
          error: queryResult.profile ? null : { code: 'PGRST116' },
        }),
      };
    }
    if (val === 'jobProfile') {
      return {
        single: () => Promise.resolve({
          data: queryResult.jobProfile ? { id: 'jobProfile', content: queryResult.jobProfile } : null,
          error: queryResult.jobProfile ? null : { code: 'PGRST116' },
        }),
      };
    }
    return fakeQuery;
  },
  order: () => Promise.resolve({ data: queryResult.templates ?? [], error: null }),
  single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
  upsert: (row: Record<string, unknown>) => {
    if (row.id === 'profile') queryResult.profile = row.content;
    if (row.id === 'jobProfile') queryResult.jobProfile = row.content;
    return Promise.resolve({ error: null });
  },
  delete: () => fakeQuery,
};

vi.mock('./remote', async () => {
  const actual = await vi.importActual<typeof import('./remote')>('./remote');
  return {
    ...actual,
    requireRemote: vi.fn(async () => {
      if (!authUser) throw new actual.RemoteError('Non connecté');
      return {
        supabase: { from: () => fakeQuery },
        userId: authUser,
      };
    }),
    currentUserId: vi.fn(async () => authUser),
  };
});

import { loadProfile, saveProfile, listTemplates } from './db';
import { cacheClear } from './sessionCache';

beforeEach(() => {
  vi.clearAllMocks();
  cacheClear();
  authUser = 'u-1';
  delete queryResult.profile;
  delete queryResult.jobProfile;
  delete queryResult.templates;
});

describe('réglages et modèles distants', () => {
  it('loadProfile renvoie null si non connecté (pas d\'erreur levée)', async () => {
    authUser = null;
    const p = await loadProfile();
    expect(p).toBeNull();
  });

  it('saveProfile puis loadProfile renvoient le profil avec invalidation de la mémoire', async () => {
    await saveProfile({
      id: 'me',
      prenom: 'Ada',
      nom: 'Lovelace',
      email: 'ada@example.com',
      telephone: '0600000000',
      ville: 'Paris',
      linkedin: '',
      updatedAt: 0,
    });
    const p = await loadProfile();
    expect(p?.prenom).toBe('Ada');
    expect(p?.nom).toBe('Lovelace');
  });

  it('listTemplates sans compte renvoie les DEFAULT_TEMPLATES', async () => {
    authUser = null;
    const tpls = await listTemplates();
    expect(tpls.length).toBe(DEFAULT_TEMPLATES.length);
    expect(tpls[0].id).toBe(DEFAULT_TEMPLATES[0].id);
  });
});

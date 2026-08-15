import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Resume } from '@/lib/resume/schema';

let authUser: string | null = 'u-1';
let masterDoc: Record<string, unknown> | null = null;

const fakeQuery = {
  select: () => fakeQuery,
  eq: (_col: string, val: string) => {
    if (val === 'master') {
      return {
        single: () => Promise.resolve({
          data: masterDoc,
          error: masterDoc ? null : { code: 'PGRST116' },
        }),
      };
    }
    return fakeQuery;
  },
  single: () => Promise.resolve({
    data: masterDoc,
    error: masterDoc ? null : { code: 'PGRST116' },
  }),
  upsert: (row: Record<string, unknown>) => {
    masterDoc = row;
    return Promise.resolve({ error: null });
  },
  delete: () => {
    masterDoc = null;
    return fakeQuery;
  },
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

import { loadMasterResume, saveMasterResume, clearMasterResume } from './master';
import { cacheClear } from './sessionCache';

beforeEach(() => {
  vi.clearAllMocks();
  cacheClear();
  authUser = 'u-1';
  masterDoc = null;
});

const SAMPLE_RESUME = {
  name: 'Hariss Maître',
  title: 'Lead Architect',
  email: 'h@example.com',
  phone: '0600000000',
  location: 'Lyon',
  about: 'Expert fullstack',
  experiences: [],
  education: [],
  skills: [],
} as unknown as Resume;

describe('CV Maître distant', () => {
  it('loadMasterResume() sans compte renvoie null', async () => {
    authUser = null;
    const master = await loadMasterResume();
    expect(master).toBeNull();
  });

  it('saveMasterResume() puis loadMasterResume() renvoient le CV maître', async () => {
    await saveMasterResume(SAMPLE_RESUME, 'sobre');
    const master = await loadMasterResume();
    expect(master?.name).toBe('Hariss Maître');
    expect(master?.title).toBe('Lead Architect');
  });

  it('clearMasterResume() supprime le CV maître et invalide la mémoire', async () => {
    await saveMasterResume(SAMPLE_RESUME, 'sobre');
    expect(await loadMasterResume()).not.toBeNull();

    await clearMasterResume();
    expect(await loadMasterResume()).toBeNull();
  });
});

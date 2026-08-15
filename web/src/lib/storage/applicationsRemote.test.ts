import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectSpy = vi.fn();
let queryResult: unknown = [];
const fakeQuery = {
  select: (cols: string) => { selectSpy(cols); return fakeQuery; },
  eq: () => fakeQuery,
  order: () => Promise.resolve({ data: queryResult, error: null }),
  single: () => Promise.resolve({ data: (queryResult as unknown[])[0] ?? null, error: null }),
  upsert: () => Promise.resolve({ error: null }),
  delete: () => fakeQuery,
  in: () => Promise.resolve({ error: null }),
  lt: () => Promise.resolve({ error: null }),
};

vi.mock('./remote', async () => {
  const actual = await vi.importActual<typeof import('./remote')>('./remote');
  return {
    ...actual,
    requireRemote: vi.fn(async () => ({
      supabase: { from: () => fakeQuery },
      userId: 'u-1',
    })),
  };
});

import { listApplicationsRaw, putApplication, listJobs } from './db';
import { cacheClear } from './sessionCache';

beforeEach(() => {
  vi.clearAllMocks();
  cacheClear();
  queryResult = [];
});

describe('candidatures et offres distantes', () => {
  it('une candidature enregistrée invalide la mémoire des candidatures', async () => {
    await listApplicationsRaw();
    await putApplication({
      id: 'a-1',
      createdAt: 0,
      company: 'ACME',
      role: 'Dev',
      normKey: 'acme|dev',
      jobText: '',
      jobUrl: '',
      source: 'manual',
      events: [],
      notes: '',
      updatedAt: 0,
    });
    await listApplicationsRaw();
    expect(selectSpy).toHaveBeenCalledTimes(2); // et non 1 : la mémoire a été jetée
  });

  it('la liste des offres n\'est pas invalidée par une écriture de candidature', async () => {
    await listJobs();
    await putApplication({
      id: 'a-2',
      createdAt: 0,
      company: 'B',
      role: 'C',
      normKey: 'b|c',
      jobText: '',
      jobUrl: '',
      source: 'manual',
      events: [],
      notes: '',
      updatedAt: 0,
    });
    await listJobs();
    expect(selectSpy).toHaveBeenCalledTimes(1); // la mémoire des offres a survécu
  });
});

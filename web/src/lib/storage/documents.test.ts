import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectSpy = vi.fn();
const fakeQuery = {
  select: (cols: string) => { selectSpy(cols); return fakeQuery; },
  eq: () => fakeQuery,
  order: () => Promise.resolve({ data: [], error: null }),
  single: () => Promise.resolve({ data: null, error: null }),
  upsert: () => Promise.resolve({ error: null }),
  delete: () => fakeQuery,
  in: () => Promise.resolve({ error: null }),
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

import { listHistoryEntries, getHistoryEntry } from './db';
import { cacheClear } from './sessionCache';

beforeEach(() => { vi.clearAllMocks(); cacheClear(); });

describe('documents', () => {
  it('le catalogue ne demande jamais le contenu', async () => {
    await listHistoryEntries();
    const colonnes = selectSpy.mock.calls[0][0] as string;
    expect(colonnes).not.toContain('content');
    expect(colonnes).toContain('id');
    expect(colonnes).toContain('doc_type');
  });

  it('le détail demande le contenu', async () => {
    await getHistoryEntry('doc-1');
    const colonnes = selectSpy.mock.calls[0][0] as string;
    expect(colonnes === '*' || colonnes.includes('content')).toBe(true);
  });

  it('deux catalogues d\'affilée ne font qu\'un appel au serveur', async () => {
    await listHistoryEntries();
    await listHistoryEntries();
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });
});

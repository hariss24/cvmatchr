import { describe, it, expect } from 'vitest';
import { toIso, pendingPush, markDeleted } from './syncFields';

describe('Champs de synchronisation', () => {
  it('normalise un timestamp numérique en ISO', () => {
    expect(toIso(1754784000000)).toBe(new Date(1754784000000).toISOString());
  });
  it('laisse une chaîne ISO inchangée', () => {
    expect(toIso('2026-08-10T00:00:00.000Z')).toBe('2026-08-10T00:00:00.000Z');
  });
  it('retient les éléments jamais synchronisés', () => {
    const items = [
      { id: '1', updated_at: '2026-08-10T00:00:00Z', synced_at: null },
      { id: '2', updated_at: '2026-08-10T00:00:00Z', synced_at: '2026-08-10T01:00:00Z' },
      { id: '3', updated_at: '2026-08-10T02:00:00Z', synced_at: '2026-08-10T01:00:00Z' },
    ];
    expect(pendingPush(items).map((i) => i.id)).toEqual(['1', '3']);
  });
  it('marque une suppression sans effacer la ligne', () => {
    const item: { id: string; updated_at: string; synced_at: string | null; deleted_at?: string | null } = {
      id: '1', updated_at: '2026-01-01T00:00:00Z', synced_at: 'x'
    };
    const marked = markDeleted(item);
    expect(marked.deleted_at).not.toBeNull();
    expect(marked.synced_at).toBeNull();
    expect(marked.id).toBe('1');
  });
});

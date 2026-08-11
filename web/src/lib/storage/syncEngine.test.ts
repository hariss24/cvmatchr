import { describe, it, expect } from 'vitest';
import { resolveConflict, sanitizeImportedItem } from './syncEngine';

describe('SyncEngine', () => {
  it('garde la version la plus récente en cas de conflit', () => {
    const local = { id: '1', updated_at: '2026-08-10T02:00:00Z' };
    const remote = { id: '1', client_updated_at: '2026-08-10T01:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('local');
  });

  it('garde la version distante si elle est plus récente', () => {
    const local = { id: '1', updated_at: '2026-08-10T01:00:00Z' };
    const remote = { id: '1', client_updated_at: '2026-08-10T03:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('remote');
  });

  it('remet synced_at à null et rafraîchit updated_at à l\'import', () => {
    const raw = { id: 'old', synced_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    const s = sanitizeImportedItem(raw);
    expect(s.synced_at).toBeNull();
    expect(new Date(s.updated_at).getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
  });

  it('préserve deleted_at à l\'import (une suppression importée reste une suppression)', () => {
    const raw = { id: 'x', updated_at: '2026-01-01T00:00:00Z', deleted_at: '2026-01-02T00:00:00Z' };
    expect(sanitizeImportedItem(raw).deleted_at).toBe('2026-01-02T00:00:00Z');
  });
});

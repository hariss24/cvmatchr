/** Champs de synchronisation ajoutés à toutes les entités répliquées. */
export interface SyncMeta {
  /** Horloge du client, ISO. Arbitre les conflits (last-write-wins). */
  updated_at: string;
  /** Dernière réplication réussie. `null` = jamais envoyé. */
  synced_at?: string | null;
  /** Suppression douce : la ligne survit pour que la suppression se propage. */
  deleted_at?: string | null;
}

/** Les tables du projet mélangent timestamps numériques et chaînes ISO. */
export function toIso(value: string | number): string {
  return typeof value === 'number' ? new Date(value).toISOString() : value;
}

export function pendingPush<T extends { id: string; synced_at?: string | null; updated_at?: string; updatedAt?: number }>(items: T[]): T[] {
  return items.filter((i) => {
    const itemUpdate = i.updated_at ? i.updated_at : i.updatedAt ? new Date(i.updatedAt).toISOString() : new Date().toISOString();
    return !i.synced_at || new Date(itemUpdate).getTime() > new Date(i.synced_at).getTime();
  });
}

export function touch<T>(item: T): T {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const obj = item as Record<string, unknown>;
  const patch: Record<string, unknown> = { synced_at: null };
  if ('updated_at' in obj || !('updatedAt' in obj)) {
    patch.updated_at = nowIso;
  }
  if ('updatedAt' in obj) {
    patch.updatedAt = nowMs;
  }
  return { ...item, ...patch } as T;
}

export function markDeleted<T>(item: T): T {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const obj = item as Record<string, unknown>;
  const patch: Record<string, unknown> = { deleted_at: nowIso, synced_at: null };
  if ('updated_at' in obj || !('updatedAt' in obj)) {
    patch.updated_at = nowIso;
  }
  if ('updatedAt' in obj) {
    patch.updatedAt = nowMs;
  }
  return { ...item, ...patch } as T;
}

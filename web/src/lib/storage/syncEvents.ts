/**
 * Signal émis quand une synchronisation descendante a modifié des données
 * locales. Les écrans qui lisent IndexedDB une fois au montage s'y abonnent :
 * sans ça, les données arrivées en tâche de fond ne s'affichent qu'après F5.
 *
 * Pas de `dexie-react-hooks` : ce serait une dépendance npm, interdite par le
 * cadrage sans instruction explicite.
 */
type SyncListener = () => void;

const listeners = new Set<SyncListener>();

export function onSyncChange(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSyncChange(): void {
  // Copie : un abonné peut se désabonner pendant l'émission.
  for (const listener of [...listeners]) listener();
}

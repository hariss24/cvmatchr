/**
 * Mémoire de session du comptoir : ce que le serveur vient de rendre, réutilisé
 * le temps de la navigation, revérifié en arrière-plan par les appelants.
 *
 * Trois propriétés qui la rendent sûre, à ne pas casser :
 * 1. Elle n'est écrite NULLE PART sur le disque — elle meurt avec l'onglet.
 *    Elle ne peut donc pas montrer les données d'un compte au compte suivant.
 * 2. Toute écriture invalide ce qu'elle touche (`cacheInvalidate`). Le comptoir
 *    étant le seul chemin vers les données, l'invalidation est centralisée.
 * 3. Ce n'est PAS une source de vérité. En cas de doute, le serveur tranche.
 *
 * Volontairement sans React Query ni SWR : dépendance npm interdite par le
 * cadrage, et le besoin tient ici en quelques lignes.
 */
const store = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  return store.has(key) ? (store.get(key) as T) : undefined;
}

export function cacheSet<T>(key: string, value: T): void {
  store.set(key, value);
}

export function cacheInvalidate(prefix: string): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}

/**
 * Accès réseau commun aux sources d'offres.
 *
 * Les trois sources interrogent leur API une fois par mot-clé. Menées à la queue
 * leu leu, ces requêtes additionnaient leurs latences : à huit postes recherchés,
 * le scan durait 44 s, dictés par JSearch seule (~5 s la requête). Les mener de
 * front supprime l'addition — mais pas toutes à la fois : une rafale de huit
 * requêtes se fait rejeter en 429, et France Travail limite ses appels par seconde.
 */

/** Requêtes menées de front. Au-delà, les API commencent à refuser la rafale. */
export const PARALLELE = 4;

/**
 * Délai au-delà duquel une requête est abandonnée. Sans lui, une seule requête
 * restée en suspens fige le scan entier. Large devant les latences habituelles
 * (0,3 à 5 s selon la source) : il doit rattraper les blocages, pas les lenteurs.
 */
export const DELAI_MAX_MS = 15_000;

/**
 * Applique `travail` à chaque élément, par vagues de `PARALLELE` menées de front.
 *
 * Les résultats reviennent dans l'ordre des éléments, jamais dans celui des
 * réponses : à offre dédoublonnée, c'est toujours la même qui est retenue, quelle
 * que soit la requête arrivée la première.
 */
export async function parVagues<T, R>(items: T[], travail: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += PARALLELE) {
    out.push(...(await Promise.all(items.slice(i, i + PARALLELE).map((x) => travail(x)))));
  }
  return out;
}

/** `fetch` abandonné au-delà de `DELAI_MAX_MS` ; jette alors comme une panne réseau. */
export async function fetchDelai(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MAX_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

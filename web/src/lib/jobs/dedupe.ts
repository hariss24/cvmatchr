/**
 * Dédoublonnage inter-source. Une même offre peut remonter de deux sources avec
 * des identifiants différents (un partenaire d'Adzuna republie une offre France
 * Travail ; Google indexe les deux) : le dédoublonnage par id ne peut rien.
 *
 * On réutilise `normKey(entreprise, poste)`, déjà éprouvée par le tracker de
 * candidatures. Ce choix accepte un risque connu : deux postes réellement
 * distincts au même intitulé dans la même entreprise fusionnent. C'est le
 * compromis déjà retenu côté candidatures, sans problème en usage réel.
 *
 * Appelé AVANT le pré-tri, donc avant tout appel IA : deux publications de la
 * même offre ne consomment jamais deux notations.
 */

import { normKey } from "@/lib/applications/normKey";
import type { JobOffer, SourceId } from "./offer";

/**
 * France Travail d'abord (description la plus complète, lien direct), puis le
 * marché caché (lien vers le board de l'entreprise, sans intermédiaire), puis
 * JSearch (apporte le logo), puis Adzuna. Plus petit = prioritaire.
 */
const PRIORITY: Record<SourceId, number> = { francetravail: 0, boards: 1, jsearch: 2, adzuna: 3 };

export function dedupeOffers(offers: JobOffer[]): JobOffer[] {
  const best = new Map<string, JobOffer>();
  const out: JobOffer[] = [];

  for (const offer of offers) {
    const key = normKey(offer.company, offer.title);
    // Sans entreprise ni poste exploitables, aucune fusion possible : on garde.
    if (!key) {
      out.push(offer);
      continue;
    }
    const current = best.get(key);
    if (!current) {
      best.set(key, offer);
      continue;
    }
    const winner = PRIORITY[offer.source] < PRIORITY[current.source] ? offer : current;
    const loser = winner === offer ? current : offer;
    // Le gagnant reste la référence, mais récupère le logo du perdant s'il n'en
    // a pas : garder la meilleure description en jetant la seule information
    // visuelle disponible serait absurde.
    best.set(key, winner.logoUrl ? winner : { ...winner, logoUrl: loser.logoUrl });
  }

  return [...out, ...best.values()];
}

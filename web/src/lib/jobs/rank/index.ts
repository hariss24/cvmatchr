/**
 * Classement d'une offre : score sur 100 puis lettre.
 *
 * Entièrement local et déterministe — aucun appel réseau, aucune dépendance au
 * lot analysé. C'est cette dernière propriété qui rend les lettres ABSOLUES :
 * une offre en A aujourd'hui reste en A demain, condition pour filtrer et
 * comparer dans le temps (spec §3.1). C'est aussi ce qui exclut BM25, dont la
 * pondération se calcule sur le corpus courant.
 */

import type { JobOffer } from "../offer";
import type { JobSearchProfile } from "../profile";
import { buildRomeTargets } from "../rome";
import type { LatLng } from "../geo";
import {
  competencesPoints, metierPoints, distanceLigne, contratSalairePoints,
  experiencePoints, malusHorsSujet, malusSignaux,
  type Ligne, type RankContext,
} from "./criteria";

export type { Ligne, RankContext } from "./criteria";
export { MAX } from "./criteria";

// Réexport du module feuille : les modules qui classent réellement importent
// tout depuis `rank/`, ceux qui ne veulent que la lettre importent `grade.ts`.
import { GRADE_ORDER, DEFAULT_THRESHOLDS, gradeOf } from "../grade";
import type { Grade, GradeThresholds } from "../grade";

export { GRADE_ORDER, DEFAULT_THRESHOLDS, gradeOf };
export type { Grade, GradeThresholds };

export interface RankResult {
  score: number;
  grade: Grade;
  breakdown: Ligne[];
}

/** Prépare le contexte une seule fois par scan (le référentiel ROME est lourd). */
export function buildRankContext(profile: JobSearchProfile, home: LatLng | null): RankContext {
  return { rome: buildRomeTargets(profile.romeCodes), home };
}

/**
 * Note une offre. `maintenant` est injecté pour que les tests restent
 * déterministes ; en production il vaut l'heure courante.
 */
export function rankOffer(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
  maintenant: number = Date.now(),
): RankResult {
  const breakdown: Ligne[] = [
    competencesPoints(offer, profile, ctx),
    metierPoints(offer, profile, ctx),
    distanceLigne(offer, profile, ctx),
    contratSalairePoints(offer, profile),
    experiencePoints(offer, profile),
    malusHorsSujet(offer, ctx),
    malusSignaux(offer, profile, maintenant),
  ];

  const brut = breakdown.reduce((t, l) => t + l.points, 0);
  const score = Math.max(0, Math.min(100, brut));

  return { score, grade: gradeOf(score, profile.gradeThresholds), breakdown };
}

/**
 * Point de passage unique de la décision « on enregistre ou pas ».
 *
 * Aujourd'hui : on garde TOUT. Le classement étant gratuit, plus rien ne
 * justifie de jeter une offre — c'est ce qui privait l'utilisateur de la
 * visibilité sur le volume réel de ses sources.
 *
 * Cette fonction existe pour qu'un futur seuil de rejet réglable s'y branche
 * sans réécriture (spec §3.5). Ne PAS y ajouter de logique tant que ce seuil
 * n'est pas demandé.
 */
export function shouldPersist(_result: RankResult, _profile: JobSearchProfile): boolean {
  return true;
}

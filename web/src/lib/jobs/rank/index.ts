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
  experiencePoints, malusHorsSujet, malusSignaux, TEXTE_CONCLUANT,
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

/** Prépare le contexte une seule fois par scan (le référentiel ROME est lourd, chargé à la demande). */
export async function buildRankContext(profile: JobSearchProfile, home: LatLng | null): Promise<RankContext> {
  return { rome: await buildRomeTargets(profile.romeCodes), home };
}

/**
 * Sort le critère « compétences » de l'enveloppe quand la source ne permet pas
 * de le mesurer — il pèse alors `max: 0` et le score se calcule au prorata du
 * reste, au lieu d'imputer à l'offre un zéro qu'elle n'a pas mérité.
 *
 * Mesuré en conditions réelles : sur 12 offres Adzuna, dont cinq « Webmaster »
 * pour une recherche « Webmaster », le critère trouvait zéro compétence partout,
 * la description étant tronquée à 500 caractères par la source. Aucune offre ne
 * dépassait C : les 45 points manquaient à tout le monde.
 *
 * Trois garde-fous, chacun contre une façon de faire remonter du bruit :
 *
 * - L'offre doit avoir prouvé sa pertinence autrement (`metier > 0`). Sans quoi
 *   un comptable profiterait du prorata sans avoir montré aucun signe d'être le
 *   poste cherché.
 * - Aucun code ROME : lorsqu'il existe, on sait déjà trancher, et le bénéfice du
 *   doute annulerait le malus hors-sujet. Une offre « Conseiller en formation
 *   webmaster » classée K2101 doit rester au fond.
 * - Description trop courte pour conclure : sur un texte complet, ne rien
 *   trouver reste une vraie information et doit continuer à coûter.
 */
function beneficeDuDoute(competences: Ligne, metier: Ligne, offer: JobOffer): Ligne {
  const illisible =
    competences.points === 0 &&
    metier.points > 0 &&
    !offer.romeCode &&
    offer.jobText.length < TEXTE_CONCLUANT;

  return illisible
    ? { ...competences, points: 0, max: 0, reason: "" }
    : competences;
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
  const competences = competencesPoints(offer, profile, ctx);
  const metier = metierPoints(offer, profile, ctx);

  const breakdown: Ligne[] = [
    beneficeDuDoute(competences, metier, offer),
    metier,
    distanceLigne(offer, profile, ctx),
    contratSalairePoints(offer, profile),
    experiencePoints(offer, profile),
    malusHorsSujet(offer, ctx),
    malusSignaux(offer, profile, maintenant),
  ];

  // Le score est un prorata de l'enveloppe réellement mesurable, pas une somme
  // brute : un critère que la source ne permet pas d'évaluer porte `max: 0` et
  // sort du calcul au lieu d'y peser un zéro qu'il n'a pas mérité. Sans cela,
  // les 45 points de « compétences » manquaient à toutes les offres Adzuna et
  // aucune ne dépassait C. Les malus, eux, portent aussi `max: 0` mais se
  // retranchent en valeur absolue — une pénalité ne se dilue pas.
  const enveloppe = breakdown.reduce((t, l) => t + l.max, 0);
  const acquis = breakdown.reduce((t, l) => (l.max > 0 ? t + l.points : t), 0);
  const malus = breakdown.reduce((t, l) => (l.max === 0 ? t + l.points : t), 0);

  const brut = enveloppe > 0 ? Math.round((100 * acquis) / enveloppe) + malus : 0;
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

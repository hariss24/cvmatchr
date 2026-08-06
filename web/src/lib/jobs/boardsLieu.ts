/**
 * Filtre géographique de la source « Marché caché ».
 *
 * Les trois autres sources délèguent ce filtre à leur API. Ici il n'y a pas
 * d'API : l'index est local, et deux informations seulement décrivent le lieu.
 *
 *   - des coordonnées, sur 92 % des offres (18 019 sur 19 555, mesuré le
 *     06/08/2026). SmartRecruiters est le seul ATS à en fournir, ce qui ne
 *     couvrait que 31 % de l'index ; les autres sont obtenues en géocodant les
 *     libellés à la construction — voir `scripts/boards/geo.mjs`. Avant cela,
 *     le rayon était inopérant pour deux offres sur trois : une recherche
 *     lyonnaise ne voyait pas les 82 offres de Villeurbanne, et 884 offres de
 *     banlieue manquaient sur cinq agglomérations ;
 *   - un libellé libre, présent sur toutes.
 *
 * D'où deux voies : la distance réelle quand les coordonnées existent, le
 * rapprochement de libellés sinon. Une offre sans lieu ET sans coordonnées est
 * gardée — l'absence d'information n'est pas une preuve d'éloignement, même
 * règle que pour les dates.
 */

import { haversineKm, type LatLng } from "./geo";
import type { LocationFilter } from "./profile";

/** Minuscule sans accent, tirets et espaces unifiés. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Nom de lieu exploitable, extrait du libellé affiché dans l'UI.
 *
 * Les libellés viennent de l'autocomplétion et portent des décorations que
 * l'index ne connaît pas : « Paris 12e (75012) » doit devenir « paris », sans
 * quoi aucune offre parisienne ne serait reconnue.
 */
export function villeDuLibelle(label: string): string {
  const sansCode = label.replace(/\([^)]*\)/g, " ");
  const sansArrondissement = sansCode.replace(/\b\d+\s*(?:er|e|eme|ème)\b/gi, " ");
  return normalize(sansArrondissement);
}

/** L'offre est-elle dans le périmètre demandé ? */
export function dansLeSecteur(
  offre: { lieu: string; lat?: number; lng?: number },
  filtre: LocationFilter,
  cible: LatLng | null,
): boolean {
  // Pas de lieu demandé : recherche nationale, tout passe.
  if (!filtre.code) return true;

  const nom = villeDuLibelle(filtre.label);
  const aDesCoords = offre.lat !== undefined && offre.lng !== undefined;

  // Le rayon n'a de sens qu'autour d'une commune : un département ou une région
  // est déjà une étendue, y ajouter des kilomètres ne veut rien dire.
  if (filtre.kind === "commune" && cible && aDesCoords) {
    return haversineKm(cible, { lat: offre.lat as number, lng: offre.lng as number }) <= Math.max(1, filtre.radiusKm);
  }

  if (!offre.lieu) return true;
  if (!nom) return true;
  return normalize(offre.lieu).includes(nom);
}

import type { JobOffer } from "./offer";

/** Minuscule + suppression des accents pour une comparaison robuste. */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * True si l'offre contient au moins un des mots-clés à inclure (titre + description).
 * Liste vide → aucun filtre (true). Comparaison insensible à la casse et aux accents.
 */
export function matchesIncludeKeywords(offer: JobOffer, includeKeywords: string[]): boolean {
  if (includeKeywords.length === 0) return true;
  const hay = normalize(`${offer.title} ${offer.jobText}`);
  return includeKeywords.some((w) => w.trim() !== "" && hay.includes(normalize(w)));
}

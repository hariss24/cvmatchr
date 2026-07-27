import type { JobSearchProfile } from "./profile";

/**
 * Résumé des critères actifs, affiché en une ligne sur l'écran principal.
 * Il rend le panneau inutile en usage courant : on voit ses réglages sans
 * avoir à les ouvrir (cf. spec §5.1).
 */
export function summarizeProfile(p: JobSearchProfile): string[] {
  const parts: string[] = [];

  if (p.keywords.length > 0) parts.push(...p.keywords);
  else parts.push("Aucun poste renseigné");

  if (p.location.label) {
    // Le rayon n'a de sens que pour une commune (cf. LocationFilter).
    parts.push(p.location.kind === "commune" ? `${p.location.label} + ${p.location.radiusKm} km` : p.location.label);
  } else {
    parts.push("Toute la France");
  }

  if (p.contractTypes.length > 0) parts.push(p.contractTypes.join(", "));
  return parts;
}

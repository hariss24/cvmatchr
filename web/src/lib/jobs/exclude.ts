/**
 * Filtre stages/alternances, partagé par les trois sources. Extrait de
 * `francetravail.ts`, où il était couplé au type d'offre brute France Travail.
 */

/** Minuscule + suppression des accents (aligné sur includeFilter). */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** True si le texte contient un mot interdit, ou « stage » en mot isolé. */
export function isExcludedText(text: string, excludedWords: string[]): boolean {
  const t = norm(text);
  if (excludedWords.some((w) => w.trim() !== "" && t.includes(norm(w)))) return true;
  // "stage" en mot isolé (les tirets comptent comme séparateurs).
  return t.replace(/-/g, " ").split(/\s+/).includes("stage");
}

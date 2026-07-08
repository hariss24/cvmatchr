/**
 * Moteur de substitution des modèles de lettre/email.
 * Syntaxe : `{Variable}` ou `{Variable|repli}` (repli utilisé si la valeur est vide).
 * Une variable absente de `vars` (inconnue) est laissée telle quelle.
 */

export type TemplateVars = Record<string, string>;

/** Les variables proposées dans l'UI (boutons d'insertion). */
export const TEMPLATE_VARIABLES = [
  "Entreprise", "Poste", "M/Mme Nom", "Prénom", "Nom", "Date",
] as const;

const VAR_RE = /\{([^{}|]+)(?:\|([^{}]*))?\}/g;

export function renderTemplate(text: string, vars: TemplateVars): string {
  const out = text.replace(VAR_RE, (match, name: string, fallback?: string) => {
    const value = vars[name];
    if (value === undefined) return match; // variable inconnue : laisser tel quel
    if (value.trim()) return value;
    return fallback ?? "";
  });
  // Nettoyage : espaces (pas les \n) en double, espace avant ponctuation, fins de ligne.
  return out
    .replace(/ {2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/ +$/gm, "");
}

/**
 * Détection de l'ATS (logiciel de recrutement) d'une entreprise.
 *
 * La plupart des entreprises ne codent pas leur page carrières : elles louent
 * Greenhouse, Lever, etc., qui exposent chaque board en JSON public. Savoir
 * quelle entreprise utilise quoi, c'est la première brique pour aller chercher
 * les offres à la source plutôt que sur les jobboards saturés.
 */

export type AtsProvider = "greenhouse" | "lever";

export type AtsMatch =
  | { ats: AtsProvider; slug: string }
  | { ats: "none"; slug: "" };

/** Aucun ATS trouvé. Constante partagée pour éviter de réécrire le littéral. */
export const NO_ATS: AtsMatch = { ats: "none", slug: "" };

/**
 * Nom d'entreprise ramené à sa forme canonique : minuscules, sans accent, mots
 * séparés par des tirets. Sert de slug candidat ET de clé de cache — une seule
 * définition pour que les deux ne divergent jamais.
 *
 * La plage U+0300–U+036F est celle des diacritiques combinants, isolés par la
 * décomposition NFD : « Société » devient « societe ».
 */
export function normalizeCompany(companyName: string): string {
  return companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs à essayer pour une entreprise, du plus probable au moins probable.
 *
 * Chaque ATS a ses conventions : « Groupe SEB » peut être `groupe-seb` chez l'un
 * et `groupeseb` chez l'autre. On essaie les deux plutôt que de parier.
 */
export function atsSlugs(companyName: string): string[] {
  const base = normalizeCompany(companyName);
  if (!base) return [];

  const colle = base.replace(/-/g, "");
  return colle === base ? [base] : [base, colle];
}

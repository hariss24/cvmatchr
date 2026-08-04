// Nom d'entreprise → slugs candidats pour les boards ATS.
//
// ⚠️ JUMEAU de `normalizeCompany` / `atsSlugs` dans web/src/lib/jobs/ats.ts.
// La duplication est subie : un .mjs ne peut pas importer un .ts, et l'app ne
// peut pas importer depuis scripts/. Les deux copies sont épinglées par des
// vecteurs de test identiques (voir slugs.test.mjs et ats.test.ts).

/**
 * Nom ramené à sa forme canonique : minuscules, sans accent, mots séparés par
 * des tirets. La plage U+0300–U+036F est celle des diacritiques combinants,
 * isolés par la décomposition NFD : « Société » devient « societe ».
 */
export function normaliserNom(nom) {
  return String(nom)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs à essayer, du plus probable au moins probable. Chaque ATS a ses
 * conventions : « Groupe SEB » peut être `groupe-seb` chez l'un et `groupeseb`
 * chez l'autre. On essaie les deux plutôt que de parier.
 */
export function slugsCandidats(nom) {
  const base = normaliserNom(nom);
  if (!base) return [];

  const colle = base.replace(/-/g, "");
  return colle === base ? [base] : [base, colle];
}

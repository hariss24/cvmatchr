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

/** Coupe un endpoint qui ne répond pas : un ATS lent ne doit pas retenir le lot. */
const TIMEOUT_MS = 5_000;

/** True si la réponse décrit un board existant AVEC au moins une offre ouverte. */
async function aDesOffres(res: Response, ats: AtsProvider): Promise<boolean> {
  if (!res.ok) return false;
  try {
    const corps: unknown = await res.json();
    if (ats === "greenhouse") {
      const jobs = (corps as { jobs?: unknown })?.jobs;
      return Array.isArray(jobs) && jobs.length > 0;
    }
    return Array.isArray(corps) && corps.length > 0;
  } catch {
    return false;
  }
}

function url(ats: AtsProvider, slug: string): string {
  return ats === "greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
    : `https://api.lever.co/v0/postings/${slug}?mode=json`;
}

/**
 * Board public de l'entreprise, ou `NO_ATS`.
 *
 * `fetchImpl` est injectable pour que les tests tournent hors-ligne.
 * Cette fonction s'exécute **côté serveur** (route API) : appeler ces endpoints
 * depuis le navigateur dépendrait du bon vouloir CORS de deux services tiers.
 */
export async function resolveAts(
  companyName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AtsMatch> {
  for (const slug of atsSlugs(companyName)) {
    for (const ats of ["greenhouse", "lever"] as const) {
      try {
        const res = await fetchImpl(url(ats, slug), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (await aDesOffres(res, ats)) return { ats, slug };
      } catch {
        // Timeout, DNS, coupure : ce candidat ne matche pas, on passe au suivant.
      }
    }
  }
  return NO_ATS;
}

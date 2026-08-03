/**
 * Détection de l'ATS (logiciel de recrutement) d'une entreprise.
 *
 * La plupart des entreprises ne codent pas leur page carrières : elles louent
 * Greenhouse, Lever, etc., qui exposent chaque board en JSON public. Savoir
 * quelle entreprise utilise quoi, c'est la première brique pour aller chercher
 * les offres à la source plutôt que sur les jobboards saturés.
 */

export type AtsProvider = "greenhouse" | "lever" | "ashby" | "smartrecruiters";

/**
 * Ordre d'interrogation, décidé par une mesure et non par réputation.
 *
 * Sondage du 03/08/2026 sur 49 entreprises françaises (tech et non-tech) :
 * ashby 8, lever 6, smartrecruiters 4, greenhouse 2. Greenhouse, l'ATS le plus
 * connu, est le dernier ici — c'est un outil de start-up américaine.
 * SmartRecruiters est le seul à couvrir les grands employeurs français
 * (Accor 529 offres, Nexton 137, Thales).
 *
 * Workable, Recruitee, Teamtailor et Personio ont été sondés le même jour :
 * zéro entreprise trouvée sur les 49. Workable répond même 200 avec un board
 * vide pour presque n'importe quel nom — un générateur de faux positifs.
 */
export const PROVIDERS: readonly AtsProvider[] = ["ashby", "lever", "smartrecruiters", "greenhouse"];

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

/**
 * Endpoint public de chaque ATS, la façon d'y compter les offres, et l'adresse
 * de la page carrières correspondante.
 *
 * `compte` est la pièce maîtresse : plusieurs ATS répondent 200 pour un board
 * qui n'existe pas ou qui est vide. Seule la présence d'au moins une offre
 * prouve un vrai board — un lien vers une page vide serait pire que rien.
 */
const ENDPOINTS: Record<AtsProvider, {
  api: (slug: string) => string;
  compte: (corps: unknown) => number;
  page: (slug: string) => string;
}> = {
  greenhouse: {
    api: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    compte: (c) => tableau((c as { jobs?: unknown })?.jobs).length,
    page: (s) => `https://job-boards.greenhouse.io/${s}`,
  },
  lever: {
    api: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    compte: (c) => tableau(c).length,
    page: (s) => `https://jobs.lever.co/${s}`,
  },
  ashby: {
    api: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    compte: (c) => tableau((c as { jobs?: unknown })?.jobs).length,
    page: (s) => `https://jobs.ashbyhq.com/${s}`,
  },
  smartrecruiters: {
    // `limit=1` : on ne veut que le compteur `totalFound`, pas les offres.
    api: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`,
    compte: (c) => {
      const n = (c as { totalFound?: unknown })?.totalFound;
      return typeof n === "number" ? n : 0;
    },
    page: (s) => `https://careers.smartrecruiters.com/${s}`,
  },
};

function tableau(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Adresse de la page carrières publique d'un board détecté ; "" si aucun. */
export function boardUrl(match: AtsMatch): string {
  return match.ats === "none" ? "" : ENDPOINTS[match.ats].page(match.slug);
}

/** Nombre d'offres ouvertes sur ce board, 0 si le board n'existe pas. */
async function compterOffres(
  ats: AtsProvider,
  slug: string,
  fetchImpl: typeof fetch,
): Promise<number> {
  try {
    const res = await fetchImpl(ENDPOINTS[ats].api(slug), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return 0;
    return ENDPOINTS[ats].compte(await res.json());
  } catch {
    // Timeout, DNS, coupure, JSON illisible : ce candidat ne compte pas.
    return 0;
  }
}

/**
 * Board public de l'entreprise, ou `NO_ATS`.
 *
 * Les quatre ATS sont interrogés **en parallèle** pour un slug donné : en série,
 * une entreprise inconnue coûtait huit allers-retours avant de renvoyer `none`,
 * et un lot de soixante entreprises dépassait la durée maximale de la route.
 * En cas d'égalité — Doctolib est sur Greenhouse *et* Ashby — l'ordre de
 * `PROVIDERS` tranche.
 *
 * `fetchImpl` est injectable pour que les tests tournent hors-ligne.
 * Cette fonction s'exécute **côté serveur** (route API) : appeler ces endpoints
 * depuis le navigateur dépendrait du bon vouloir CORS de quatre services tiers.
 */
export async function resolveAts(
  companyName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AtsMatch> {
  for (const slug of atsSlugs(companyName)) {
    const comptes = await Promise.all(
      PROVIDERS.map((ats) => compterOffres(ats, slug, fetchImpl)),
    );
    const i = comptes.findIndex((n) => n > 0);
    if (i !== -1) return { ats: PROVIDERS[i], slug };
  }
  return NO_ATS;
}

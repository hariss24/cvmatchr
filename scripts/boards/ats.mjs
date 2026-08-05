// Compter les offres françaises d'un board ATS public.
//
// Ordre décidé par mesure (sondage du 03/08/2026 sur 49 entreprises
// françaises) : ashby 8, lever 6, smartrecruiters 4, greenhouse 2. Greenhouse,
// l'ATS le plus connu, arrive dernier — c'est un outil de start-up américaine.

import { estFrancais } from "./france.mjs";

export const ATS = ["ashby", "lever", "smartrecruiters", "greenhouse"];

/** Coupe un endpoint qui ne répond pas ; 12 requêtes en vol, personne ne nous a invités. */
const TIMEOUT_MS = 15_000;

const ENDPOINTS = {
  greenhouse: {
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    postes: (c) => (c?.jobs ?? []).map((j) => ({ lieu: j?.location?.name ?? "", pays: "" })),
  },
  lever: {
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    // `country` est un code ISO présent sur certains boards seulement : absent
    // chez Loft Orbital, dont les 13 offres « Toulouse, Occitanie » ne tiennent
    // qu'à la détection textuelle.
    postes: (c) => (Array.isArray(c) ? c : []).map((j) => ({
      lieu: j?.categories?.location ?? "",
      pays: j?.country ?? "",
    })),
  },
  ashby: {
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    // Pas de mode léger : testé le 04/08/2026, includeCompensation=false et
    // includeContent=false rendent 1 666 Ko, le poids de l'appel nu.
    postes: (c) => (c?.jobs ?? []).map((j) => ({ lieu: j?.location ?? "", pays: "" })),
  },
  smartrecruiters: {
    // `country=fr` filtre côté serveur et `limit=1` évite de rapatrier le board :
    // `totalFound` donne directement le compte français. Mesuré sur Accor —
    // 530 offres au total, 192 avec le filtre.
    url: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?country=fr&limit=1`,
    compteur: (c) => (typeof c?.totalFound === "number" ? c.totalFound : 0),
  },
};

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tentatives sur un 429 avant d'abandonner le couple. */
const RETRY_MAX = 4;

/**
 * Délai avant de retenter un 429.
 *
 * ⚠️ SmartRecruiters annonce `retry-after: 0`, ce qui reviendrait à repartir
 * aussitôt dans le mur. On plancher donc à 2 s. Mesuré le 05/08/2026 : l'API
 * accepte environ 4 800 requêtes puis refuse tout le reste de la fenêtre.
 */
function delaiRetry(res) {
  const ra = Number(res.headers?.get("retry-after"));
  return Math.max(2000, (Number.isFinite(ra) && ra > 0 ? ra : 0) * 1000);
}

/**
 * Nombre d'offres françaises sur ce board.
 *
 * ⚠️ `null` et `0` ne sont pas interchangeables :
 *   - `0`    → testé, board absent ou sans offre française. C'est un fait.
 *   - `null` → réseau, 5xx, JSON illisible. On ne sait pas, et l'appelant n'a
 *              le droit d'en conclure RIEN — surtout pas de retirer l'entrée
 *              de l'index.
 *
 * Un 429 se retente. Sans cela, un bridage passager se traduisait par un `null`
 * définitif : mesuré le 05/08/2026, une passe de 85 840 couples avait rendu
 * 71 724 indéterminées — 84 % du travail jeté sans que rien ne le signale.
 */
export async function compterFR(ats, slug, fetchImpl = fetch) {
  const e = ENDPOINTS[ats];

  let res;
  for (let essai = 0; essai < RETRY_MAX; essai++) {
    try {
      res = await fetchImpl(e.url(slug), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      return null;
    }
    if (res.status !== 429) break;
    await attendre(delaiRetry(res));
  }

  if (res.status === 404) return 0;
  if (!res.ok) return null;

  let corps;
  try {
    corps = await res.json();
  } catch {
    return null;
  }

  if (e.compteur) return e.compteur(corps);
  return e.postes(corps).filter((p) => estFrancais(p.lieu, p.pays)).length;
}

// Lister les offres françaises LÉGÈRES d'un board ATS — sans texte.
//
// Complète ats.mjs (Brique 1, qui ne fait que COMPTER) sans le modifier : la
// duplication des URLs est assumée pour ne prendre aucun risque de régression
// sur `compterFR`, déjà en production chaque lundi.
//
// Champs vérifiés en direct le 04/08/2026 (curl réel sur onrunning/greenhouse,
// contentsquare/lever, alan/ashby, accor/smartrecruiters) — détail et
// justification dans docs/superpowers/specs/2026-08-04-marche-cache-offres-design.md §3.

import { estFrancais } from "./france.mjs";

const TIMEOUT_MS = 15_000;

/** ISO 8601 si `v` est une date exploitable (chaîne ou epoch ms), "" sinon. */
function dateOuVide(v) {
  if (v === undefined || v === null || v === "") return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Nombre fini si `v` est un nombre ou une chaîne numérique, undefined sinon. */
function nombreOuAbsent(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

const ENDPOINTS = {
  greenhouse: {
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    offres: (c) => (c?.jobs ?? []).map((j) => ({
      id: String(j?.id ?? ""),
      titre: j?.title ?? "",
      lieu: j?.location?.name ?? "",
      pays: "",
      url: j?.absolute_url ?? "",
      publieLe: dateOuVide(j?.updated_at),
    })),
  },
  lever: {
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    offres: (c) => (Array.isArray(c) ? c : []).map((j) => ({
      id: String(j?.id ?? ""),
      titre: j?.text ?? "",
      lieu: j?.categories?.location ?? "",
      pays: j?.country ?? "",
      url: j?.hostedUrl ?? "",
      publieLe: dateOuVide(j?.createdAt),
    })),
  },
  ashby: {
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    offres: (c) => (c?.jobs ?? []).map((j) => ({
      id: String(j?.id ?? ""),
      titre: j?.title ?? "",
      lieu: j?.location ?? "",
      pays: "",
      url: j?.jobUrl ?? "",
      publieLe: dateOuVide(j?.publishedAt),
    })),
  },
};

/** SmartRecruiters : pas de texte dans la liste, `limit` plafonné à 100 par l'API. */
const smartRecruitersUrl = (s, offset) =>
  `https://api.smartrecruiters.com/v1/companies/${s}/postings?country=fr&limit=100&offset=${offset}`;

/** ⚠️ Pas d'URL publique dans la liste : construite et vérifiée en direct (200). */
function offresSmartRecruiters(corps, slug) {
  return (corps?.content ?? []).map((j) => {
    const lat = nombreOuAbsent(j?.location?.latitude);
    const lng = nombreOuAbsent(j?.location?.longitude);
    return {
      id: String(j?.id ?? ""),
      titre: j?.name ?? "",
      lieu: j?.location?.fullLocation ?? "",
      pays: j?.location?.country ?? "",
      url: `https://jobs.smartrecruiters.com/${slug}/${j?.id ?? ""}`,
      publieLe: dateOuVide(j?.releasedDate),
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
    };
  });
}

/**
 * ⚠️ SmartRecruiters pagine par `offset`, pas par `page` — vérifié en direct le
 * 04/08/2026 : page=0,1,2,3 renvoient les mêmes 100 offres, offset=100 renvoie
 * les suivantes. Le premier passage (par page) dupliquait chaque board N fois.
 */
async function listerSmartRecruiters(slug, fetchImpl) {
  const out = [];
  let offset = 0;
  while (true) {
    const res = await fetchImpl(smartRecruitersUrl(slug, offset), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (offset === 0 && res.status === 404) return [];
    if (!res.ok) throw new Error(`smartrecruiters ${slug} offset ${offset} : ${res.status}`);
    const corps = await res.json();
    const content = corps?.content ?? [];
    out.push(...offresSmartRecruiters(corps, slug).filter((o) => estFrancais(o.lieu, o.pays)));
    if (content.length === 0) break;
    offset += content.length;
  }
  return out;
}

/**
 * Offres françaises légères d'un board — même garantie que `compterFR` :
 * une réponse inexploitable (réseau, 5xx, JSON illisible, page en échec en
 * cours de pagination) rend `null`, jamais un résultat partiel.
 */
export async function listerOffresFR(ats, slug, fetchImpl = fetch) {
  try {
    if (ats === "smartrecruiters") return await listerSmartRecruiters(slug, fetchImpl);

    const e = ENDPOINTS[ats];
    const res = await fetchImpl(e.url(slug), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const corps = await res.json();
    return e.offres(corps).filter((o) => estFrancais(o.lieu, o.pays));
  } catch {
    return null;
  }
}

/**
 * Texte complet d'une offre de board, récupéré en direct au moment d'une
 * recherche — jamais committé (spec `2026-08-04-marche-cache-offres-design.md` §4).
 *
 * Greenhouse et SmartRecruiters ont un endpoint par offre : un appel chacun.
 * Lever et Ashby n'en ont pas — leur endpoint liste contient déjà tout le
 * texte (`descriptionPlain`), donc on le refait une fois PAR BOARD TOUCHÉ,
 * jamais par offre : plusieurs candidates du même board ne coûtent qu'un appel.
 */

import { parVagues, fetchDelai } from "./reseau";
import type { OffreLegere } from "./boardsFr";

/**
 * Signature minimale utilisée ici — plus étroite que `typeof fetch` (qui
 * accepte `RequestInfo | URL`) pour que `fetchDelai` (`(url: string, init?) =>
 * Promise<Response>`) soit assignable telle quelle en valeur par défaut, et
 * qu'un `fetch` factice de test n'ait besoin d'aucun cast.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Clé stable d'une offre dans la map de résultats. */
function cleOffre(o: Pick<OffreLegere, "ats" | "slug" | "id">): string {
  return `${o.ats}:${o.slug}:${o.id}`;
}

async function texteGreenhouse(o: OffreLegere, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const res = await fetchImpl(
      `https://boards-api.greenhouse.io/v1/boards/${o.slug}/jobs/${o.id}?content=true`,
    );
    if (!res.ok) return null;
    const corps = (await res.json()) as { content?: string };
    return corps.content ?? "";
  } catch {
    return null;
  }
}

async function texteSmartRecruiters(o: OffreLegere, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const res = await fetchImpl(`https://api.smartrecruiters.com/v1/companies/${o.slug}/postings/${o.id}`);
    if (!res.ok) return null;
    const corps = (await res.json()) as {
      jobAd?: { sections?: Record<string, { text?: string } | undefined> };
    };
    const sections = corps.jobAd?.sections ?? {};
    return Object.values(sections)
      .map((s) => s?.text ?? "")
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return null;
  }
}

/** Un seul appel liste pour toutes les offres candidates d'un même board Lever. */
async function textesLever(
  slug: string,
  ids: Set<string>,
  fetchImpl: FetchLike,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetchImpl(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!res.ok) return out;
    const corps = (await res.json()) as { id?: string; descriptionPlain?: string }[];
    for (const j of corps ?? []) {
      if (j.id && ids.has(j.id)) out.set(j.id, j.descriptionPlain ?? "");
    }
  } catch {
    // Board injoignable : les offres de ce board resteront sans texte, écartées en aval.
  }
  return out;
}

/** Un seul appel liste pour toutes les offres candidates d'un même board Ashby. */
async function textesAshby(
  slug: string,
  ids: Set<string>,
  fetchImpl: FetchLike,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetchImpl(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (!res.ok) return out;
    const corps = (await res.json()) as { jobs?: { id?: string; descriptionPlain?: string }[] };
    for (const j of corps.jobs ?? []) {
      if (j.id && ids.has(j.id)) out.set(j.id, j.descriptionPlain ?? "");
    }
  } catch {
    // Board injoignable : idem.
  }
  return out;
}

/**
 * Texte complet des offres candidates. Une offre en échec est absente du
 * résultat (jamais une chaîne vide qui se ferait passer pour un texte réel) —
 * le tri par mots interdits (§5 de la spec) l'ignorera simplement.
 */
export async function obtenirTextes(
  offres: OffreLegere[],
  fetchImpl: FetchLike = fetchDelai,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const parId = offres.filter((o) => o.ats === "greenhouse" || o.ats === "smartrecruiters");
  const resultatsParId = await parVagues(parId, async (o) => {
    const texte =
      o.ats === "greenhouse"
        ? await texteGreenhouse(o, fetchImpl)
        : await texteSmartRecruiters(o, fetchImpl);
    return texte === null ? null : { cle: cleOffre(o), texte };
  });
  for (const r of resultatsParId) if (r) out.set(r.cle, r.texte);

  for (const ats of ["lever", "ashby"] as const) {
    const parBoard = new Map<string, Set<string>>();
    for (const o of offres) {
      if (o.ats !== ats) continue;
      const ids = parBoard.get(o.slug);
      if (ids) ids.add(o.id);
      else parBoard.set(o.slug, new Set([o.id]));
    }
    const boards = [...parBoard.entries()];
    const resultats = await parVagues(boards, ([slug, ids]) =>
      ats === "lever" ? textesLever(slug, ids, fetchImpl) : textesAshby(slug, ids, fetchImpl),
    );
    boards.forEach(([slug], i) => {
      for (const [id, texte] of resultats[i]) out.set(cleOffre({ ats, slug, id }), texte);
    });
  }

  return out;
}

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

const ENTITES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ugrave: "ù", ocirc: "ô",
  rsquo: "’", laquo: "«", raquo: "»", hellip: "…", eur: "€",
};

function decoder(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (tout, code: string) => {
    try {
      if (/^#x/i.test(code)) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    } catch {
      return tout; // point de code hors plage : on préfère l'entité brute à un plantage
    }
    return ENTITES[code.toLowerCase()] ?? tout;
  });
}

/**
 * HTML d'annonce → texte lisible.
 *
 * Greenhouse rend son `content` **encodé en entités** (`&lt;p&gt;…`) et
 * SmartRecruiters ses sections en HTML direct. Sans ce nettoyage, la carte
 * affichait littéralement `<p>ALTEN joue un rôle…` — et surtout la notation
 * ATS et « Adapter mon CV » recevaient les balises comme du texte d'offre.
 * Lever et Ashby en sont dispensés : leur `descriptionPlain` est déjà du texte,
 * et le faire passer ici abîmerait un « < » légitime.
 *
 * Deux décodages : le premier révèle les balises encodées, le second traite les
 * entités qu'elles contenaient (`&amp;nbsp;` devenu `&nbsp;`).
 */
export function texteBrut(html: string): string {
  const revele = decoder(html);
  const sansBalises = revele
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table)>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  return decoder(sansBalises)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function texteGreenhouse(o: OffreLegere, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const res = await fetchImpl(
      `https://boards-api.greenhouse.io/v1/boards/${o.slug}/jobs/${o.id}?content=true`,
    );
    if (!res.ok) return null;
    const corps = (await res.json()) as { content?: string };
    return texteBrut(corps.content ?? "");
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
    return texteBrut(
      Object.values(sections)
        .map((s) => s?.text ?? "")
        .filter(Boolean)
        .join("\n\n"),
    );
  } catch {
    return null;
  }
}

/**
 * Workday : l'API de détail vit sous `/wday/cxs/{locataire}/{site}`, alors que
 * l'URL publique de l'offre n'a que `/{site}`. On dérive l'une de l'autre —
 * `id` seul ne suffit pas, le chemin de l'offre porte aussi la ville.
 */
export function urlDetailWorkday(url: string): string | null {
  const m = /^https:\/\/([a-zA-Z0-9_-]+)\.(wd\d+)\.myworkdayjobs\.com\/([^/]+)(\/.+)$/.exec(url);
  if (!m) return null;
  const [, locataire, wd, site, chemin] = m;
  return `https://${locataire}.${wd}.myworkdayjobs.com/wday/cxs/${locataire}/${site}${chemin}`;
}

async function texteWorkday(o: OffreLegere, fetchImpl: FetchLike): Promise<string | null> {
  const url = urlDetailWorkday(o.url);
  if (!url) return null;
  try {
    const res = await fetchImpl(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const corps = (await res.json()) as { jobPostingInfo?: { jobDescription?: string } };
    return texteBrut(corps.jobPostingInfo?.jobDescription ?? "");
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

/**
 * Un seul appel RSS pour toutes les offres candidates d'un même hôte Talentsoft.
 *
 * ⚠️ Talentsoft ne peut pas être oublié ici. Une offre absente de cette table
 * est écartée par `searchBoards` (elle ne s'affiche pas « à moitié ») : sans
 * cette fonction, la source entière serait invisible dans l'app tout en pesant
 * dans l'index. C'est le même piège qui a déjà éliminé Workday en silence, sous
 * une autre forme (voir LIMITES.md §2.4 bis).
 *
 * Le flux porte déjà la description complète de chaque offre : il n'y a rien à
 * demander de plus, contrairement à Greenhouse ou Workday qui exigent un appel
 * par offre.
 */
async function textesTalentsoft(
  hote: string,
  ids: Set<string>,
  fetchImpl: FetchLike,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetchImpl(`https://${hote}/handlers/offerRss.ashx?LCID=1036&top=1000`);
    if (!res.ok) return out;
    const xml = await res.text();

    for (const bloc of xml.split("<item>").slice(1)) {
      const lien = /<link>([\s\S]*?)<\/link>/.exec(bloc)?.[1] ?? "";
      const id = /[?&]idOffre=(\d+)/i.exec(lien.replace(/&amp;/g, "&"))?.[1];
      if (!id || !ids.has(id)) continue;
      const desc = /<description>([\s\S]*?)<\/description>/.exec(bloc)?.[1] ?? "";
      // `texteBrut` décode deux fois : le flux encode le HTML dans du XML,
      // c'est exactement le cas qu'il traite.
      out.set(id, texteBrut(desc));
    }
  } catch {
    // Hôte injoignable : ses offres resteront sans texte, écartées en aval.
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

  // Ces trois-là n'ont pas d'appel liste porteur du texte : une requête par offre.
  const parId = offres.filter(
    (o) => o.ats === "greenhouse" || o.ats === "smartrecruiters" || o.ats === "workday",
  );
  const resultatsParId = await parVagues(parId, async (o) => {
    let texte: string | null;
    if (o.ats === "greenhouse") texte = await texteGreenhouse(o, fetchImpl);
    else if (o.ats === "workday") texte = await texteWorkday(o, fetchImpl);
    else texte = await texteSmartRecruiters(o, fetchImpl);
    return texte === null ? null : { cle: cleOffre(o), texte };
  });
  for (const r of resultatsParId) if (r) out.set(r.cle, r.texte);

  for (const ats of ["lever", "ashby", "talentsoft"] as const) {
    const parBoard = new Map<string, Set<string>>();
    for (const o of offres) {
      if (o.ats !== ats) continue;
      const ids = parBoard.get(o.slug);
      if (ids) ids.add(o.id);
      else parBoard.set(o.slug, new Set([o.id]));
    }
    const boards = [...parBoard.entries()];
    const resultats = await parVagues(boards, ([slug, ids]) => {
      if (ats === "lever") return textesLever(slug, ids, fetchImpl);
      if (ats === "talentsoft") return textesTalentsoft(slug, ids, fetchImpl);
      return textesAshby(slug, ids, fetchImpl);
    });
    boards.forEach(([slug], i) => {
      for (const [id, texte] of resultats[i]) out.set(cleOffre({ ats, slug, id }), texte);
    });
  }

  return out;
}

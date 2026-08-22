// Offres françaises d'un board Talentsoft (Cegid).
//
// Talentsoft est le premier ATS de l'index à être français d'origine, et le
// seul dont un SEUL appel rende tout le board : `/handlers/offerRss.ashx` est
// un flux RSS public, servi à l'identique sur les sous-domaines partagés
// (`*.talent-soft.com`) ET sur les domaines propres des clients — vérifié le
// 21/08/2026 sur jobs.groupe-psa.com, spie-job, dassault-aviation-cand, brgm.
//
// C'est ce qui rend le sondage bon marché : l'empreinte et la moisson sont la
// même requête. Un hôte qui n'est pas du Talentsoft rend 404 ou du HTML, et
// c'est un fait exploitable, pas une panne.

import { coordonneesDe } from "./geo.mjs";

const TIMEOUT_MS = 20_000;

/**
 * Plafond réel du paramètre `top`, mesuré le 21/08/2026 : SPIE et EDF rendent
 * exactement 1 000 offres avec `top=2000`. Demander plus ne sert à rien, et
 * un board qui atteint ce plafond est donc TRONQUÉ — sans qu'aucun champ ne le
 * signale. Aucune pagination n'a été trouvée sur cet endpoint.
 */
const TOP = 1000;

/** Entités XML/HTML rencontrées dans les flux Talentsoft. */
export function decoder(s) {
  return String(s ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/**
 * Le lieu d'une offre, lu dans les étiquettes de sa description.
 *
 * ⚠️ NE PAS lire le lieu dans la dernière `<category>`. C'est tentant — PSA,
 * BRGM et Dassault y mettent bien la ville — mais Orange et Kronospan y mettent
 * le TYPE DE CONTRAT. Mesuré le 21/08/2026 : la règle positionnelle inventait
 * des villes nommées « CDI », « Stage » et « Unbefristet ».
 *
 * ⚠️ Les étiquettes elles-mêmes sont renommées par chaque entreprise : « Ville »
 * (PSA, EDF, Sodexo), « Lieu de travail » (SPIE, Dassault). On les reconnaît
 * donc par mot-clé, jamais par position ni par libellé exact.
 *
 * Rendre `""` est un résultat normal : Orange et Kronospan ne publient
 * réellement aucun lieu, et une offre sans lieu n'entre pas dans l'index.
 */
export function lieuDeLaDescription(html) {
  const m = /<b>[^<]*\b(?:ville|lieu|localisation|site)\b[^<]*<\/b>\s*([^<]*)/i.exec(String(html ?? ""));
  return m ? m[1].trim() : "";
}

/**
 * Suffixes qui nomment le dispositif de recrutement, pas l'employeur.
 * Relevés sur les hôtes `*.talent-soft.com` vus le 21/08/2026.
 */
const SUFFIXES = ["recrute", "recrutement", "cand", "candidate", "career", "careers", "job", "jobs", "carriere", "carrieres", "emploi"];

/**
 * Nom d'affichage de l'employeur, déduit de l'hôte.
 *
 * ⚠️ Sur un domaine propre, le sous-domaine ne nomme PAS l'employeur : le
 * retenir donnerait « Jobs » pour Stellantis et « Careers » pour Bouygues. On
 * prend alors le domaine. Sur un sous-domaine `*.talent-soft.com`, c'est
 * l'inverse — le domaine est celui de l'éditeur, seul le sous-domaine porte la
 * marque.
 *
 * Comme pour Workday (`nomWorkday`), le résultat est lisible sans être parfait :
 * les sigles ressortent capitalisés (« Brgm » et non « BRGM »). Lisible, jamais
 * trompeur — non raffiné davantage.
 */
export function nomTalentsoft(hote) {
  const parts = String(hote ?? "").toLowerCase().split(".").filter(Boolean);
  if (parts.length === 0) return "";

  const brut = hote.toLowerCase().endsWith(".talent-soft.com")
    ? parts[0]
    : parts[Math.max(0, parts.length - 2)];

  const mots = brut.split("-").filter((m) => m && !SUFFIXES.includes(m));
  const utiles = mots.length > 0 ? mots : [brut];

  return utiles.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(" ");
}

const balise = (bloc, nom) => {
  const m = new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`).exec(bloc);
  return m ? m[1].trim() : "";
};

/**
 * Référence interne préfixant le titre : « 2026-19516 - Chargé de… ».
 * Volontairement étroite — « Chef de projet 2026 - phase 2 » doit survivre.
 */
const RE_REFERENCE = /^\s*\d{4}-\d+\s*-\s*/;

/** ISO 8601 si la date est exploitable, "" sinon. */
function dateOuVide(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Les offres d'un flux RSS Talentsoft, à la forme commune des offres légères. */
export function offresDuFlux(xml) {
  const out = [];

  for (const bloc of String(xml ?? "").split("<item>").slice(1)) {
    const url = decoder(balise(bloc, "link"));
    const titre = decoder(balise(bloc, "title")).replace(RE_REFERENCE, "").trim();
    const lieu = lieuDeLaDescription(decoder(balise(bloc, "description")));

    out.push({
      id: (/[?&]idOffre=(\d+)/i.exec(url) ?? [])[1] ?? url,
      titre,
      lieu,
      // Le flux ne porte aucun code pays : c'est le géocodage qui tranche.
      pays: "",
      url,
      publieLe: dateOuVide(balise(bloc, "pubDate")),
    });
  }

  return out;
}

/**
 * Offres françaises d'un board Talentsoft — même garantie que `listerOffresFR` :
 * `[]` = testé, rien à prendre ici (un fait) ; `null` = on ne sait pas (réseau,
 * 5xx). Jamais de partiel.
 *
 * ⚠️ `LCID=1036` sélectionne la LANGUE française, pas le PAYS France. Mesuré le
 * 21/08/2026 : PSA y publie Kenitra et Amsterdam, et des locataires entiers sont
 * suisses ou allemands (Chur, Vaduz, 130 adresses argoviennes). Le pays est donc
 * tranché par le géocodage — la Base Adresse Nationale ne connaissant que la
 * France, un libellé qu'elle situe EST en France.
 *
 * ⚠️ `estFrancais` est inutilisable ici : sans code pays ni région dans le
 * libellé, elle rejette « SOCHAUX », « Poissy » et « Marcoule », qui sont bien
 * françaises. La retenir aurait vidé la moisson en silence.
 */
export async function listerTalentsoftFR(hote, fetchImpl = fetch, geocodeur = coordonneesDe) {
  let corps;
  try {
    const res = await fetchImpl(
      `https://${hote}/handlers/offerRss.ashx?LCID=1036&top=${TOP}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    // 404 : cet hôte n'héberge pas de Talentsoft. C'est un fait, pas une panne.
    if (res.status === 404) return [];
    if (!res.ok) return null;
    corps = await res.text();
  } catch {
    return null;
  }

  // La grande majorité des hôtes candidats rendent une page HTML quelconque en
  // 200. Ce n'est pas une panne non plus : simplement, il n'y a rien ici.
  if (!corps.includes("<rss")) return [];

  const offres = offresDuFlux(corps).filter((o) => o.lieu);

  // Un même libellé revient d'une offre à l'autre : ne le situer qu'une fois.
  const situes = new Map();
  for (const lieu of new Set(offres.map((o) => o.lieu))) {
    situes.set(lieu, await geocodeur(lieu, fetchImpl));
  }

  // ⚠️ Le géocodeur nomme le département `departement` ; tout l'aval lit `dept`.
  // Le raccord se fait ICI et nulle part ailleurs : `build-boards-offres.mjs` ne
  // convertit que les offres SANS coordonnées, or celles-ci en ont déjà. Sans
  // cette normalisation, aucune offre Talentsoft n'aurait de département et le
  // filtre par région les écarterait toutes — en silence.
  //
  // `ville` et `via` sont des champs de travail du géocodeur : les laisser
  // passer alourdirait l'index des offres, réécrit chaque jour, pour rien.
  return offres
    .filter((o) => situes.get(o.lieu))
    .map((o) => {
      const { lat, lng, departement } = situes.get(o.lieu);
      return { ...o, lat, lng, ...(departement ? { dept: departement } : {}) };
    });
}

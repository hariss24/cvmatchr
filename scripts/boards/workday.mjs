// Offres françaises d'un board Workday.
//
// Workday se distingue des quatre ATS de la brique 1 sur deux points, l'un
// bénin, l'autre structurant :
//
//   1. L'adresse n'est pas devinable. `{locataire}.{wd}.myworkdayjobs.com/{site}`
//      contient un identifiant de site attribué au contrat, sans rapport avec le
//      nom de l'entreprise : deviner « AirLiquide » pour le locataire
//      `airliquidehr` rend 404 (essai du 05/08/2026). Les couples viennent donc
//      de Common Crawl (voir crawl.mjs), jamais d'une construction.
//
//   2. La liste d'offres n'expose AUCUN pays — seulement `locationsText`, un
//      libellé libre. Mesuré le 05/08/2026 sur Sanofi : « Vitry-sur-Seine »,
//      « Gentilly », « Le Trait », « Marcy-l'Etoile »... Aucun n'est reconnu par
//      `estFrancais`, et aucune liste de villes en dur ne couvrira les
//      35 000 communes. `estFrancais` n'est donc PAS utilisable ici.
//
// D'où deux voies, toutes deux vérifiées contre le pays déclaré par Workday.

const TIMEOUT_MS = 20_000;

/**
 * Identifiant Workday du pays France.
 *
 * ⚠️ C'est un WID global, pas une valeur propre à un locataire — vérifié le
 * 05/08/2026 : la facette de Sanofi et le champ `country` du détail d'une offre
 * GEA portent le même identifiant. C'est ce qui autorise à l'écrire en dur.
 *
 * ⚠️ Un locataire qui n'expose pas la facette `locationCountry` IGNORE ce filtre
 * au lieu de le refuser : GEA rend ses 356 offres à l'identique avec et sans.
 * Appliquer la facette sans avoir vérifié qu'elle existe revient donc à déclarer
 * françaises toutes les offres du board. Mesuré : 26 484 fausses offres sur un
 * échantillon de 125 locataires.
 */
export const FRANCE_WID = "54c5b6971ffb4bf0b116fe7651ec789a";

/** `limit` plafonne à 20 : au-delà, l'API rend une liste vide (essai 50/100/200). */
const PAGE = 20;

/** Garde-fou de pagination — 200 pages = 4 000 offres françaises pour un seul board. */
const PAGES_MAX = 200;

/**
 * Mots qui ne nomment pas l'employeur mais le dispositif de recrutement.
 * Relevés sur les 291 boards français du passage du 05/08/2026.
 */
const GENERIQUES = new Set([
  "careers", "career", "carriere", "carrieres", "recrute", "recrutement", "jobs", "job",
  "external", "externe", "ext", "internal", "site", "sites", "page", "pages", "search",
  "gateway", "rec", "global", "experienced", "employment", "channel", "work", "your",
  "passion", "opportunities", "talent", "talents", "hiring", "apply", "portal", "www",
]);

const sansAccent = (s) => String(s).toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/**
 * `Mango_Work_Your_Passion` → `["Mango","Work","Your","Passion"]`.
 *
 * Deux coupes, pas une : la première sépare `SanofiCareers`, la seconde
 * `GEACareers` → `GEA` + `Careers`. Sans elle, un sigle collé à un mot restait
 * d'un seul tenant et sortait en « Geacareers ».
 */
function motsDuSite(site) {
  return String(site)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

/** Sigles courts gardés en capitales (RATP, KION, GEA), le reste capitalisé. */
function joliment(mots) {
  return mots
    .map((m) => (m.length <= 4 && m === m.toUpperCase()
      ? m
      : m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Nom d'affichage d'un board Workday.
 *
 * ⚠️ Le locataire ne suffit pas : c'est un identifiant de contrat, pas une
 * raison sociale. Mesuré le 05/08/2026 sur les 291 boards français, il donnait
 * « Ag » pour Airbus, « Cc » pour Chanel, « Fina » pour Deloitte et
 * « Alliancewd » pour Renault — c'est ce nom que le candidat lit sur la carte
 * d'offre. Le nom du site, lui, porte souvent la marque.
 *
 * Le site ne l'emporte que s'il apporte VRAIMENT plus : sinon `abercrombie` se
 * ferait renommer « Anf » par son site `anf`.
 */
export function nomWorkday(locataire, site) {
  const parDefaut = locataire.charAt(0).toUpperCase() + locataire.slice(1);
  const utiles = motsDuSite(site)
    .filter((m) => !GENERIQUES.has(m.toLowerCase()) && !/^\d+$/.test(m));
  if (utiles.length === 0) return parDefaut;

  const nom = joliment(utiles);
  const a = sansAccent(nom);
  const b = sansAccent(locataire);

  if (a === b) return nom;                              // SanofiCareers → Sanofi
  if (a.includes(b)) return nom;                        // renault-group-careers
  if (b.startsWith(a) && a.length >= 3) return nom;     // michelinhr → Michelin
  if (a.length > b.length) return nom;                  // ag → Airbus
  return parDefaut;                                     // abercrombie garde son nom
}

/** `sanofi.wd3/SanofiCareers` → les trois morceaux, ou `null` si la forme est fausse. */
export function decomposer(slug) {
  const m = /^([a-z0-9_-]+)\.(wd\d+)\/(.+)$/i.exec(String(slug ?? ""));
  return m ? { locataire: m[1], wd: m[2], site: m[3] } : null;
}

const racine = ({ locataire, wd, site }) =>
  `https://${locataire}.${wd}.myworkdayjobs.com/wday/cxs/${locataire}/${site}`;

async function poster(url, corps, fetchImpl) {
  return fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Nombre d'offres françaises annoncé par la facette pays, ou `null` si ce
 * locataire n'expose pas cette facette. `0` veut dire « la facette existe et ne
 * liste pas la France » — donc aucune offre française, et c'est un fait.
 */
export function franceDansFacettes(corps) {
  const groupe = (corps?.facets ?? []).find((f) => f?.facetParameter === "locationMainGroup");
  const pays = (groupe?.values ?? []).find((v) => v?.facetParameter === "locationCountry");
  if (!pays) return null;
  const fr = (pays.values ?? []).find((v) => v?.id === FRANCE_WID);
  return fr ? Number(fr.count) || 0 : 0;
}

/**
 * Libellé que Workday substitue aux villes quand une offre couvre plusieurs
 * sites : « 2 Locations », « 28 Locations ». Il concerne 12 % des offres
 * (mesuré le 05/08/2026 sur 2 172 offres) et ne nomme aucun lieu — une offre
 * qui garderait ce libellé serait invisible d'une recherche « à 30 km de chez
 * moi » tout en s'affichant ailleurs. Le détail, lui, nomme les sites.
 */
const RE_MULTI = /^\d+\s+locations?$/i;

/**
 * Le libellé de lieu ne nomme aucune ville : masqué derrière « 2 Locations », ou
 * tout simplement absent.
 *
 * ⚠️ Le cas absent n'est pas théorique : Accenture n'expose PAS `locationsText`
 * (vérifié le 06/08/2026 — ses offres n'ont que titre, chemin et date). Ses
 * 200 offres françaises entraient dans l'index sans lieu, donc invisibles d'une
 * recherche par rayon. Le détail, lui, nomme la ville.
 */
const lieuIncomplet = (brut) => brut === "" || RE_MULTI.test(brut);

/** Les villes d'un détail d'offre : le site principal puis les autres. */
export function lieuDuDetail(info) {
  const villes = [info?.location, ...(info?.additionalLocations ?? [])]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return villes.join(" / ");
}

/**
 * Une entrée de `jobPostings` exploitable.
 *
 * ⚠️ Workday en renvoie qui ne portent QUE des métadonnées internes, sans titre
 * ni chemin (relevé le 06/08/2026 chez Accenture, ~1 sur 20). Sans lien ni
 * intitulé, ce n'est pas une offre : elle produirait une carte vide pointant sur
 * la racine du board.
 */
const estPresentable = (poste) => Boolean(poste?.externalPath) && Boolean(poste?.title);

/** Une entrée de `jobPostings` ramenée à la forme commune des offres légères. */
function normaliser(poste, morceaux, lieu) {
  const chemin = String(poste?.externalPath ?? "");
  const { locataire, wd, site } = morceaux;
  return {
    id: chemin.split("/").filter(Boolean).pop() ?? "",
    titre: poste?.title ?? "",
    lieu: lieu ?? poste?.locationsText ?? "",
    pays: "",
    url: `https://${locataire}.${wd}.myworkdayjobs.com/${site}${chemin}`,
    publieLe: typeof poste?.startDate === "string" ? poste.startDate : "",
  };
}

/**
 * Détails ouverts de front. Ils sont le vrai coût de ce module : un board sans
 * facette pays en demande un par offre candidate.
 *
 * ⚠️ En file indienne, le passage du 05/08/2026 est resté 15 minutes bloqué sur
 * un seul board pendant que les 1 450 autres étaient finis. Six de front
 * suffisent à ramener ça à une poignée de secondes, sans changer le résultat :
 * l'ordre est préservé et une erreur remonte toujours, elle n'est pas avalée.
 */
const DETAILS_DE_FRONT = 6;

async function enFront(items, travail) {
  const out = new Array(items.length);
  let curseur = 0;
  const ouvrier = async () => {
    while (curseur < items.length) {
      const i = curseur++;
      out[i] = await travail(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(DETAILS_DE_FRONT, items.length) }, ouvrier),
  );
  return out;
}

/** Détail d'une offre, ou `null` si elle a disparu entre la liste et l'appel. */
async function detail(morceaux, chemin, fetchImpl) {
  const res = await fetchImpl(`${racine(morceaux)}${chemin}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`workday detail ${morceaux.locataire} : ${res.status}`);
  return (await res.json())?.jobPostingInfo ?? null;
}

/** Une page de `jobs`. Lève sur réponse inexploitable — l'appelant traduit en `null`. */
async function page(morceaux, facettes, texte, offset, fetchImpl) {
  const res = await poster(
    `${racine(morceaux)}/jobs`,
    { appliedFacets: facettes, limit: PAGE, offset, searchText: texte },
    fetchImpl,
  );
  if (!res.ok) throw new Error(`workday ${morceaux.locataire} offset ${offset} : ${res.status}`);
  return res.json();
}

/**
 * Une offre dont le lieu est nommé, ou `null` s'il est impossible de le nommer.
 *
 * ⚠️ Une offre sans lieu exploitable est ÉCARTÉE, pas conservée avec un libellé
 * vague. Elle serait sinon absente des recherches par rayon tout en apparaissant
 * ailleurs — une incohérence que le candidat n'a aucun moyen de comprendre.
 */
async function avecLieu(poste, morceaux, fetchImpl) {
  if (!estPresentable(poste)) return null;

  const brut = String(poste?.locationsText ?? "").trim();
  if (!lieuIncomplet(brut)) return normaliser(poste, morceaux);

  const info = await detail(morceaux, poste.externalPath, fetchImpl);
  const lieu = lieuDuDetail(info);
  return lieu ? normaliser(poste, morceaux, lieu) : null;
}

/** Voie A — la facette pays existe : elle filtre côté serveur, sans ambiguïté. */
async function parFacette(morceaux, attendu, fetchImpl) {
  const out = [];
  let vues = 0;
  for (let p = 0; p < PAGES_MAX && vues < attendu; p++) {
    const corps = await page(morceaux, { locationCountry: [FRANCE_WID] }, "", p * PAGE, fetchImpl);
    const postes = corps?.jobPostings ?? [];
    vues += postes.length;
    const offres = await enFront(postes, (poste) => avecLieu(poste, morceaux, fetchImpl));
    out.push(...offres.filter(Boolean));
    if (postes.length < PAGE) break;
  }
  return out;
}

/**
 * Voie B — pas de facette pays : `searchText` dégrossit, le détail tranche.
 *
 * ⚠️ `searchText: "France"` ne filtre PAS sur le pays. Mesuré le 05/08/2026 sur
 * Sanofi et Santander : la réponse contient Bogota, Hyderabad, Madrid,
 * Singapour, Hong Kong. Elle ne sert qu'à réduire le nombre de détails à ouvrir
 * — c'est le champ `country` du détail qui décide, lui seul.
 */
async function parDetail(morceaux, fetchImpl) {
  const candidats = [];
  for (let p = 0; p < PAGES_MAX; p++) {
    const corps = await page(morceaux, {}, "France", p * PAGE, fetchImpl);
    const postes = corps?.jobPostings ?? [];
    candidats.push(...postes);
    if (postes.length < PAGE) break;
  }

  const offres = await enFront(candidats.filter(estPresentable), async (poste) => {
    // Une offre retirée entre la liste et le détail rend 404 : elle n'est pas
    // française pour autant, on la passe sans invalider le board.
    const info = await detail(morceaux, poste.externalPath, fetchImpl);
    if (info?.country?.id !== FRANCE_WID) return null;

    // Le détail est déjà ouvert : nommer la ville d'une offre au lieu masqué ou
    // absent ne coûte rien de plus ici, contrairement à la voie A.
    const brut = String(poste?.locationsText ?? "").trim();
    const lieu = lieuIncomplet(brut) ? lieuDuDetail(info) : brut;
    return lieu ? normaliser(poste, morceaux, lieu) : null;
  });
  return offres.filter(Boolean);
}

/**
 * Offres françaises d'un board Workday — même garantie que `listerOffresFR` :
 * `[]` = testé, rien en France (un fait) ; `null` = on ne sait pas (réseau, 5xx,
 * JSON illisible, page en échec en cours de pagination). Jamais de partiel.
 */
export async function listerWorkdayFR(slug, fetchImpl = fetch) {
  const morceaux = decomposer(slug);
  if (!morceaux) return [];

  try {
    const res = await poster(
      `${racine(morceaux)}/jobs`,
      { appliedFacets: {}, limit: PAGE, offset: 0, searchText: "" },
      fetchImpl,
    );
    // 404 = le site n'existe pas sous ce nom. Le couple est faux, pas injoignable.
    if (res.status === 404) return [];
    if (!res.ok) return null;

    const corps = await res.json();
    const annonce = franceDansFacettes(corps);

    if (annonce === null) return await parDetail(morceaux, fetchImpl);
    if (annonce === 0) return [];
    return await parFacette(morceaux, annonce, fetchImpl);
  } catch {
    return null;
  }
}

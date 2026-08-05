// Lire les adresses de boards Workday dans l'index de Common Crawl.
//
// Les quatre ATS de la brique 1 se devinent : le nom de l'entreprise donne le
// slug. Workday non — l'identifiant de site est attribué au contrat. La seule
// façon de le connaître est de le lire là où il a déjà été écrit, et Common
// Crawl publie justement l'index des adresses rencontrées sur le web.
//
// ⚠️ On n'utilise PAS index.commoncrawl.org : le service CDX rendait 504 sur
// toutes les requêtes le 05/08/2026, y compris `url=example.com`. Les fichiers
// d'index sur data.commoncrawl.org, eux, répondent en 74 ms. On s'adresse donc
// directement à eux — c'est aussi une dépendance de moins.
//
// L'index se lit en deux temps : `cluster.idx` (99 Mo, trié par clé SURT) dit
// dans quel bloc chercher, puis chaque bloc `cdx-NNNNN.gz` est récupéré par
// plage d'octets. Pour Workday : 20 blocs, 6,7 Mo, 8 secondes.

import { gunzipSync } from "node:zlib";

const BASE = "https://data.commoncrawl.org/cc-index/collections";
const TIMEOUT_MS = 120_000;

/** Clé SURT des adresses Workday : le domaine s'y lit à l'envers. */
export const PREFIXE_WORKDAY = "com,myworkdayjobs,";

/** Segment de chemin qui n'est qu'une langue : `en-US`, `fr-FR`. */
const RE_LOCALE = /^[a-z]{2}-[a-z]{2}$/i;

const RE_URL_WORKDAY =
  /^https?:\/\/([a-zA-Z0-9_-]+)\.(wd\d+)\.myworkdayjobs\.com\/(.+)$/;

/**
 * `{locataire, wd, site}` d'une adresse Workday, ou `null` si elle n'en est pas
 * une ou ne porte pas de site (robots.txt, racine du domaine).
 */
export function coupleDepuisUrl(url) {
  const m = RE_URL_WORKDAY.exec(String(url ?? ""));
  if (!m) return null;

  const segments = m[3].split(/[?#]/)[0].split("/").filter(Boolean);
  let site = segments[0];
  if (site && RE_LOCALE.test(site)) site = segments[1];
  // Un segment contenant un point est un fichier (robots.txt), pas un site.
  if (!site || site.includes(".")) return null;

  return { locataire: m[1].toLowerCase(), wd: m[2], site };
}

/**
 * TOUTES les vitrines, une par site distinct — pas une par locataire.
 *
 * ⚠️ Un locataire en expose souvent plusieurs, et elles ne se recoupent pas :
 * `workday.wd5/Workday` porte 5 offres françaises quand `Workday_Early_Career`
 * n'en a aucune, et les 18 offres de `..._PROSOL` sont absentes des 343 de
 * `..._GRAND_FRAIS` (vérifié le 05/08/2026, 0 offre commune dans les deux cas).
 * N'en garder qu'une revenait à jeter environ 405 offres françaises sur 973
 * vitrines secondaires.
 *
 * ⚠️ La casse compte pour l'API (`GEACareers` ≠ `geacareers`) et les adresses
 * crawlées la maltraitent — certains liens sont tout en minuscules. On
 * déduplique donc sans tenir compte de la casse, en gardant la graphie la plus
 * fréquente. C'est un pari, tranché par l'API : un site faux rend 404, et un
 * 404 est un fait exploitable.
 */
export function sitesDistincts(compteurs) {
  const parSite = new Map();
  for (const [cle, n] of compteurs) {
    const [locataire, wd, site] = cle.split("|");
    const k = `${locataire}|${wd}|${site.toLowerCase()}`;
    const gagnant = parSite.get(k);
    if (!gagnant || n > gagnant.n) parSite.set(k, { locataire, wd, site, n });
  }
  return [...parSite.values()]
    .map(({ locataire, wd, site }) => ({ slug: `${locataire}.${wd}/${site}`, locataire }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Les couples d'un bloc CDX décompressé, comptés par nombre d'adresses vues. */
export function compterCouples(texte, compteurs = new Map()) {
  for (const ligne of String(texte).split("\n")) {
    const i = ligne.indexOf("{");
    if (i < 0) continue;
    let url;
    try {
      url = JSON.parse(ligne.slice(i)).url;
    } catch {
      continue;
    }
    const c = coupleDepuisUrl(url);
    if (!c) continue;
    const cle = `${c.locataire}|${c.wd}|${c.site}`;
    compteurs.set(cle, (compteurs.get(cle) ?? 0) + 1);
  }
  return compteurs;
}

async function plage(url, debut, fin, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { range: `bytes=${debut}-${fin}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} [${debut}-${fin}] : ${res.status}`);
  return res;
}

/** Clé SURT de la première ligne ENTIÈRE à partir de `offset`. */
async function cleA(url, offset, fetchImpl) {
  const texte = await (await plage(url, offset, offset + 4000, fetchImpl)).text();
  const coupe = offset === 0 ? texte : texte.slice(texte.indexOf("\n") + 1);
  return coupe.split("\n")[0].split("\t")[0].split(" ")[0];
}

/**
 * Lignes de `cluster.idx` dont la clé commence par `prefixe`.
 *
 * Le fichier fait 99 Mo et n'est pas téléchargé : il est trié, donc une
 * dichotomie sur les plages d'octets isole la zone utile en une quinzaine
 * d'appels de 4 Ko.
 */
export async function blocsDuPrefixe(collection, prefixe, taille, fetchImpl = fetch) {
  const url = `${BASE}/${collection}/indexes/cluster.idx`;

  let bas = 0;
  let haut = taille;
  while (haut - bas > 20_000) {
    const milieu = Math.floor((bas + haut) / 2);
    if ((await cleA(url, milieu, fetchImpl)) < prefixe) bas = milieu;
    else haut = milieu;
  }

  // La dichotomie s'arrête AVANT la zone ; on relit large des deux côtés, la
  // zone Workday tenant dans 64 Ko (20 lignes mesurées le 05/08/2026).
  const debut = Math.max(0, bas - 8_000);
  const texte = await (await plage(url, debut, debut + 200_000, fetchImpl)).text();

  return texte
    .split("\n")
    .filter((l) => l.startsWith(prefixe))
    .map((l) => {
      const [, fichier, offset, longueur] = l.split("\t");
      return { fichier, offset: Number(offset), longueur: Number(longueur) };
    });
}

/** Taille de `cluster.idx`, nécessaire pour borner la dichotomie. */
export async function tailleCluster(collection, fetchImpl = fetch) {
  const url = `${BASE}/${collection}/indexes/cluster.idx`;
  const res = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`cluster.idx ${collection} : ${res.status}`);
  return Number(res.headers.get("content-length"));
}

/**
 * Boards Workday d'une collection Common Crawl : `[{ slug, locataire }]`.
 *
 * Lève si l'index est injoignable — l'appelant ne doit surtout pas prendre une
 * moisson tronquée pour une liste complète et retirer des boards de l'index.
 */
export async function locatairesWorkday(collection, fetchImpl = fetch) {
  const taille = await tailleCluster(collection, fetchImpl);
  const blocs = await blocsDuPrefixe(collection, PREFIXE_WORKDAY, taille, fetchImpl);

  const compteurs = new Map();
  for (const b of blocs) {
    const url = `${BASE}/${collection}/indexes/${b.fichier}`;
    const res = await plage(url, b.offset, b.offset + b.longueur - 1, fetchImpl);
    const brut = Buffer.from(await res.arrayBuffer());
    compterCouples(gunzipSync(brut).toString("utf8"), compteurs);
  }

  return sitesDistincts(compteurs);
}

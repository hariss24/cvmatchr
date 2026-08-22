// Lire l'index COLUMNAR de Common Crawl, colonne par colonne, par plages HTTP.
//
// ⚠️ Ce module n'est pas un doublon de crawl.mjs — les deux index sont
// différents et complémentaires :
//
//   - crawl.mjs lit l'index CDX, trié par clé SURT. Il répond vite à « quelles
//     adresses sous CE domaine ? », et c'est tout : on ne peut y chercher que
//     par préfixe de domaine. C'est ce qui a permis Workday (*.myworkdayjobs.com).
//
//   - ce module lit l'index columnar (Parquet), qui expose les MÊMES adresses
//     découpées en colonnes indépendantes. On peut donc lire `url_host_name`
//     SEUL, sans jamais toucher au reste — et obtenir l'univers des noms d'hôtes
//     du web, tous domaines confondus. C'est la seule voie vers les ATS installés
//     sur un domaine propre (jobs.groupe-psa.com), qu'aucun préfixe ne trouve.
//
// Pourquoi ça tient dans un budget raisonnable, mesuré le 21/08/2026 sur
// CC-MAIN-2026-30 : un fichier pèse 604 Mo, mais sa colonne `url_host_name` ne
// pèse que 0,8 Mo — les adresses complètes (`url`, `url_surtkey`) et les
// empreintes (`content_digest`) sont l'essentiel du poids, et on n'en veut
// aucune. Sur les 300 fichiers : ~600 Mo et quelques minutes, contre 181 Go
// pour les fichiers entiers.
//
// ⚠️ Common Crawl ne documente que la voie Amazon Athena, qui suppose un compte
// AWS et facture chaque requête. Ce module fait le même travail par simples
// requêtes HTTP, sans compte ni facture — d'où son existence.

import { parquetReadObjects, parquetMetadataAsync } from "hyparquet";
import { zstdDecompressSync } from "node:zlib";
import { gunzipSync } from "node:zlib";

const BASE = "https://data.commoncrawl.org";
const TIMEOUT_MS = 120_000;

/**
 * hyparquet ne sait pas décompresser ZSTD, et l'index de Common Crawl est
 * entièrement en ZSTD. Node sait le faire depuis la v22.15 / v23.8 : on lui
 * branche donc son propre décompresseur.
 */
const COMPRESSEURS = {
  ZSTD: (entree, tailleSortie) => {
    const sortie = zstdDecompressSync(Buffer.from(entree));
    return new Uint8Array(sortie.buffer, sortie.byteOffset, tailleSortie ?? sortie.length);
  },
};

/** Tentatives sur une plage refusée avant d'abandonner le fichier. */
const RETRY_MAX = 4;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un `AsyncBuffer` hyparquet adossé à des requêtes HTTP par plage d'octets :
 * le fichier n'est jamais téléchargé, seuls les morceaux demandés le sont.
 *
 * ⚠️ Un serveur peut IGNORER l'en-tête `Range` et répondre 200 avec le fichier
 * entier. La réponse est alors parfaitement valide, mais son contenu ne
 * correspond pas à la demande : tous les offsets Parquet se décalent et le pied
 * de page devient illisible (« thrift unhandled type »). Vécu le 21/08/2026 sur
 * un échantillon de dix fichiers, dont un seul se comportait ainsi — il faisait
 * tomber l'échantillon complet. D'où le découpage manuel sur 200.
 */
export async function tamponHttp(url, fetchImpl = fetch) {
  const head = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!head.ok) throw new Error(`${url} : HEAD ${head.status}`);
  const taille = Number(head.headers.get("content-length"));

  return {
    byteLength: taille,
    async slice(debut, fin) {
      const bout = fin ?? taille;
      for (let essai = 0; essai < RETRY_MAX; essai++) {
        const res = await fetchImpl(url, {
          headers: { range: `bytes=${debut}-${bout - 1}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 206) return res.arrayBuffer();
        if (res.status === 200) return (await res.arrayBuffer()).slice(debut, bout);
        await attendre(500 * (essai + 1));
      }
      throw new Error(`${url} : plage ${debut}-${bout} refusée`);
    },
  };
}

/**
 * Les fichiers Parquet du sous-ensemble `warc` d'une collection.
 *
 * ⚠️ Seul `warc` porte les pages réellement moissonnées. `robotstxt` et
 * `crawldiagnostics` listent respectivement les robots.txt et les échecs de
 * récupération — les prendre triplerait le volume pour rien.
 *
 * Lève si l'index est injoignable : une liste tronquée passerait pour complète
 * et l'appelant en conclurait à tort que des hôtes ont disparu.
 */
export async function cheminsColumnar(collection, fetchImpl = fetch) {
  const url = `${BASE}/crawl-data/${collection}/cc-index-table.paths.gz`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`chemins columnar ${collection} : ${res.status}`);

  const texte = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  return texte.split("\n").map((l) => l.trim()).filter((l) => l.includes("subset=warc/"));
}

/**
 * Les valeurs d'UNE colonne d'un fichier Parquet. Les autres colonnes ne sont
 * jamais téléchargées — c'est tout l'intérêt du format columnar ici.
 */
export async function lireColonne(chemin, colonne, fetchImpl = fetch) {
  const tampon = await tamponHttp(`${BASE}/${chemin}`, fetchImpl);
  const metadata = await parquetMetadataAsync(tampon);
  return parquetReadObjects({ file: tampon, metadata, columns: [colonne], compressors: COMPRESSEURS });
}

import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { cheminsColumnar, tamponHttp } from "./parquet.mjs";

const CHEMINS = [
  "cc-index/table/cc-main/warc/crawl=CC-MAIN-2026-30/subset=crawldiagnostics/part-00000.parquet",
  "cc-index/table/cc-main/warc/crawl=CC-MAIN-2026-30/subset=warc/part-00000.parquet",
  "cc-index/table/cc-main/warc/crawl=CC-MAIN-2026-30/subset=robotstxt/part-00000.parquet",
  "cc-index/table/cc-main/warc/crawl=CC-MAIN-2026-30/subset=warc/part-00001.parquet",
];

test("cheminsColumnar : ne garde que le sous-ensemble warc", async () => {
  // Le fichier des chemins mêle trois sous-ensembles ; seul `warc` porte les
  // pages réellement moissonnées — `robotstxt` et `crawldiagnostics` non.
  const f = async () => new Response(gzipSync(Buffer.from(`${CHEMINS.join("\n")}\n`)), { status: 200 });

  assert.deepEqual(await cheminsColumnar("CC-MAIN-2026-30", f), [
    "cc-index/table/cc-main/warc/crawl=CC-MAIN-2026-30/subset=warc/part-00000.parquet",
    "cc-index/table/cc-main/warc/crawl=CC-MAIN-2026-30/subset=warc/part-00001.parquet",
  ]);
});

test("cheminsColumnar : un index injoignable lève, il ne rend pas une liste vide", async () => {
  // Même règle que crawl.mjs : une moisson tronquée ne doit jamais passer pour
  // une liste complète, sans quoi l'appelant retire des boards de l'index.
  const f = async () => new Response("", { status: 503 });
  await assert.rejects(() => cheminsColumnar("CC-MAIN-2026-30", f));
});

/** Sert `contenu` en honorant — ou non — l'en-tête Range. */
function serveur(contenu, honoreRange) {
  return async (url, init) => {
    if (init?.method === "HEAD") {
      return new Response("", { status: 200, headers: { "content-length": String(contenu.length) } });
    }
    const m = /bytes=(\d+)-(\d+)/.exec(init?.headers?.range ?? "");
    if (!honoreRange) return new Response(contenu, { status: 200 });
    return new Response(contenu.subarray(Number(m[1]), Number(m[2]) + 1), { status: 206 });
  };
}

const CONTENU = Buffer.from("0123456789abcdef");

test("tamponHttp : lit une plage quand le serveur honore Range", async () => {
  const t = await tamponHttp("https://exemple/x.parquet", serveur(CONTENU, true));
  assert.equal(t.byteLength, 16);
  assert.equal(Buffer.from(await t.slice(4, 8)).toString(), "4567");
});

test("tamponHttp : découpe lui-même quand le serveur IGNORE Range", async () => {
  // ⚠️ Piège vécu le 21/08/2026 : un serveur qui répond 200 avec le fichier
  // ENTIER au lieu de 206 décale tous les offsets Parquet, et le pied de page
  // devient illisible (« thrift unhandled type »). Le défaut est silencieux :
  // la réponse est valide, seul son contenu ne correspond pas à la demande.
  const t = await tamponHttp("https://exemple/x.parquet", serveur(CONTENU, false));
  assert.equal(Buffer.from(await t.slice(4, 8)).toString(), "4567");
});

test("tamponHttp : une plage sans fin va jusqu'au bout du fichier", async () => {
  const t = await tamponHttp("https://exemple/x.parquet", serveur(CONTENU, true));
  assert.equal(Buffer.from(await t.slice(10)).toString(), "abcdef");
});

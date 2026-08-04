import test from "node:test";
import assert from "node:assert/strict";
import { LISTES, TRANCHES, slugsDesListes, entreprisesFrancaises } from "./sources.mjs";

test("les trois listes publiques sont déclarées, sans SmartRecruiters", () => {
  assert.deepEqual(Object.keys(LISTES).sort(), ["ashby", "greenhouse", "lever"]);
});

test("les sept tranches d'effectif sont déclarées", () => {
  assert.deepEqual(TRANCHES, ["31", "32", "41", "42", "51", "52", "53"]);
});

test("les listes sont aplaties en couples ats+slug", async () => {
  const f = async (url) => {
    const u = String(url);
    if (u.includes("greenhouse_companies")) return Response.json(["acme", "beta"]);
    if (u.includes("lever_companies")) return Response.json(["gamma"]);
    return Response.json([]);
  };
  const r = await slugsDesListes(f);
  assert.deepEqual(r.sort((a, b) => a.slug.localeCompare(b.slug)), [
    { ats: "greenhouse", slug: "acme" },
    { ats: "greenhouse", slug: "beta" },
    { ats: "lever", slug: "gamma" },
  ]);
});

// Les fichiers publics mêlent tableaux de chaînes et tableaux d'objets.
test("les listes d'objets sont acceptées comme les listes de chaînes", async () => {
  const f = async (url) => {
    if (String(url).includes("ashby_companies")) return Response.json([{ slug: "alan" }, { name: "swile" }]);
    return Response.json([]);
  };
  assert.deepEqual(await slugsDesListes(f), [{ ats: "ashby", slug: "alan" }, { ats: "ashby", slug: "swile" }]);
});

test("une liste en panne ne fait pas tomber les autres", async () => {
  const f = async (url) => {
    if (String(url).includes("greenhouse_companies")) throw new Error("ECONNRESET");
    if (String(url).includes("lever_companies")) return Response.json(["gamma"]);
    return Response.json([]);
  };
  assert.deepEqual(await slugsDesListes(f), [{ ats: "lever", slug: "gamma" }]);
});

// `per_page` est plafonné à 25 par l'API : la pagination est obligatoire.
test("SIRENE est paginé jusqu'à épuisement", async () => {
  const pages = {
    1: { results: [{ nom_complet: "ALPHA", siren: "1" }, { nom_complet: "BETA", siren: "2" }], total_pages: 2 },
    2: { results: [{ nom_complet: "GAMMA", siren: "3" }], total_pages: 2 },
  };
  const f = async (url) => {
    const p = new URL(String(url)).searchParams.get("page");
    return Response.json(pages[p] ?? { results: [], total_pages: 2 });
  };
  const r = await entreprisesFrancaises(f, ["53"]);
  assert.deepEqual(r, [
    { nom: "ALPHA", siren: "1" },
    { nom: "BETA", siren: "2" },
    { nom: "GAMMA", siren: "3" },
  ]);
});

test("une tranche en panne ne fait pas tomber les autres", async () => {
  const f = async (url) => {
    const t = new URL(String(url)).searchParams.get("tranche_effectif_salarie");
    if (t === "52") throw new Error("ECONNRESET");
    return Response.json({ results: [{ nom_complet: "ALPHA", siren: "1" }], total_pages: 1 });
  };
  assert.deepEqual(await entreprisesFrancaises(f, ["52", "53"]), [{ nom: "ALPHA", siren: "1" }]);
});

// « ACCOR (ACCOR) » dériverait en accor-accor — jamais le slug du board. La
// raison sociale prime, la parenthèse est retirée en repli.
test("préfère la raison sociale et enlève la parenthèse du nom complet", async () => {
  const f = async () => Response.json({
    results: [
      { nom_raison_sociale: "ACCOR", nom_complet: "ACCOR (ACCOR)", siren: "602036444" },
      { nom_raison_sociale: null, nom_complet: "MAAF VIE", siren: "2" },
      { nom_complet: "LA POSTE (LA POSTE)", siren: "3" },
    ],
    total_pages: 1,
  });
  assert.deepEqual(await entreprisesFrancaises(f, ["53"]), [
    { nom: "ACCOR", siren: "602036444" },
    { nom: "MAAF VIE", siren: "2" },
    { nom: "LA POSTE", siren: "3" },
  ]);
});

// Mesuré le 04/08/2026 : l'API répond 429 en pagination rapide. Un 429 se
// retente (Retry-After honoré), puis la pagination reprend là où elle était.
test("retente après un 429 et poursuit la pagination", async () => {
  let appels = 0;
  const f = async (url) => {
    appels += 1;
    const p = new URL(String(url)).searchParams.get("page");
    if (p === "1" && appels <= 2) return new Response("", { status: 429, headers: { "retry-after": "0" } });
    if (p === "2") return new Response("", { status: 429, headers: { "retry-after": "0" } });
    return Response.json({ results: [{ nom_complet: "ALPHA", siren: "1" }], total_pages: 2 });
  };
  const r = await entreprisesFrancaises(f, ["53"]);
  assert.equal(r.length, 1);
  assert.equal(r[0].nom, "ALPHA");
});

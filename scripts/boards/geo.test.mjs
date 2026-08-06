import test from "node:test";
import assert from "node:assert/strict";

import { requetesPour, normaliser, coordonneesDe } from "./geo.mjs";

const qs = (libelle) => requetesPour(libelle).map((r) => r.q);

/** Une commune telle que l'API la décrit, réduite à ce que le module lit. */
function commune(nom, score, lat = 48.8, lng = 2.3, context = "") {
  return { geometry: { coordinates: [lng, lat] }, properties: { city: nom, score, context } };
}

/** Réponse de l'API adresse, réduite à ce que le module lit. */
function trait(nom, score, lat = 48.8, lng = 2.3) {
  return { features: [commune(nom, score, lat, lng)] };
}

const rien = { features: [] };

/** `reponses` associe un fragment d'URL au corps rendu. */
function fauxFetch(reponses) {
  return async (url) => {
    const cle = Object.keys(reponses).find((k) => decodeURIComponent(String(url)).includes(k));
    return new Response(JSON.stringify(cle ? reponses[cle] : rien), { status: 200 });
  };
}

test("normaliser retire accents et ponctuation", () => {
  assert.equal(normaliser("Vélizy-Villacoublay"), "velizy villacoublay");
  assert.equal(normaliser("Aix-en-Provence, France"), "aix en provence france");
});

test("les mots d'un nom de commune ne sont pas pris pour du bruit", () => {
  // ⚠️ « sur », « en », « le » font partie de vrais noms. Les avoir filtrés
  // faisait échouer Neuilly-sur-Seine, mesuré le 06/08/2026 : 50 offres.
  assert.ok(qs("Neuilly-Sur-Seine").includes("neuilly sur seine"));
  assert.ok(qs("Aix En Provence, France").includes("aix en provence"));
});

test("le code postal passe en premier, avant toute recherche par nom", () => {
  const r = requetesPour("9th arrondissement of Paris, 75009, Paris, France");
  assert.equal(r[0].type, "cp");
  assert.equal(r[0].q, "75009");
});

test("les deux côtés d'un tiret sont essayés", () => {
  // « France - Paris » : ne garder que le premier morceau perdait 66 offres.
  assert.ok(qs("France - Paris").includes("paris"));
  assert.ok(qs("Toulouse - France").includes("toulouse"));
});

test("un libellé multi-villes propose chaque ville", () => {
  const r = qs("Reims, France / Strasbourg, France / Dijon, France");
  assert.ok(r.includes("reims"));
  assert.ok(r.includes("strasbourg"));
  assert.ok(r.includes("dijon"));
});

test("en dernier recours, chaque mot est tenté séparément", () => {
  // « Four Seasons Megeve » ne nomme aucune commune en entier — 110 offres.
  const r = qs("Four Seasons Megeve");
  assert.ok(r.includes("four seasons megeve"), "l'expression entière d'abord");
  assert.ok(r.indexOf("megeve") > r.indexOf("four seasons megeve"), "les mots isolés ensuite");
});

test("« France » seul ne produit aucune requête exploitable", () => {
  assert.deepEqual(qs("France"), []);
  assert.deepEqual(qs("France, FR"), []);
});

test("coordonneesDe rend les coordonnées d'une commune reconnue", async () => {
  const f = fauxFetch({ "q=velizy villacoublay": trait("Vélizy-Villacoublay", 0.95, 48.786, 2.19) });
  const r = await coordonneesDe("Vélizy-Villacoublay", f);
  assert.equal(r.ville, "Vélizy-Villacoublay");
  assert.equal(r.lat, 48.786);
  assert.equal(r.via, "commune");
});

test("le garde-fou refuse une commune absente du libellé demandé", async () => {
  // ⚠️ Cas réel vérifié le 06/08/2026 : « France » rend Fort-de-France avec un
  // score de 0,68. Sans ce garde-fou, l'offre part en Martinique.
  const f = fauxFetch({ "q=": trait("Fort-de-France", 0.68, 14.6, -61.0) });
  assert.equal(await coordonneesDe("France", f), null);
  assert.equal(await coordonneesDe("Quelquepart", f), null);
});

test("un score trop bas est refusé même si le nom correspond", async () => {
  const f = fauxFetch({ "q=machin": trait("Machin", 0.2) });
  assert.equal(await coordonneesDe("Machin", f), null);
});

test("un code postal échappe au garde-fou : il n'est pas ambigu", async () => {
  // « Paris 9e Arrondissement » ne figure pas dans « 75009 » : le garde-fou le
  // rejetterait, alors que le code postal désigne un lieu sans équivoque.
  const f = fauxFetch({ "q=75009": trait("Paris 9e Arrondissement", 0.86, 48.876, 2.339) });
  const r = await coordonneesDe("9th arrondissement of Paris, 75009, Paris, France", f);
  assert.equal(r.via, "code postal");
  assert.equal(r.lat, 48.876);
});

test("aucune commune reconnaissable : null, jamais une position approximative", async () => {
  assert.equal(await coordonneesDe("Remote", fauxFetch({})), null);
  assert.equal(await coordonneesDe("", fauxFetch({})), null);
});

test("une API en panne ne fabrique pas de coordonnées", async () => {
  const f = async () => new Response("", { status: 503 });
  assert.equal(await coordonneesDe("Toulouse", f), null);
});

/** Les onze Saint-Denis, dans l'ordre où l'API les rend. */
const SAINT_DENIS = {
  features: [
    commune("Saint-Denis", 0.96, -20.88, 55.45, "974, La Réunion"),
    commune("Saint-Denis", 0.96, 48.936, 2.354, "93, Seine-Saint-Denis, Île-de-France"),
    commune("Saint-Denis", 0.93, 43.27, 2.11, "11, Aude, Occitanie"),
  ],
};

test("le département nommé dans le libellé départage les communes homonymes", async () => {
  // ⚠️ Cas réel du 06/08/2026 : « Saint-Denis » rend La Réunion en premier avec
  // un score de 0,96. Sans départage, 74 offres franciliennes partaient à
  // 9 000 km — invisibles pour le candidat parisien.
  const f = fauxFetch({ "q=saint denis": SAINT_DENIS });
  const r = await coordonneesDe("Saint-Denis, Seine-Saint-Denis, France", f);
  assert.equal(Math.round(r.lat), 49, "doit être en Seine-Saint-Denis, pas à La Réunion");
});

test("la région nommée dans le libellé départage aussi", async () => {
  const f = fauxFetch({ "q=saint denis": SAINT_DENIS });
  const r = await coordonneesDe("SAINT DENIS, Ile de France, France", f);
  assert.equal(Math.round(r.lat), 49);
});

test("une offre réellement outre-mer garde sa vraie place", async () => {
  const f = fauxFetch({ "q=saint denis": SAINT_DENIS });
  const r = await coordonneesDe("Saint-Denis, La Réunion", f);
  assert.equal(Math.round(r.lat), -21, "le libellé désigne bien La Réunion");
});

test("deux homonymes que rien ne départage : aucune coordonnée, jamais un pari", async () => {
  // ⚠️ Mieux vaut pas de coordonnées — la recherche retombe sur le libellé —
  // qu'une offre placée dans le mauvais département.
  const f = fauxFetch({ "q=saint denis": SAINT_DENIS });
  assert.equal(await coordonneesDe("Saint-Denis", f), null);
});

test("la région du libellé prime, même sur un candidat unique", async () => {
  // ⚠️ « Saint Louis, Grand Est, France » atterrissait à La Réunion : la
  // recherche par commune ne tranchait pas, celle par adresse ne rendait qu'un
  // seul résultat, et ce résultat unique passait sans contrôle de région.
  const f = fauxFetch({
    "q=saint louis": { features: [commune("Saint-Louis", 0.95, -21.25, 55.42, "974, La Réunion")] },
  });
  assert.equal(await coordonneesDe("Saint Louis, Grand Est, France", f), null);
});

test("une commune cohérente avec la région annoncée est retenue", async () => {
  const f = fauxFetch({
    "q=saint louis": {
      features: [
        commune("Saint-Louis", 0.95, -21.25, 55.42, "974, La Réunion"),
        commune("Saint-Louis", 0.95, 47.59, 7.56, "68, Haut-Rhin, Grand Est"),
      ],
    },
  });
  const r = await coordonneesDe("Saint Louis, Grand Est, France", f);
  assert.equal(Math.round(r.lat), 48, "doit être dans le Haut-Rhin");
});

test("un homonyme nettement mieux noté que les autres reste retenu", async () => {
  const f = fauxFetch({
    "q=machinville": {
      features: [
        commune("Machinville", 0.95, 48.0, 2.0, "45, Loiret, Centre-Val de Loire"),
        commune("Machinville", 0.55, 44.0, 3.0, "12, Aveyron, Occitanie"),
      ],
    },
  });
  const r = await coordonneesDe("Machinville", f);
  assert.equal(Math.round(r.lat), 48);
});

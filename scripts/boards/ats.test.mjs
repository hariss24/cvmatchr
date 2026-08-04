import test from "node:test";
import assert from "node:assert/strict";
import { ATS, compterFR } from "./ats.mjs";

/** `fetch` factice : une réponse par fragment d'URL, 404 pour tout le reste. */
function fauxFetch(reponses) {
  return async (url) => {
    const u = String(url);
    const cle = Object.keys(reponses).find((k) => u.includes(k));
    if (!cle) return new Response("", { status: 404 });
    const r = reponses[cle];
    if (typeof r === "number") return new Response("", { status: r });
    return new Response(JSON.stringify(r), { status: 200 });
  };
}

test("les quatre ATS sont déclarés", () => {
  assert.deepEqual([...ATS].sort(), ["ashby", "greenhouse", "lever", "smartrecruiters"]);
});

test("Greenhouse : compte les offres françaises et ignore les autres", async () => {
  const f = fauxFetch({
    "boards-api.greenhouse.io": {
      jobs: [
        { location: { name: "Paris" } },
        { location: { name: "Berlin, Berlin, Germany" } },
        { location: { name: "Lyon, France" } },
      ],
    },
  });
  assert.equal(await compterFR("greenhouse", "onrunning", f), 2);
});

test("Ashby : lit le lieu à la racine de l'offre", async () => {
  const f = fauxFetch({
    "api.ashbyhq.com": { jobs: [{ location: "Paris, France" }, { location: "Madrid, Spain" }] },
  });
  assert.equal(await compterFR("ashby", "alan", f), 1);
});

// Lever expose `country` en ISO sur certains boards : quand il est là, il fait foi.
test("Lever : le champ country structuré prime sur le texte", async () => {
  const f = fauxFetch({
    "api.lever.co": [
      { categories: { location: "Paris Area, France" }, country: "FR" },
      { categories: { location: "Riyadh" }, country: "SA" },
      { categories: { location: "Toulouse, Occitanie" } },
    ],
  });
  assert.equal(await compterFR("lever", "contentsquare", f), 2);
});

// SmartRecruiters filtre côté serveur : on lit un compteur, pas une liste.
test("SmartRecruiters : lit totalFound avec le filtre pays", async () => {
  const f = fauxFetch({ "api.smartrecruiters.com": { totalFound: 192 } });
  assert.equal(await compterFR("smartrecruiters", "accor", f), 192);
});

test("un board absent vaut zéro, pas inconnu", async () => {
  assert.equal(await compterFR("greenhouse", "boulangerie-durand", fauxFetch({})), 0);
});

test("un board vivant sans offre française vaut zéro", async () => {
  const f = fauxFetch({ "boards-api.greenhouse.io": { jobs: [{ location: { name: "Frankfurt" } }] } });
  assert.equal(await compterFR("greenhouse", "siemens", f), 0);
});

// ⚠️ Le cœur de la protection : une panne ne doit JAMAIS se lire comme un vide.
test("une erreur réseau vaut null, pas zéro", async () => {
  const f = async () => { throw new Error("ECONNRESET"); };
  assert.equal(await compterFR("ashby", "alan", f), null);
});

test("un 500 vaut null, pas zéro", async () => {
  assert.equal(await compterFR("ashby", "alan", fauxFetch({ "api.ashbyhq.com": 500 })), null);
});

test("un JSON illisible vaut null, pas zéro", async () => {
  const f = async () => new Response("<html>maintenance</html>", { status: 200 });
  assert.equal(await compterFR("lever", "swile", f), null);
});

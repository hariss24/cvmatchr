import test from "node:test";
import assert from "node:assert/strict";
import { listerOffresFR } from "./offres.mjs";

/** `fetch` factice : une réponse par fragment d'URL, 404 pour tout le reste. */
function fauxFetch(reponses) {
  return async (url) => {
    const u = String(url);
    const cle = Object.keys(reponses).find((k) => u.includes(k));
    if (!cle) return new Response("", { status: 404 });
    const r = reponses[cle];
    if (typeof r === "number") return new Response("", { status: r });
    if (typeof r === "function") return r(u);
    return new Response(JSON.stringify(r), { status: 200 });
  };
}

test("Greenhouse : mappe id/titre/lieu/url/date, filtre la France", async () => {
  const f = fauxFetch({
    "boards-api.greenhouse.io": {
      jobs: [
        { id: 111, title: "Ingénieur Logiciel", location: { name: "Paris" }, absolute_url: "https://boards.greenhouse.io/onrunning/jobs/111", updated_at: "2026-07-31T20:18:06-04:00" },
        { id: 222, title: "Engineer", location: { name: "Berlin, Berlin, Germany" }, absolute_url: "https://boards.greenhouse.io/onrunning/jobs/222", updated_at: "2026-07-31T20:18:06-04:00" },
      ],
    },
  });
  const r = await listerOffresFR("greenhouse", "onrunning", f);
  assert.equal(r.length, 1);
  assert.deepEqual(
    { id: r[0].id, titre: r[0].titre, lieu: r[0].lieu, url: r[0].url },
    { id: "111", titre: "Ingénieur Logiciel", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/111" },
  );
  assert.equal(r[0].publieLe, new Date("2026-07-31T20:18:06-04:00").toISOString());
});

test("Lever : text→titre, hostedUrl→url, createdAt (epoch ms)→ISO, country prime", async () => {
  const f = fauxFetch({
    "api.lever.co": [
      { id: "abc", text: "Product Manager", categories: { location: "Paris Area, France" }, country: "FR", hostedUrl: "https://jobs.lever.co/contentsquare/abc", createdAt: 1784812558213 },
      { id: "def", text: "Manager", categories: { location: "Riyadh" }, country: "SA", hostedUrl: "https://jobs.lever.co/contentsquare/def", createdAt: 1784812558213 },
    ],
  });
  const r = await listerOffresFR("lever", "contentsquare", f);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "abc");
  assert.equal(r[0].url, "https://jobs.lever.co/contentsquare/abc");
  assert.equal(r[0].publieLe, new Date(1784812558213).toISOString());
});

test("Ashby : mappe id/title/location/jobUrl/publishedAt", async () => {
  const f = fauxFetch({
    "api.ashbyhq.com": { jobs: [
      { id: "xyz", title: "CTO Founder Associate", location: "Paris, France", jobUrl: "https://jobs.ashbyhq.com/alan/xyz", publishedAt: "2026-08-03T08:33:52.099+00:00" },
      { id: "uvw", title: "Support", location: "Madrid, Spain", jobUrl: "https://jobs.ashbyhq.com/alan/uvw", publishedAt: "2026-08-03T08:33:52.099+00:00" },
    ] },
  });
  const r = await listerOffresFR("ashby", "alan", f);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "xyz");
  assert.equal(r[0].url, "https://jobs.ashbyhq.com/alan/xyz");
});

test("SmartRecruiters : URL construite (jobs.smartrecruiters.com), lat/lng repris, pagination", async () => {
  // totalFound=150 avec limit=100 exige deux pages (ceil(150/100)=2) — un
  // totalFound de 2 tiendrait sur une seule page et ne testerait rien.
  const page1 = {
    totalFound: 150,
    content: [{ id: "1", name: "Guest Relation", location: { fullLocation: "Bagnolet, IDF, France", country: "fr", latitude: "48.87", longitude: "2.42" }, releasedDate: "2026-08-04T12:48:52.037Z" }],
  };
  const page2 = {
    totalFound: 150,
    content: [{ id: "2", name: "Réceptionniste", location: { fullLocation: "Lyon, France", country: "fr" }, releasedDate: "2026-08-04T12:48:52.037Z" }],
  };
  const f = fauxFetch({
    "api.smartrecruiters.com": (u) => new Response(JSON.stringify(u.includes("page=1") ? page2 : page1), { status: 200 }),
  });
  const r = await listerOffresFR("smartrecruiters", "accor", f);
  assert.equal(r.length, 2);
  assert.equal(r[0].url, "https://jobs.smartrecruiters.com/accor/1");
  assert.equal(r[0].lat, 48.87);
  assert.equal(r[0].lng, 2.42);
  assert.equal(r[1].lat, undefined);
});

test("un board absent (404) vaut une liste vide, pas une erreur", async () => {
  assert.deepEqual(await listerOffresFR("greenhouse", "boulangerie-durand", fauxFetch({})), []);
});

test("un 500 vaut null, pas une liste vide", async () => {
  assert.equal(await listerOffresFR("ashby", "alan", fauxFetch({ "api.ashbyhq.com": 500 })), null);
});

test("une erreur réseau vaut null", async () => {
  const f = async () => { throw new Error("ECONNRESET"); };
  assert.equal(await listerOffresFR("lever", "contentsquare", f), null);
});

test("un JSON illisible vaut null", async () => {
  const f = async () => new Response("<html>maintenance</html>", { status: 200 });
  assert.equal(await listerOffresFR("greenhouse", "onrunning", f), null);
});

test("SmartRecruiters : une page en échec en cours de pagination vaut null (pas de résultat partiel)", async () => {
  let appel = 0;
  const f = async () => {
    appel += 1;
    if (appel === 1) return new Response(JSON.stringify({ totalFound: 200, content: [{ id: "1", name: "A", location: { fullLocation: "Paris" }, releasedDate: "2026-08-04T12:00:00Z" }] }), { status: 200 });
    return new Response("", { status: 500 });
  };
  assert.equal(await listerOffresFR("smartrecruiters", "accor", f), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { offresDuFlux, lieuDeLaDescription, listerTalentsoftFR, nomTalentsoft } from "./talentsoft.mjs";

test("nomTalentsoft : retire le suffixe de recrutement d'un sous-domaine partagé", () => {
  assert.equal(nomTalentsoft("brgm-recrute.talent-soft.com"), "Brgm");
  assert.equal(nomTalentsoft("spie-job.talent-soft.com"), "Spie");
  assert.equal(nomTalentsoft("dassault-aviation-cand.talent-soft.com"), "Dassault Aviation");
});

test("nomTalentsoft : sur un domaine propre, le nom vient du domaine, pas du sous-domaine", () => {
  // ⚠️ Prendre le sous-domaine donnerait « Jobs » pour Stellantis.
  assert.equal(nomTalentsoft("jobs.groupe-psa.com"), "Groupe Psa");
  assert.equal(nomTalentsoft("careers.bouygues-construction.com"), "Bouygues Construction");
});

test("nomTalentsoft : tolère un hôte inexploitable", () => {
  assert.equal(nomTalentsoft(""), "");
});

/** Une `<description>` Talentsoft : du HTML échappé dans du XML. */
const description = (html) => html
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

/** Un flux RSS Talentsoft minimal mais réaliste. */
function flux(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Export RSS des offres</title>
${items.join("\n")}
</channel></rss>`;
}

const item = ({ lien, categories = [], titre, desc, date }) => `<item>
  <link>${lien}</link>
  ${categories.map((c) => `<category>${c}</category>`).join("\n  ")}
  <title>${titre}</title>
  <description>${description(desc)}</description>
  <pubDate>${date}</pubDate>
</item>`;

const LIEN_PSA = "https://jobs.groupe-psa.com/Pages/Offre/detailoffre.aspx?idOffre=19516&amp;idOrigine=502&amp;LCID=1036";

test("lieuDeLaDescription : lit l'étiquette « Ville »", () => {
  assert.equal(
    lieuDeLaDescription("<b>Contrat : </b>CDI<br /><b>Ville  : </b>SOCHAUX<br /><b>Langue : </b>FR"),
    "SOCHAUX",
  );
});

test("lieuDeLaDescription : lit aussi « Lieu de travail »", () => {
  // Chaque entreprise renomme ses étiquettes : SPIE et Dassault écrivent ceci.
  assert.equal(
    lieuDeLaDescription("<b>Type de contrat : </b>CDI<br /><b>Lieu de travail : </b>Marcoule<br />"),
    "Marcoule",
  );
});

test("lieuDeLaDescription : rend vide quand aucune étiquette de lieu n'existe", () => {
  // Cas réel d'Orange et Kronospan : ces offres ne portent aucun lieu.
  assert.equal(
    lieuDeLaDescription("<b>Pays / Type de contrat : </b>CDI<br /><b>Description du poste : </b>Bla"),
    "",
  );
});

test("offresDuFlux : lit titre, lien, identifiant et date", () => {
  const x = flux([item({
    lien: LIEN_PSA,
    categories: ["Engineering/Engineering", "CDI", "SOCHAUX"],
    titre: "2026-19516 - Chargé de Développement CAO",
    desc: "<b>Ville  : </b>SOCHAUX<br />",
    date: "Fri, 21 Aug 2026 07:39:24 Z",
  })]);

  const [o] = offresDuFlux(x);
  assert.equal(o.id, "19516");
  assert.equal(o.titre, "Chargé de Développement CAO");
  assert.equal(o.lieu, "SOCHAUX");
  assert.equal(o.pays, "");
  assert.equal(o.url, "https://jobs.groupe-psa.com/Pages/Offre/detailoffre.aspx?idOffre=19516&idOrigine=502&LCID=1036");
  assert.equal(o.publieLe, new Date("Fri, 21 Aug 2026 07:39:24 Z").toISOString());
});

test("offresDuFlux : le lieu vient de la description, JAMAIS de la dernière catégorie", () => {
  // ⚠️ Régression Orange : ses catégories finissent par le TYPE DE CONTRAT.
  // Une lecture positionnelle inventait une ville nommée « CDI ».
  const x = flux([item({
    lien: "https://orange-career.talent-soft.com/Pages/Offre/detailoffre.aspx?idOffre=7",
    categories: ["Réseaux/Technique", "CDI"],
    titre: "Ingénieur réseau",
    desc: "<b>Pays / Type de contrat : </b>CDI<br /><b>Description du poste : </b>Bla",
    date: "Fri, 21 Aug 2026 07:39:24 Z",
  })]);

  assert.equal(offresDuFlux(x)[0].lieu, "");
});

test("offresDuFlux : ne retire la référence du titre que si elle en est une", () => {
  const x = flux([
    item({ lien: "https://x.talent-soft.com/o.aspx?idOffre=1", titre: "2026-44376 - Alternant Conducteur", desc: "", date: "" }),
    item({ lien: "https://x.talent-soft.com/o.aspx?idOffre=2", titre: "Chef de projet 2026 - phase 2", desc: "", date: "" }),
  ]);

  const o = offresDuFlux(x);
  assert.equal(o[0].titre, "Alternant Conducteur");
  assert.equal(o[1].titre, "Chef de projet 2026 - phase 2");
});

test("offresDuFlux : un flux sans offre rend une liste vide", () => {
  assert.deepEqual(offresDuFlux(flux([])), []);
});

/**
 * Ce que `coordonneesDe` rend RÉELLEMENT — vérifié en direct le 21/08/2026.
 * ⚠️ Ne pas simplifier : c'est parce qu'un faux géocodeur rendait `dept` que le
 * défaut de nommage du département était passé inaperçu.
 */
const FORME_REELLE_BAN = { ville: "Sochaux", lat: 47.5, lng: 6.8, via: "commune", departement: "25" };

/** Géocodeur factice : ne connaît que les communes qu'on lui donne. */
const geocodeurFactice = (connues) => async (libelle) =>
  connues[libelle] ? { ...connues[libelle] } : null;

const fluxPsa = flux([
  item({
    lien: LIEN_PSA,
    categories: ["Engineering", "CDI", "SOCHAUX"],
    titre: "2026-19516 - Chargé de Développement",
    desc: "<b>Ville  : </b>SOCHAUX<br />",
    date: "Fri, 21 Aug 2026 07:39:24 Z",
  }),
  item({
    lien: "https://jobs.groupe-psa.com/Pages/Offre/detailoffre.aspx?idOffre=19517",
    categories: ["Engineering", "CDI", "Kenitra"],
    titre: "2026-19517 - Ingénieur",
    desc: "<b>Ville  : </b>Kenitra<br />",
    date: "Fri, 21 Aug 2026 07:39:24 Z",
  }),
]);

const reponse = (corps, status = 200) => async () => new Response(corps, { status });

test("listerTalentsoftFR : garde la France, écarte l'étranger", async () => {
  // ⚠️ Le flux LCID=1036 est celui de la LANGUE française, pas du PAYS France :
  // PSA y publie Kenitra et Amsterdam, et des locataires entiers sont suisses.
  const geo = geocodeurFactice({ SOCHAUX: FORME_REELLE_BAN });
  const r = await listerTalentsoftFR("jobs.groupe-psa.com", reponse(fluxPsa), geo);

  assert.equal(r.length, 1);
  assert.equal(r[0].lieu, "SOCHAUX");
  assert.equal(r[0].lat, 47.5);
});

test("listerTalentsoftFR : le département sort sous le nom qu'attend le reste de la chaîne", async () => {
  // ⚠️ Le géocodeur rend `departement`, le reste de la chaîne lit `dept`.
  // Le raccord DOIT se faire ici : `build-boards-offres.mjs` ne convertit que
  // les offres SANS coordonnées, or celles-ci en ont déjà. Sans cette
  // normalisation, les offres Talentsoft n'auraient jamais de département et le
  // filtre par région les écarterait toutes, en silence.
  const geo = geocodeurFactice({ SOCHAUX: FORME_REELLE_BAN });
  const [o] = await listerTalentsoftFR("jobs.groupe-psa.com", reponse(fluxPsa), geo);

  assert.equal(o.dept, "25");
  assert.equal(o.departement, undefined);
});

test("listerTalentsoftFR : ne laisse pas fuiter les champs de travail du géocodeur", async () => {
  // L'index des offres est réécrit chaque jour et pèse déjà plusieurs méga-octets :
  // `ville` et `via` ne servent à personne en aval.
  const geo = geocodeurFactice({ SOCHAUX: FORME_REELLE_BAN });
  const [o] = await listerTalentsoftFR("jobs.groupe-psa.com", reponse(fluxPsa), geo);

  assert.deepEqual(Object.keys(o).sort(), ["dept", "id", "lat", "lieu", "lng", "pays", "publieLe", "titre", "url"]);
});

test("listerTalentsoftFR : écarte les offres sans lieu", async () => {
  const x = flux([item({
    lien: "https://orange-career.talent-soft.com/o.aspx?idOffre=7",
    categories: ["Réseaux", "CDI"],
    titre: "Ingénieur réseau",
    desc: "<b>Type de contrat : </b>CDI<br />",
    date: "",
  })]);

  assert.deepEqual(await listerTalentsoftFR("orange-career.talent-soft.com", reponse(x), async () => null), []);
});

test("listerTalentsoftFR : 404 est un FAIT — pas de Talentsoft ici", async () => {
  assert.deepEqual(await listerTalentsoftFR("exemple.fr", reponse("", 404), async () => null), []);
});

test("listerTalentsoftFR : une réponse qui n'est pas du RSS est un fait, pas une panne", async () => {
  // La plupart des 60 000 hôtes candidats rendent une page HTML quelconque.
  assert.deepEqual(
    await listerTalentsoftFR("exemple.fr", reponse("<!DOCTYPE html><html>Bienvenue</html>"), async () => null),
    [],
  );
});

test("listerTalentsoftFR : un 5xx rend null — on ne sait pas", async () => {
  assert.equal(await listerTalentsoftFR("exemple.fr", reponse("", 503), async () => null), null);
});

test("listerTalentsoftFR : un réseau coupé rend null, jamais une liste vide", async () => {
  const f = async () => { throw new Error("ECONNRESET"); };
  assert.equal(await listerTalentsoftFR("exemple.fr", f, async () => null), null);
});

test("listerTalentsoftFR : ne géocode chaque libellé qu'une fois", async () => {
  // 512 offres pour 512 libellés chez SPIE, mais beaucoup se répètent : sans
  // dédoublonnage on rappelle la Base Adresse Nationale pour rien.
  const x = flux(["a", "b", "c"].map((s, i) => item({
    lien: `https://x.talent-soft.com/o.aspx?idOffre=${i}`,
    titre: `Poste ${s}`,
    desc: "<b>Ville : </b>Lyon<br />",
    date: "",
  })));

  let appels = 0;
  const geo = async (l) => { appels += 1; return l === "Lyon" ? { lat: 45.7, lng: 4.8 } : null; };
  const r = await listerTalentsoftFR("x.talent-soft.com", reponse(x), geo);

  assert.equal(r.length, 3);
  assert.equal(appels, 1);
});

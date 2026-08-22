import test from "node:test";
import assert from "node:assert/strict";
import { estCandidatCarriere, hotesCarrieres } from "./carrieres.mjs";

test("estCandidatCarriere : attrape les domaines propres, pas seulement les sous-domaines d'ATS", () => {
  // ⚠️ Ces deux-là sont la raison d'être du module : ni l'un ni l'autre n'est
  // sous un domaine d'ATS connu, et ni le préfixe SURT ni le devinage de slug
  // ne les trouvent. Ce sont pourtant les deux exemples d'origine du chantier.
  assert.equal(estCandidatCarriere("jobs.groupe-psa.com"), true);
  assert.equal(estCandidatCarriere("careers.bouygues-construction.com"), true);
});

test("estCandidatCarriere : attrape les formes françaises", () => {
  assert.equal(estCandidatCarriere("brgm-recrute.talent-soft.com"), true);
  assert.equal(estCandidatCarriere("recrutement.exemple.fr"), true);
  assert.equal(estCandidatCarriere("carriere.exemple.fr"), true);
  assert.equal(estCandidatCarriere("exemple-emploi.fr"), true);
});

test("estCandidatCarriere : ignore le site vitrine d'une entreprise", () => {
  assert.equal(estCandidatCarriere("www.bouygues-construction.com"), false);
  assert.equal(estCandidatCarriere("groupe-psa.com"), false);
});

test("estCandidatCarriere : exige un mot entier, pas une sous-chaîne", () => {
  // « jobteaser » contient « job » sans être le site carrière d'un employeur ;
  // sans frontière de mot, le filet ramasserait la moitié du web.
  assert.equal(estCandidatCarriere("www.jobteaser.com"), false);
  assert.equal(estCandidatCarriere("careerbuilder.com"), false);
});

test("estCandidatCarriere : tolère les entrées vides", () => {
  assert.equal(estCandidatCarriere(""), false);
  assert.equal(estCandidatCarriere(null), false);
});

test("hotesCarrieres : agrège les fichiers et dédoublonne", async () => {
  const parFichier = {
    "a.parquet": ["jobs.alpha.com", "www.alpha.com", "jobs.alpha.com"],
    "b.parquet": ["careers.beta.fr", "www.beta.fr", "jobs.alpha.com"],
  };
  const lire = async (chemin) => parFichier[chemin].map((h) => ({ url_host_name: h }));

  const r = await hotesCarrieres(["a.parquet", "b.parquet"], lire);
  assert.deepEqual([...r].sort(), ["careers.beta.fr", "jobs.alpha.com"]);
});

test("hotesCarrieres : un fichier en échec n'emporte pas les autres", async () => {
  // 300 fichiers : exiger qu'ils répondent tous, c'est ne jamais aboutir.
  const lire = async (chemin) => {
    if (chemin === "b.parquet") throw new Error("503");
    return [{ url_host_name: "jobs.alpha.com" }];
  };

  const r = await hotesCarrieres(["a.parquet", "b.parquet"], lire);
  assert.deepEqual([...r], ["jobs.alpha.com"]);
});

test("hotesCarrieres : ignore les lignes sans nom d'hôte", async () => {
  const lire = async () => [{ url_host_name: null }, { url_host_name: "" }, { url_host_name: "jobs.a.com" }];
  assert.deepEqual([...(await hotesCarrieres(["a.parquet"], lire))], ["jobs.a.com"]);
});

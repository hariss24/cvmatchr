import test from "node:test";
import assert from "node:assert/strict";
import { cle, mois, estFrais, nomDepuisSlug, trierIndex, trierMemo, fusionner } from "./memo.mjs";

test("la clé identifie un board", () => {
  assert.equal(cle("lever", "contentsquare"), "lever:contentsquare");
});

test("la date est au mois", () => {
  assert.equal(mois(new Date("2026-08-04T12:00:00Z")), "2026-08");
  assert.equal(mois(new Date("2026-01-31T23:00:00Z")), "2026-01");
});

// La TTL s'exprime en mois parce que le mémo date au mois : une durée en jours
// n'y serait pas calculable.
test("le mois courant et le précédent sont frais, le reste est périmé", () => {
  const d = new Date("2026-08-04T12:00:00Z");
  assert.equal(estFrais("2026-08", d), true);
  assert.equal(estFrais("2026-07", d), true);
  assert.equal(estFrais("2026-06", d), false);
  assert.equal(estFrais(undefined, d), false);
});

test("le passage de janvier remonte à décembre de l'année précédente", () => {
  const d = new Date("2026-01-15T12:00:00Z");
  assert.equal(estFrais("2025-12", d), true);
  assert.equal(estFrais("2025-11", d), false);
});

// La source A ne connaît que le slug : ni Ashby, ni Lever, ni Greenhouse
// n'exposent le nom de l'entreprise (vérifié le 04/08/2026).
test("le nom se déduit du slug faute de mieux", () => {
  assert.equal(nomDepuisSlug("contentsquare"), "Contentsquare");
  assert.equal(nomDepuisSlug("loft-orbital"), "Loft Orbital");
  assert.equal(nomDepuisSlug("on-running-fr"), "On Running Fr");
});

test("l'index est trié par nom puis par ats", () => {
  const t = trierIndex([
    { nom: "Zeta", ats: "lever", slug: "zeta" },
    { nom: "Alpha", ats: "lever", slug: "alpha" },
    { nom: "Alpha", ats: "ashby", slug: "alpha" },
  ]);
  assert.deepEqual(t.map((e) => `${e.nom}/${e.ats}`), ["Alpha/ashby", "Alpha/lever", "Zeta/lever"]);
});

test("le mémo est trié par clé", () => {
  const t = trierMemo([{ cle: "lever:b" }, { cle: "ashby:a" }]);
  assert.deepEqual(t.map((e) => e.cle), ["ashby:a", "lever:b"]);
});

test("fusionner ajoute les nouveaux boards", () => {
  const r = fusionner([], [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 192, siren: "602036444", vuLe: "2026-08" }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].offresFR, 192);
});

test("fusionner met à jour un board déjà connu", () => {
  const ancien = [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 100, siren: null, vuLe: "2026-06" }];
  const r = fusionner(ancien, [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 192, siren: "602036444", vuLe: "2026-08" }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].offresFR, 192);
  assert.equal(r[0].siren, "602036444");
});

// Un board retombé à zéro sort de l'index — mais seulement parce qu'on l'a
// CONSTATÉ. Un `null` n'arrive jamais jusqu'ici (voir ats.mjs).
test("fusionner retire un board tombé à zéro", () => {
  const ancien = [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 100, siren: null, vuLe: "2026-06" }];
  const r = fusionner(ancien, [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 0, siren: null, vuLe: "2026-08" }]);
  assert.deepEqual(r, []);
});

test("fusionner laisse intactes les entrées non retestées", () => {
  const ancien = [{ nom: "Swile", ats: "lever", slug: "swile", offresFR: 7, siren: null, vuLe: "2026-06" }];
  const r = fusionner(ancien, []);
  assert.deepEqual(r, ancien);
});

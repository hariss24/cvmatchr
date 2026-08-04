import test from "node:test";
import assert from "node:assert/strict";

import { cleOffre, jour, dater, reprendreIndetermines } from "./nouveaute.mjs";

const offre = (id, extra = {}) => ({ ats: "lever", slug: "acme", id, ...extra });

test("cleOffre distingue deux offres de boards différents", () => {
  assert.equal(cleOffre(offre("1")), "lever:acme:1");
  assert.notEqual(cleOffre({ ats: "ashby", slug: "acme", id: "1" }), cleOffre(offre("1")));
});

test("jour rend la date UTC au format court", () => {
  assert.equal(jour(new Date("2026-08-04T23:30:00.000Z")), "2026-08-04");
});

test("une offre déjà connue garde sa date de découverte", () => {
  const precedentes = [offre("1", { decouverteLe: "2026-07-01" })];
  const resultat = dater(precedentes, [offre("1")], "2026-08-04");
  assert.equal(resultat[0].decouverteLe, "2026-07-01");
});

test("une offre inconnue prend la date du jour", () => {
  const resultat = dater([], [offre("1")], "2026-08-04");
  assert.equal(resultat[0].decouverteLe, "2026-08-04");
});

test("une offre disparue ne réapparaît pas", () => {
  const precedentes = [offre("1", { decouverteLe: "2026-07-01" })];
  const resultat = dater(precedentes, [offre("2")], "2026-08-04");
  assert.deepEqual(resultat.map((o) => o.id), ["2"]);
});

test("un board indéterminé garde les offres du passage précédent", () => {
  const precedentes = [
    offre("1", { decouverteLe: "2026-07-01" }),
    { ats: "ashby", slug: "alan", id: "9", decouverteLe: "2026-07-02" },
  ];
  const repris = reprendreIndetermines(precedentes, new Set(["lever:acme"]));
  assert.deepEqual(repris.map((o) => o.id), ["1"]);
  assert.equal(repris[0].decouverteLe, "2026-07-01");
});

test("aucun board indéterminé, rien n'est repris", () => {
  assert.deepEqual(reprendreIndetermines([offre("1")], new Set()), []);
});

test("une offre reprise ne devient pas nouvelle en passant par dater", () => {
  const precedentes = [offre("1", { decouverteLe: "2026-07-01" })];
  const repris = reprendreIndetermines(precedentes, new Set(["lever:acme"]));
  const resultat = dater(precedentes, repris, "2026-08-04");
  assert.equal(resultat[0].decouverteLe, "2026-07-01");
});

test("les autres champs sont préservés", () => {
  const resultat = dater([], [offre("1", { titre: "Dev", lat: 48.8 })], "2026-08-04");
  assert.equal(resultat[0].titre, "Dev");
  assert.equal(resultat[0].lat, 48.8);
});

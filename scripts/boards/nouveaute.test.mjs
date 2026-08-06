import test from "node:test";
import assert from "node:assert/strict";

import { cleOffre, jour, dater, reprendreIndetermines, sansPerimees, PEREMPTION_JOURS } from "./nouveaute.mjs";

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

test("une offre revue récemment est gardée", () => {
  const offres = [offre("1", { vuLe: "2026-08-01" })];
  assert.deepEqual(sansPerimees(offres, "2026-08-10").map((o) => o.id), ["1"]);
});

test("une offre qu'aucun passage n'a revue depuis la péremption est écartée", () => {
  const offres = [offre("1", { vuLe: "2026-07-01" }), offre("2", { vuLe: "2026-08-09" })];
  assert.deepEqual(sansPerimees(offres, "2026-08-10").map((o) => o.id), ["2"]);
});

test("le jour exact de la péremption, l'offre est encore gardée", () => {
  const offres = [offre("1", { vuLe: "2026-07-27" })]; // 14 jours avant le 10/08
  assert.equal(PEREMPTION_JOURS, 14);
  assert.equal(sansPerimees(offres, "2026-08-10").length, 1);
  assert.equal(sansPerimees([offre("1", { vuLe: "2026-07-26" })], "2026-08-10").length, 0);
});

test("sans vuLe, l'offre est gardée — absence d'information n'est pas une preuve", () => {
  assert.equal(sansPerimees([offre("1")], "2026-08-10").length, 1);
  assert.equal(sansPerimees([offre("1", { vuLe: "" })], "2026-08-10").length, 1);
});

test("un board mort depuis un mois ne republie plus ses offres", () => {
  // Le scénario complet : board injoignable, offres reprises, puis périmées.
  const precedentes = [offre("1", { decouverteLe: "2026-06-01", vuLe: "2026-07-01" })];
  const repris = reprendreIndetermines(precedentes, new Set(["lever:acme"]));
  assert.equal(repris.length, 1, "la reprise ramène bien l'offre");
  assert.equal(sansPerimees(repris, "2026-08-10").length, 0, "mais la péremption l'écarte");
});

test("les autres champs sont préservés", () => {
  const resultat = dater([], [offre("1", { titre: "Dev", lat: 48.8 })], "2026-08-04");
  assert.equal(resultat[0].titre, "Dev");
  assert.equal(resultat[0].lat, 48.8);
});

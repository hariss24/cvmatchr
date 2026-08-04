import test from "node:test";
import assert from "node:assert/strict";
import { estFrancais } from "./france.mjs";

// Règle 1 — le champ pays structuré fait foi, on ne regarde pas le texte.
test("le pays structuré l'emporte sur le texte", () => {
  assert.equal(estFrancais("Berlin", "FR"), true);
  assert.equal(estFrancais("Paris, France", "US"), false);
  assert.equal(estFrancais("Lille", "fr"), true);
});

// Règle 2 — marqueur de pays explicite dans le texte.
test("reconnaît un marqueur de pays dans le texte", () => {
  assert.equal(estFrancais("Paris, France"), true);
  assert.equal(estFrancais("Anywhere in France"), true);
  assert.equal(estFrancais("Paris Area, France"), true);
  assert.equal(estFrancais("Montpellier, France"), true);
  assert.equal(estFrancais("Lille, fr"), true);
});

// Règle 3 — ville ou région. Sans elle, deux boards réels disparaissent.
test("reconnaît une région française sans marqueur de pays", () => {
  assert.equal(estFrancais("Toulouse, Occitanie"), true);
});

test("reconnaît une ville française seule", () => {
  assert.equal(estFrancais("Paris"), true);
  assert.equal(estFrancais("Sophia Antipolis"), true);
  assert.equal(estFrancais("Issy-les-Moulineaux"), true);
});

// Garde — sans elle, « Paris, TX » entre dans l'index.
test("rejette une ville homonyme à l'étranger", () => {
  assert.equal(estFrancais("Paris, TX"), false);
  assert.equal(estFrancais("Paris, Texas"), false);
});

// « Grande-Bretagne » contient « Bretagne » : le piège est réel.
test("ne prend pas la Grande-Bretagne pour la Bretagne", () => {
  assert.equal(estFrancais("Londres, Grande-Bretagne"), false);
});

test("rejette les lieux étrangers", () => {
  assert.equal(estFrancais("Berlin, Berlin, Germany"), false);
  assert.equal(estFrancais("Remote, Brasil"), false);
  assert.equal(estFrancais("Frankfurt"), false);
  assert.equal(estFrancais("Münster; Osnabrück"), false);
  assert.equal(estFrancais("New York, New York"), false);
});

test("rejette une entrée vide ou absente", () => {
  assert.equal(estFrancais(""), false);
  assert.equal(estFrancais("   "), false);
  assert.equal(estFrancais(undefined), false);
  assert.equal(estFrancais(null), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { fichiersInterdits } from "./verifier-perimetre.mjs";

// La boucle propose, le propriétaire implémente (décision du 02/08/2026). Toucher au
// code applicatif n'est plus « hors périmètre » : c'est le périmètre qui a changé de
// nature. Sans cette barrière, « rien implémenter » ne serait qu'une consigne de prompt.
test("le code applicatif est refusé", () => {
  const chemins = ["web/src/components/jobs/JobCard.tsx", "extension/content-autofill.js"];
  assert.deepEqual(fichiersInterdits(chemins), chemins);
});

test("un dossier inventé de toutes pièces est refusé", () => {
  assert.deepEqual(fichiersInterdits(["scripts/migration.ts"]), ["scripts/migration.ts"]);
});

test("les specs et les plans passent", () => {
  const chemins = ["docs/superpowers/specs/2026-08-02-x-design.md", "docs/archive/vieux.md"];
  assert.deepEqual(fichiersInterdits(chemins), []);
});

test("le classement des idées passe", () => {
  assert.deepEqual(fichiersInterdits(["boucle/IDEES.md"]), []);
});

test("les fichiers de suivi de la boucle passent", () => {
  const chemins = ["boucle/BACKLOG.md", "boucle/ETAT.md", "boucle/journal/2026-08-01.md"];
  assert.deepEqual(fichiersInterdits(chemins), []);
});

// Un agent qui peut réécrire sa planification ou ses permissions n'a plus de limites,
// seulement des limites qu'il consent à garder.
test("modifier son propre moteur est refusé", () => {
  assert.deepEqual(fichiersInterdits([".github/workflows/boucle.yml"]), [".github/workflows/boucle.yml"]);
});

test("modifier la CI est refusé", () => {
  assert.deepEqual(fichiersInterdits([".github/workflows/web.yml"]), [".github/workflows/web.yml"]);
});

test("réécrire sa propre mission est refusé", () => {
  assert.deepEqual(fichiersInterdits(["boucle/MISSION.md"]), ["boucle/MISSION.md"]);
});

test("réécrire ses propres mandats est refusé", () => {
  assert.deepEqual(fichiersInterdits(["boucle/roles/batisseur.md"]), ["boucle/roles/batisseur.md"]);
});

// Sans cette règle, la boucle pourrait affaiblir le garde-fou, et la version
// affaiblie validerait le diff qui l'a affaiblie.
test("désarmer son propre garde-fou est refusé", () => {
  const chemins = ["boucle/bin/verifier-perimetre.mjs", "boucle/bin/choisir-role.mjs"];
  assert.deepEqual(fichiersInterdits(chemins), chemins);
});

test("toucher à un fichier d'environnement est refusé", () => {
  const chemins = ["web/.env.local", ".env", "web/.env.production"];
  assert.deepEqual(fichiersInterdits(chemins), chemins);
});

test("les fautifs sont signalés au milieu de changements légitimes", () => {
  const chemins = ["boucle/IDEES.md", "boucle/MISSION.md", "boucle/journal/x.md"];
  assert.deepEqual(fichiersInterdits(chemins), ["boucle/MISSION.md"]);
});

// Les chemins arrivent de `git diff` : sur Windows le séparateur peut différer.
test("les séparateurs Windows sont reconnus", () => {
  assert.deepEqual(fichiersInterdits(["boucle\\MISSION.md"]), ["boucle\\MISSION.md"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { fichiersInterdits } from "./verifier-perimetre.mjs";

test("le code applicatif passe", () => {
  const chemins = ["web/src/components/jobs/JobCard.tsx", "web/src/lib/jobs/rank/index.ts"];
  assert.deepEqual(fichiersInterdits(chemins), []);
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
  const chemins = ["web/src/app/page.tsx", "boucle/MISSION.md", "README.md"];
  assert.deepEqual(fichiersInterdits(chemins), ["boucle/MISSION.md"]);
});

// Les chemins arrivent de `git diff` : sur Windows le séparateur peut différer.
test("les séparateurs Windows sont reconnus", () => {
  assert.deepEqual(fichiersInterdits(["boucle\\MISSION.md"]), ["boucle\\MISSION.md"]);
});

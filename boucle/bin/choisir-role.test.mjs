import { test } from "node:test";
import assert from "node:assert/strict";
import { choisirRole, lirePause, lireDernierRole, ROLES } from "./choisir-role.mjs";

test("la boucle n'a plus que deux rôles : elle explore et elle classe", () => {
  assert.deepEqual(ROLES, ["Éclaireur", "Arbitre"]);
});

// --- Alternance ---------------------------------------------------------------

test("au tout premier réveil, on explore", () => {
  assert.equal(choisirRole({ dernierRole: null }), "Éclaireur");
});

test("après un Éclaireur, on classe ce qu'il a rapporté", () => {
  assert.equal(choisirRole({ dernierRole: "Éclaireur" }), "Arbitre");
});

test("après un Arbitre, on repart explorer", () => {
  assert.equal(choisirRole({ dernierRole: "Arbitre" }), "Éclaireur");
});

// Un rôle disparu (Bâtisseur, Architecte, Gardien) ne doit pas bloquer l'alternance :
// l'ETAT.md du jour de la bascule en contient encore un.
test("un rôle inconnu dans ETAT.md fait repartir sur l'Éclaireur", () => {
  assert.equal(choisirRole({ dernierRole: "Bâtisseur" }), "Éclaireur");
});

// --- Lecture de l'état --------------------------------------------------------

test("le dernier rôle est lu dans la ligne d'ETAT.md", () => {
  assert.equal(lireDernierRole("- **Rôle joué :** Arbitre\n"), "Arbitre");
});

test("un ETAT.md sans la ligne ne fait pas planter le choix", () => {
  assert.equal(lireDernierRole("# ÉTAT\n\nrien d'utile\n"), null);
  assert.equal(lireDernierRole(null), null);
});

test("un rôle supprimé n'est pas reconnu comme dernier rôle", () => {
  assert.equal(lireDernierRole("- **Rôle joué :** Gardien\n"), null);
});

// --- Pause --------------------------------------------------------------------

test("sans fichier de pause, rien n'est gelé", () => {
  assert.equal(lirePause(null), null);
});

test("un fichier de pause nommant un rôle ne gèle que celui-là", () => {
  const pause = lirePause("Arbitre en pause : je veux relire le classement moi-même.");
  assert.deepEqual(pause.rolesGeles, ["Arbitre"]);
  assert.equal(choisirRole({ pause, dernierRole: "Éclaireur" }), "Éclaireur");
});

// Un fichier de pause sans nom de rôle est l'arrêt d'urgence : il gèle tout.
test("un fichier de pause sans nom de rôle arrête la boucle", () => {
  const pause = lirePause("Stop, je reprends la main.");
  assert.deepEqual(pause.rolesGeles, []);
  assert.equal(choisirRole({ pause, dernierRole: null }), "Pause");
});

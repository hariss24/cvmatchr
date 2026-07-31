import { test } from "node:test";
import assert from "node:assert/strict";
import { choisirRole, lireBacklog, lirePause } from "./choisir-role.mjs";

const VIDE = { pretACoder: false, constatSansPlan: false };

test("sans rien à faire, on explore", () => {
  assert.equal(choisirRole({ backlog: VIDE }), "Éclaireur");
});

test("une PR rouge passe avant tout le reste", () => {
  const backlog = { pretACoder: true, constatSansPlan: true };
  const pr = { rouge: true, heures: 1, brouillon: false };
  assert.equal(choisirRole({ pr, backlog }), "Gardien");
});

test("une PR verte mais figée depuis plus de 24 h réveille le Gardien", () => {
  const pr = { rouge: false, heures: 30, brouillon: false };
  assert.equal(choisirRole({ pr, backlog: VIDE }), "Gardien");
});

// Un plan inachevé se reprend, il ne se remplace pas : la spec impose une seule PR
// ouverte à la fois.
test("une PR en brouillon est reprise par le Bâtisseur", () => {
  const pr = { rouge: false, heures: 2, brouillon: true };
  assert.equal(choisirRole({ pr, backlog: { pretACoder: true, constatSansPlan: false } }), "Bâtisseur");
});

test("aucun nouveau chantier tant qu'une PR est ouverte", () => {
  const pr = { rouge: false, heures: 2, brouillon: false };
  const backlog = { pretACoder: true, constatSansPlan: false };
  assert.equal(choisirRole({ pr, backlog }), "Éclaireur");
});

test("un plan prêt et aucune PR ouverte lance le Bâtisseur", () => {
  assert.equal(choisirRole({ backlog: { pretACoder: true, constatSansPlan: false } }), "Bâtisseur");
});

test("un constat sans plan appelle l'Architecte", () => {
  assert.equal(choisirRole({ backlog: { pretACoder: false, constatSansPlan: true } }), "Architecte");
});

test("l'Architecte travaille même pendant qu'une PR est ouverte", () => {
  const pr = { rouge: false, heures: 2, brouillon: false };
  const backlog = { pretACoder: false, constatSansPlan: true };
  assert.equal(choisirRole({ pr, backlog }), "Architecte");
});

test("une pause sans nom de rôle arrête tout", () => {
  const pause = lirePause("En pause, je refais l'UI moi-même.");
  assert.equal(choisirRole({ pause, backlog: VIDE }), "Pause");
});

test("une pause nommant un rôle ne gèle que celui-là", () => {
  const pause = lirePause("Gel du Bâtisseur le temps que je tranche.");
  const backlog = { pretACoder: true, constatSansPlan: true };
  assert.equal(choisirRole({ pause, backlog }), "Architecte");
});

test("un rôle gelé cède la place au suivant, pas à l'arrêt", () => {
  const pause = lirePause("Gel du Gardien.");
  const pr = { rouge: true, heures: 1, brouillon: false };
  const backlog = { pretACoder: false, constatSansPlan: true };
  assert.equal(choisirRole({ pause, pr, backlog }), "Architecte");
});

test("l'absence de fichier de pause n'est pas une pause", () => {
  assert.equal(lirePause(null), null);
});

const BACKLOG = `# BACKLOG

## Prêt à coder

- Barre de filtres mémorisée — plan: docs/superpowers/plans/x.md

## À planifier

- ~~Idée refusée par le propriétaire~~

## En attente de feu vert

- [feu vert requis] Comptes utilisateurs — spec: docs/x.md
`;

test("une section peuplée est détectée", () => {
  assert.equal(lireBacklog(BACKLOG).pretACoder, true);
});

// Une ligne barrée est un refus explicite du propriétaire : elle ne doit jamais
// réveiller un rôle.
test("une ligne barrée ne compte pas", () => {
  assert.equal(lireBacklog(BACKLOG).constatSansPlan, false);
});

test("un chantier sous feu vert reste invisible sans !ok", () => {
  const texte = "# B\n\n## Prêt à coder\n\n- [feu vert requis] Comptes\n";
  assert.equal(lireBacklog(texte).pretACoder, false);
});

test("le !ok du propriétaire débloque le chantier", () => {
  const texte = "# B\n\n## Prêt à coder\n\n- !ok [feu vert requis] Comptes\n";
  assert.equal(lireBacklog(texte).pretACoder, true);
});

test("les sections absentes valent vide", () => {
  assert.deepEqual(lireBacklog("# BACKLOG\n"), { pretACoder: false, constatSansPlan: false });
});

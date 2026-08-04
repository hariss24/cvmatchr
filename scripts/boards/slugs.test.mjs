import test from "node:test";
import assert from "node:assert/strict";
import { normaliserNom, slugsCandidats } from "./slugs.mjs";

// ⚠️ VECTEURS JUMEAUX — les mêmes cas existent dans
// web/src/lib/jobs/ats.test.ts (describe « atsSlugs »). Les deux copies de la
// dérivation doivent rester identiques ; si tu modifies un cas ici, modifie-le
// là-bas aussi, sinon l'index et l'app ne parleront plus du même slug.

test("met en minuscules et retire les accents", () => {
  assert.equal(normaliserNom("Société Générale"), "societe-generale");
});

test("propose la variante collée en plus de la variante tiretée", () => {
  assert.deepEqual(slugsCandidats("Groupe SEB"), ["groupe-seb", "groupeseb"]);
});

test("ne propose qu'un slug quand les deux variantes sont identiques", () => {
  assert.deepEqual(slugsCandidats("Doctolib"), ["doctolib"]);
});

test("retire les apostrophes et la ponctuation", () => {
  assert.deepEqual(slugsCandidats("L'Oréal S.A."), ["l-oreal-s-a", "lorealsa"]);
});

test("ne renvoie rien pour un nom vide ou sans lettre", () => {
  assert.deepEqual(slugsCandidats(""), []);
  assert.deepEqual(slugsCandidats("   "), []);
  assert.deepEqual(slugsCandidats("---"), []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mesurer } from "./mesurer-pertinence.mjs";

test("mesurer-pertinence : rejoue la sélection et calcule les pertinents", () => {
  const fakeData = [
    {
      ats: "greenhouse",
      slug: "test1",
      id: "1",
      entreprise: "TestCorp",
      titre: "Chef de projet marketing digital",
      lieu: "Paris",
      url: "https://example.com/1",
      publieLe: new Date().toISOString(),
      decouverteLe: new Date().toISOString(),
    },
    {
      ats: "greenhouse",
      slug: "test2",
      id: "2",
      entreprise: "OtherCorp",
      titre: "Chef de projet supply chain",
      lieu: "Paris",
      url: "https://example.com/2",
      publieLe: new Date().toISOString(),
      decouverteLe: new Date().toISOString(),
    },
  ];

  const res = mesurer(["chef de projet marketing"], { data: fakeData });
  // Seule l'offre de marketing digital satisfait le critère conjonctif ;
  // l'offre de supply chain est désormais écartée.
  assert.equal(res.candidatsCount, 1);
  assert.equal(res.pertinentsDispos, 1);
  assert.equal(res.retenusCount, 1);
  assert.equal(res.pertinentsRetenus, 1);
});


/**
 * Ce script réimplémente la sélection de `web/src/lib/jobs/` parce qu'il est en
 * Node pur et ne peut pas importer du TypeScript. La duplication est assumée,
 * mais elle doit rester une COPIE : le 18/08/2026, une correction portée sur
 * `synonymes.ts` seul a laissé l'outil de mesure annoncer 1 offre là où le code
 * réel en rendait 9. Un outil de mesure qui ment est pire que pas d'outil.
 *
 * Ce test compare les tables des deux fichiers, terme à terme.
 */
test("les tables de synonymes du script et du code applicatif sont identiques", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const ici = dirname(fileURLToPath(import.meta.url));

  const script = readFileSync(resolve(ici, "mesurer-pertinence.mjs"), "utf8");
  const applicatif = readFileSync(
    resolve(ici, "../../web/src/lib/jobs/synonymes.ts"),
    "utf8",
  );

  /** Les chaînes littérales d'une déclaration `const <nom> = ...` jusqu'au `]);` ou `];`. */
  const table = (source, nom) => {
    const debut = source.indexOf(`const ${nom}`);
    assert.notEqual(debut, -1, `table ${nom} introuvable`);
    const fin = source.indexOf("]", source.indexOf("[", debut));
    const bloc = source.slice(debut, source.indexOf(";", fin));
    return [...bloc.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  };

  for (const nom of ["MOTS_VIDES", "MOTS_FONCTION"]) {
    assert.deepEqual(
      table(script, nom),
      table(applicatif, nom),
      `${nom} a divergé entre le script de mesure et synonymes.ts`,
    );
  }

  // GROUPES est imbriqué : on compare l'ensemble des termes, pas la structure.
  const termes = (source) => {
    const debut = source.indexOf("const GROUPES");
    const fin = source.indexOf("\n];", debut);
    return [...source.slice(debut, fin).matchAll(/"([^"]*)"/g)].map((m) => m[1]).sort();
  };
  assert.deepEqual(termes(script), termes(applicatif), "GROUPES a divergé");
});

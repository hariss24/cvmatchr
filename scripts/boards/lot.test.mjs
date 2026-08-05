import test from "node:test";
import assert from "node:assert/strict";
import { enLot } from "./lot.mjs";

test("traite tous les éléments", async () => {
  const r = await enLot([1, 2, 3, 4, 5], 2, async (n) => n * 2);
  assert.deepEqual([...r].sort((a, b) => a - b), [2, 4, 6, 8, 10]);
});

// Ces APIs sont publiques et gratuites : dépasser le plafond risquerait un
// bannissement d'IP qui coûterait la brique entière.
test("ne dépasse jamais le plafond de tâches simultanées", async () => {
  let enCours = 0;
  let maxVu = 0;
  await enLot(Array.from({ length: 30 }, (_, i) => i), 4, async () => {
    enCours += 1;
    maxVu = Math.max(maxVu, enCours);
    await new Promise((r) => setTimeout(r, 5));
    enCours -= 1;
  });
  assert.ok(maxVu <= 4, `${maxVu} tâches simultanées, plafond 4`);
});

test("une tâche qui jette n'emporte pas le lot", async () => {
  const r = await enLot([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error("boum");
    return n;
  });
  assert.deepEqual([...r].filter((x) => x !== null).sort(), [1, 3]);
});

// Mesuré le 05/08/2026 : sans frein, SmartRecruiters refuse 20 175 requêtes
// sur 25 000. La pause est la seule chose qui rende la passe PME exploitable.
test("la pause fait souffler chaque ouvrier entre deux éléments", async () => {
  const t0 = Date.now();
  await enLot([1, 2, 3, 4], 1, async (x) => x, 30);
  assert.ok(Date.now() - t0 >= 100, "quatre éléments à 30 ms de pause : au moins 120 ms attendues");
});

test("sans pause, rien ne ralentit le lot", async () => {
  const t0 = Date.now();
  await enLot([1, 2, 3, 4], 1, async (x) => x);
  assert.ok(Date.now() - t0 < 50);
});

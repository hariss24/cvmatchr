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

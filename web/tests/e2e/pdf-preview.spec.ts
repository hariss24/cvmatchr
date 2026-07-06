import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Moteur react-pdf (Phase 2 migration) : sur le template Graphique, l'aperçu est le vrai PDF
 * (canvas PDF.js) et « Convertir en PDF » télécharge le blob généré dans le navigateur,
 * sans aucun appel à `/api/convert`. Les autres templates gardent l'iframe HTML.
 */

test("le template Graphique bascule l'aperçu sur le moteur PDF", async ({ page }) => {
  await page.goto("/");
  // Since sobre is default and is PDF, it's pdf-preview
  await expect(page.getByTestId("pdf-preview").locator("canvas").first()).toBeVisible({ timeout: 15000 });

  await page.locator(".toolbar-select").selectOption("graphique");
  const preview = page.getByTestId("pdf-preview");
  await expect(preview).toBeVisible({ timeout: 15000 });
  await expect(preview.locator("canvas").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".page-badge")).toHaveText(/1 page/);

});

test("l'export du Graphique télécharge un PDF sans appeler le serveur", async ({ page }) => {
  let convertCalls = 0;
  await page.route("**/api/convert", (route) => {
    convertCalls++;
    return route.fulfill({ status: 500, json: { error: "ne doit pas être appelé" } });
  });

  await page.goto("/");
  await page.locator(".toolbar-select").selectOption("graphique");
  await expect(page.getByTestId("pdf-preview").locator("canvas").first()).toBeVisible({
    timeout: 15000,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Convertir en PDF" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const path = await download.path();
  expect(readFileSync(path).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(convertCalls).toBe(0);
});

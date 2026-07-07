import { test, expect } from "@playwright/test";

/**
 * Import PDF → CV (Phase 5). pdf.js rend le PDF en images PNG **dans le navigateur** ; on vérifie
 * que ces images partent bien vers `/api/pdf-to-resume` (mocké), et que le CV renvoyé peuple l'aperçu.
 */

test("l'import PDF rend les pages et peuple le CV depuis la réponse IA", async ({ page }) => {
  let sentBody: { images?: string[] } | null = null;
  await page.route("**/api/pdf-to-resume", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        resume: {
          name: "Marie Testeur",
          title: "Ingénieure QA",
          summary: "Profil importé depuis un PDF.",
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Importer un PDF" }).click();
  await page.locator(".import-modal .import-file").setInputFiles("tests/e2e/fixtures/sample.pdf");

  // Confirmation « L'import remplacera le CV actuel » (uiConfirm).
  await page.locator(".ui-dialog").getByRole("button", { name: "OK" }).click();

  // Le CV importé apparaît dans le store
  await page.waitForFunction(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { name: string } } } }).useDocStore.getState();
    return store.json.name === "Marie Testeur";
  }, { timeout: 15000 });
  const jsonName = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { name: string } } } }).useDocStore.getState();
    return store.json.name;
  });
  expect(jsonName).toBe("Marie Testeur");
  await expect(page.locator(".pdf-preview")).toBeVisible();

  // pdf.js a bien produit au moins une image PNG envoyée au serveur.
  expect(sentBody).not.toBeNull();
  expect(Array.isArray(sentBody!.images)).toBe(true);
  expect(sentBody!.images!.length).toBeGreaterThan(0);
  expect(sentBody!.images![0]).toMatch(/^data:image\/png;base64,/);
});

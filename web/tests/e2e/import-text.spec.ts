import { test, expect } from "@playwright/test";

/**
 * Import texte → CV structuré. `/api/text-to-resume` est mocké via `page.route` : le texte est
 * envoyé à l'IA qui renvoie un CV JSON → le formulaire (et l'aperçu) se remplissent.
 * (Le flux SSE `text-to-html` ne subsiste que pour le type « Lettre ».)
 */

test("l'import texte remplit le formulaire et l'aperçu depuis un CV JSON", async ({ page }) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route("**/api/text-to-resume", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      json: { resume: { name: "Jean Dupont", title: "Développeur web" } },
    });
  });

  await page.goto("/");
  // L'import texte vit sous Mode Expert → onglet « Importer ».
  await page.getByRole("button", { name: "Mode Expert" }).click();
  await page.locator(".expert-tabs").getByRole("button", { name: "Importer" }).click();
  await page.getByRole("button", { name: "Importer un texte" }).click();
  await page
    .locator(".import-modal .form-textarea")
    .fill("Jean Dupont\nDéveloppeur web");
  await page.locator(".import-modal").getByRole("button", { name: "Importer", exact: true }).click();

  // Le CV extrait apparaît dans l'aperçu (rendu depuis le JSON).
  await expect(
    page.frameLocator(".preview-frame").getByText("Jean Dupont"),
  ).toBeVisible();
  await expect(
    page.frameLocator(".preview-frame").getByText("Développeur web"),
  ).toBeVisible();

  // Le texte a bien été transmis à l'IA.
  expect(sentBody).not.toBeNull();
  expect(sentBody!.text).toContain("Jean Dupont");
});

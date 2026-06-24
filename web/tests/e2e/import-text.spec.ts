import { test, expect } from "@playwright/test";

/**
 * Import texte → HTML en streaming SSE (Phase 5). `/api/text-to-html` est mocké via `page.route`
 * en renvoyant un flux `text/event-stream` (data: <chunk JSON> / [DONE]).
 */

test("l'import texte convertit le texte en HTML affiché dans l'aperçu", async ({ page }) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route("**/api/text-to-html", async (route) => {
    sentBody = route.request().postDataJSON();
    const body =
      `data: ${JSON.stringify("<h1>Jean Dupont</h1>")}\n\n` +
      `data: ${JSON.stringify("<p>Développeur</p>")}\n\n` +
      "data: [DONE]\n\n";
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Importer un texte" }).click();
  await page
    .locator(".import-modal .form-textarea")
    .fill("Jean Dupont\nDéveloppeur web");
  await page.locator(".import-modal").getByRole("button", { name: "Convertir en HTML" }).click();

  // Le HTML converti apparaît dans l'aperçu.
  await expect(
    page.frameLocator(".preview-frame").getByText("Jean Dupont"),
  ).toBeVisible();
  await expect(
    page.frameLocator(".preview-frame").getByText("Développeur"),
  ).toBeVisible();

  // Le texte + le type de document ont bien été transmis.
  expect(sentBody).not.toBeNull();
  expect(sentBody!.text).toContain("Jean Dupont");
  expect(sentBody!.doc_type).toBe("CV");
});

import { test, expect } from "@playwright/test";

/**
 * Test fumée de l'éditeur CV Forge (clôture Phase 2).
 * Vérifie le flux principal : chargement sans erreur, saisie → aperçu live,
 * bascule CV → Lettre, et passage en mode expert (Monaco).
 */

test("la page charge sans erreur console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page.getByText("CV Tailor")).toBeVisible();
  // Laisse le rendu/aperçu initial se stabiliser.
  await expect(page.locator(".preview-frame")).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("saisir un nom met à jour l'aperçu", async ({ page }) => {
  await page.goto("/");

  const nameInput = page
    .locator(".form-field", { hasText: "Nom complet" })
    .locator(".form-input");
  await nameInput.fill("Zoé Testeuse");

  // L'aperçu (iframe srcDoc) doit refléter la saisie après le debounce.
  await expect(
    page.frameLocator(".preview-frame").getByText("Zoé Testeuse"),
  ).toBeVisible();
});

test("basculer CV → Lettre change le document", async ({ page }) => {
  await page.goto("/");

  // Le type de document se choisit dans la barre meta (#doc_type).
  await page.locator("#doc_type").selectOption("Lettre");

  // Le rendu d'une lettre contient la ligne « Objet : ».
  await expect(
    page.frameLocator(".preview-frame").getByText(/Objet\s*:/),
  ).toBeVisible();
});

test("le Mode Expert affiche l'éditeur Monaco (onglet HTML)", async ({ page }) => {
  await page.goto("/");

  // « Mode Expert » ouvre directement l'onglet HTML.
  await page.getByRole("button", { name: "Mode Expert" }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
});

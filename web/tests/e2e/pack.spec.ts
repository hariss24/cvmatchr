import { test, expect } from "@playwright/test";

/**
 * Pack candidature (Phase 5). `/api/generate-pack` est mocké via `page.route`.
 * On vérifie : génération → aperçu lettre + email, puis insertion dans l'éditeur (type « Lettre »).
 */

const LETTER_HTML = "<body><h1>Madame, Monsieur</h1><p>Lettre générée par l'IA.</p></body>";
const EMAIL_TEXT = "Bonjour,\n\nVeuillez trouver ma candidature.\n\nCordialement.";

test("le pack candidature génère lettre + email et insère la lettre dans l'éditeur", async ({
  page,
}) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route("**/api/generate-pack", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      json: { letter_html: LETTER_HTML, letter_css: "h1 { color: navy; }", email: EMAIL_TEXT },
    });
  });

  await page.goto("/");
  // Le pack se lance depuis la modale « Adapter à une offre ».
  await page.getByRole("button", { name: "Adapter à une offre" }).click();
  await page.getByRole("button", { name: "Créer le Pack candidature" }).click();
  await page
    .locator(".pack-modal .form-textarea")
    .first()
    .fill("Développeur Full Stack React/Node, télétravail.");
  await page.locator(".pack-modal").getByRole("button", { name: "Générer le pack" }).click();

  // L'aperçu de la lettre et l'email s'affichent.
  await expect(
    page.frameLocator(".pack-letter-frame").getByText("Madame, Monsieur"),
  ).toBeVisible();
  await expect(page.locator(".pack-result textarea")).toHaveValue(EMAIL_TEXT);

  // Le CV (HTML) a bien été envoyé au serveur (clé cv_html présente).
  expect(sentBody).not.toBeNull();
  expect(sentBody!.cv_html).toBeTruthy();

  // Insertion dans l'éditeur → bascule sur le type « Lettre » et l'aperçu montre la lettre.
  await page.getByRole("button", { name: /Insérer dans l'éditeur/ }).click();
  await expect(page.locator("#doc_type")).toHaveValue("Lettre");
  await expect(
    page.frameLocator(".preview-frame").getByText("Lettre générée par l'IA."),
  ).toBeVisible();
});

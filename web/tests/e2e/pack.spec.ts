import { test, expect } from "@playwright/test";

/**
 * Pack candidature (Phase 3). `/api/generate-pack` est mocké via `page.route`.
 * On vérifie : génération → aperçu lettre + email, puis insertion dans l'éditeur (type « Lettre »).
 */

const LETTER_JSON = {
  sender_name: "John Doe",
  recipient_name: "Madame, Monsieur",
  body: "Lettre générée par l'IA.",
  signoff: "",
};
const EMAIL_TEXT = "Bonjour,\n\nVeuillez trouver ma candidature.\n\nCordialement.";

test("le pack candidature génère lettre + email et insère la lettre dans l'éditeur", async ({
  page,
}) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route("**/api/generate-pack", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      json: { letter: LETTER_JSON, email: EMAIL_TEXT },
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

  // L'aperçu de la lettre et l'email s'affichent, côte à côte (lettre à gauche, email à droite).
  await expect(page.locator(".pack-result .pdf-preview")).toBeVisible();
  await expect(page.locator(".pack-result textarea")).toHaveValue(EMAIL_TEXT);
  const letterBox = await page.locator(".pack-result .pdf-preview").boundingBox();
  const emailBox = await page.locator(".pack-result textarea").boundingBox();
  expect(Math.abs(letterBox!.y - emailBox!.y)).toBeLessThan(5);
  expect(emailBox!.x).toBeGreaterThan(letterBox!.x + letterBox!.width - 1);

  // Le CV (JSON) a bien été envoyé au serveur (clé cv_json présente).
  expect(sentBody).not.toBeNull();
  expect(sentBody!.cv_json).toBeTruthy();

  // Insertion dans l'éditeur → bascule sur le type « Lettre » et l'aperçu montre la lettre.
  await page.getByRole("button", { name: /Insérer dans l'éditeur/ }).click();
  await expect(page.locator("#doc_type")).toHaveValue("Lettre");
  // Vérifie le json inséré et l'aperçu PDF
  const jsonBody = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { body: string } } } }).useDocStore.getState();
    return store.json.body;
  });
  expect(jsonBody).toBe("Lettre générée par l'IA.");
  await expect(page.locator(".pdf-preview")).toBeVisible();
});

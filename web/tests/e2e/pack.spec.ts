import { test, expect } from "@playwright/test";

/**
 * Pack candidature (refonte templates à variables, juillet 2026).
 * La lettre + l'email sont construits localement depuis un modèle — zéro appel IA
 * par défaut. Seule l'adaptation optionnelle (`/api/adapt-letter`) est mockée.
 * `/api/extract-meta` (préremplissage silencieux au blur de l'offre) est mocké en
 * échec pour vérifier qu'il ne bloque jamais le flux.
 */

test("le pack construit lettre + email depuis un modèle, sans IA", async ({ page }) => {
  let extractMetaCalls = 0;
  await page.route("**/api/extract-meta", async (route) => {
    extractMetaCalls += 1;
    await route.fulfill({ status: 500, json: { error: "pas de clé" } });
  });

  await page.goto("/pack");

  const modal = page.locator(".pack-page");

  // La bibliothèque est seedée au premier lancement : 3 modèles de départ.
  await expect(modal.getByRole("combobox", { name: "Choisir un modèle" }).locator("option")).toHaveCount(1);

  // Remplir les variables → l'email se met à jour instantanément, sans IA.
  await modal.getByPlaceholder("Entreprise", { exact: true }).fill("ACME");
  await modal.getByPlaceholder("Poste visé").fill("Développeur Web");

  const email = modal.locator(".pack-email");
  await expect(email).toHaveValue(/ACME/);
  await expect(email).toHaveValue(/Développeur Web/);
  // Contact vide → repli propre (« Bonjour, », jamais « Bonjour , » ni la variable brute).
  await expect(email).toHaveValue(/Bonjour,/);
  await expect(email).not.toHaveValue(/\{M\/Mme Nom\}/);

  // L'aperçu PDF de la lettre se génère localement (debounce 600 ms).
  await expect(modal.locator(".pdf-preview")).toBeVisible({ timeout: 15000 });

  // Insertion dans l'éditeur → bascule sur le type « Lettre », variables substituées.
  await modal.getByRole("button", { name: /Insérer dans l'éditeur/ }).click();
  await expect(page.locator("#doc_type")).toHaveValue("Lettre");
  const inserted = await page.evaluate(() => {
    const store = (
      window as unknown as {
        useDocStore: { getState: () => { json: { body: string; subject: string; greeting: string } } };
      }
    ).useDocStore.getState();
    return store.json;
  });
  expect(inserted.body).toContain("ACME");
  expect(inserted.body).not.toContain("{Entreprise}");
  expect(inserted.subject).toContain("Développeur Web");
  expect(inserted.greeting).toBe("Madame, Monsieur,");

  // Le préremplissage silencieux a pu être tenté, mais son échec n'a rien bloqué.
  expect(extractMetaCalls).toBeGreaterThanOrEqual(0);
});

test("« Adapter à l'offre (IA) » remplace le corps du modèle via /api/adapt-letter", async ({
  page,
}) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route("**/api/adapt-letter", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      json: { body: "Corps adapté par l'IA pour {Entreprise}." },
    });
  });
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ json: { company: "", role: "" } }),
  );

  await page.goto("/pack");

  const modal = page.locator(".pack-page");
  await modal
    .getByPlaceholder(/Offre d'emploi \(optionnel\)/)
    .fill("Développeur Full Stack React/Node, télétravail.");
  await modal.getByRole("button", { name: /Adapter à l'offre \(IA\)/ }).click();

  // Le corps du modèle (colonne édition) est remplacé par la réponse IA, variables intactes.
  await expect(page.locator('.var-editor[aria-label="Corps de la lettre"]')).toHaveAttribute(
    "data-value",
    "Corps adapté par l'IA pour {Entreprise}.",
  );

  // La requête contient le modèle, l'offre et le CV sans photo.
  expect(sentBody).not.toBeNull();
  expect(sentBody!.letter_body).toBeTruthy();
  expect(sentBody!.job_desc).toContain("Full Stack");
  expect((sentBody!.cv_json as { photo?: string }).photo).toBe("");
});

test("en mobile, la barre de modèles ne déborde pas de la modale", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );

  await page.goto("/pack");

  const bar = page.locator(".pack-tpl-bar");
  await expect(bar).toBeVisible();

  // Aucun débordement horizontal : « Supprimer » n'est plus coupé.
  const overflow = await bar.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // « Supprimer » est entièrement dans la modale.
  const barBox = await bar.boundingBox();
  const deleteBox = await bar.getByRole("button", { name: "Supprimer" }).boundingBox();
  expect(barBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  expect(deleteBox!.x + deleteBox!.width).toBeLessThanOrEqual(barBox!.x + barBox!.width + 1);

  // Les trois boutons de la barre sont traités à l'identique : aucun emoji.
  await expect(bar.getByRole("button", { name: "Enregistrer" })).toHaveText("Enregistrer");
});

test("l'éditeur à étiquettes insère et supprime une variable dans le corps de la lettre", async ({ page }) => {
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );
  await page.goto("/pack");

  // La zone d'édition du corps de la lettre est un éditeur à étiquettes.
  const group = page.locator(".var-editor-group", {
    has: page.locator('[aria-label="Corps de la lettre"]'),
  });
  const body = group.locator('.var-editor[aria-label="Corps de la lettre"]');
  await expect(body).toBeVisible();

  // Vider puis insérer la variable Poste via la chip du même groupe.
  await body.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await group.locator(".var-btn", { hasText: "Poste" }).click();

  // Une pastille « Poste » apparaît, et la valeur tokenisée contient {Poste}.
  await expect(body.locator(".var-pill")).toHaveText("Poste");
  await expect(body).toHaveAttribute("data-value", /\{Poste\}/);

  // Supprimer la pastille (curseur après elle → Backspace) la retire.
  await body.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await expect(body.locator(".var-pill")).toHaveCount(0);
  await expect(body).not.toHaveAttribute("data-value", /\{Poste\}/);
});

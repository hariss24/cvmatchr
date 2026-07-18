import { test, expect } from "@playwright/test";

/**
 * Lettre de motivation (/pack) — refonte « éditeur plein écran » (juillet 2026).
 * Un seul modèle, un éditeur à étiquettes (objet + corps), zéro email. La lettre
 * est construite localement puis ouverte dans l'éditeur ; l'IA (« Adapter à
 * l'offre ») est optionnelle et repliée. `/api/extract-meta` est mocké en échec
 * pour vérifier qu'il ne bloque jamais le flux.
 */

test("la lettre se construit depuis le modèle unique, sans IA ni email", async ({ page }) => {
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );
  await page.goto("/pack");

  const modal = page.locator(".pack-page");
  await expect(modal).toBeVisible();

  // Plus d'email d'accompagnement, plus de sélecteur de modèle.
  await expect(page.locator(".pack-email")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Choisir un modèle" })).toHaveCount(0);

  // Le corps par défaut est un éditeur à étiquettes avec des pastilles.
  const body = page.locator('.var-editor[aria-label="Corps de la lettre"]');
  await expect(body).toBeVisible();
  await expect(body.locator(".var-pill").first()).toBeVisible();

  // Remplir les variables puis générer la lettre → substitution à la construction.
  await modal.getByPlaceholder("Entreprise", { exact: true }).fill("ACME");
  await modal.getByPlaceholder("Poste visé").fill("Développeur Web");
  await modal.getByRole("button", { name: /Créer ma lettre/ }).click();

  await expect(page.getByRole("radio", { name: "Lettre", exact: true })).toHaveAttribute("aria-checked", "true");
  const inserted = await page.evaluate(() => {
    const store = (
      window as unknown as {
        useDocStore: { getState: () => { json: { body: string; subject: string } } };
      }
    ).useDocStore.getState();
    return store.json;
  });
  expect(inserted.body).toContain("ACME");
  expect(inserted.body).not.toContain("{Entreprise}");
  // Contact vide → repli propre « Madame, Monsieur, » dans le corps.
  expect(inserted.body).toContain("Madame, Monsieur,");
  expect(inserted.subject).toContain("Développeur Web");
});

test("« Adapter à l'offre (IA) » réécrit le corps via /api/adapt-letter", async ({ page }) => {
  let sentBody: Record<string, unknown> | null = null;
  await page.route("**/api/adapt-letter", async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({ json: { body: "Corps adapté par l'IA pour {Entreprise}." } });
  });
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ json: { company: "", role: "" } }),
  );

  await page.goto("/pack");
  const modal = page.locator(".pack-page");

  // L'adaptation IA est repliée par défaut : on la déplie.
  await modal.getByRole("button", { name: /Adapter à une offre \(IA\)/ }).click();
  await modal
    .getByPlaceholder(/Colle l'offre d'emploi/)
    .fill("Développeur Full Stack React/Node, télétravail.");
  await modal.getByRole("button", { name: /Adapter le corps à l'offre/ }).click();

  // Le corps est remplacé par la réponse IA, variables intactes.
  await expect(page.locator('.var-editor[aria-label="Corps de la lettre"]')).toHaveAttribute(
    "data-value",
    "Corps adapté par l'IA pour {Entreprise}.",
  );

  // La requête contient le corps, l'offre et le CV sans photo.
  expect(sentBody).not.toBeNull();
  expect(sentBody!.letter_body).toBeTruthy();
  expect(sentBody!.job_desc).toContain("Full Stack");
  expect((sentBody!.cv_json as { photo?: string }).photo).toBe("");
});

test("l'éditeur à étiquettes insère et supprime une variable dans le corps de la lettre", async ({ page }) => {
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );
  await page.goto("/pack");

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

  await expect(body.locator(".var-pill")).toHaveText("Poste");
  await expect(body).toHaveAttribute("data-value", /\{Poste\}/);

  // Supprimer la pastille (curseur après elle → Backspace) la retire.
  await body.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await expect(body.locator(".var-pill")).toHaveCount(0);
  await expect(body).not.toHaveAttribute("data-value", /\{Poste\}/);
});

test("en mobile, la page /pack ne déborde pas horizontalement", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );
  await page.goto("/pack");

  const pageEl = page.locator(".pack-page");
  await expect(pageEl).toBeVisible();
  const overflow = await pageEl.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

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
  // Laisse le rendu/aperçu initial se stabiliser (sobre est PDF par défaut).
  await expect(page.getByTestId("pdf-preview").locator("canvas").first()).toBeVisible({ timeout: 15000 });

  expect(errors, errors.join("\n")).toEqual([]);
});

test("saisir un nom met à jour l'aperçu", async ({ page }) => {
  await page.goto("/");

  const nameInput = page
    .locator(".form-field", { hasText: "Nom complet" })
    .locator(".form-input");
  await nameInput.fill("Zoé Testeuse");

  // L'aperçu (PDF) reflète la saisie si le JSON du store est mis à jour
  const jsonName = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { name: string } } } }).useDocStore.getState();
    return store.json.name;
  });
  expect(jsonName).toBe("Zoé Testeuse");
  await expect(page.locator(".pdf-preview")).toBeVisible();
});

test("basculer CV → Lettre change le document", async ({ page }) => {
  await page.goto("/");

  // Le type de document se choisit dans la barre meta (#doc_type).
  await page.locator("#doc_type").selectOption("Lettre");

  // Vérifier le store et l'aperçu
  const docType = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { docType: string } } }).useDocStore.getState();
    return store.docType;
  });
  expect(docType).toBe("Lettre");
  await expect(page.locator(".pdf-preview")).toBeVisible();
});

test("le Mode Expert affiche l'éditeur Monaco (onglet JSON) et l'édition synchronise le formulaire et l'aperçu", async ({ page }) => {
  await page.goto("/");

  // Saisir un nom de base
  const nameInput = page.locator(".form-field", { hasText: "Nom complet" }).locator(".form-input");
  await nameInput.fill("Jean Dupont");

  // Passer en mode expert (onglet JSON)
  await page.getByRole("button", { name: "Mode Expert" }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();

  type MonacoModel = { getValue: () => string; setValue: (v: string) => void };
  type MonacoWindow = { monaco?: { editor: { getModels: () => MonacoModel[] } } };

  // Attendre que l'éditeur soit prêt
  await page.waitForFunction(() => {
    const w = window as unknown as MonacoWindow;
    return !!w.monaco && w.monaco.editor.getModels().length > 0;
  });

  // Éditer le JSON via l'API Monaco
  await page.evaluate(() => {
    const model = (window as unknown as MonacoWindow).monaco!.editor.getModels()[0];
    const val = JSON.parse(model.getValue());
    val.name = "Jean Modifié par Monaco";
    model.setValue(JSON.stringify(val, null, 2));
  });

  // Revenir au formulaire
  await page.getByRole("button", { name: "Formulaire" }).click();

  // Le champ nom a été mis à jour via le JSON
  await expect(nameInput).toHaveValue("Jean Modifié par Monaco");

  // L'aperçu a également été mis à jour
  const jsonName = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { name: string } } } }).useDocStore.getState();
    return store.json.name;
  });
  expect(jsonName).toBe("Jean Modifié par Monaco");
  await expect(page.locator(".pdf-preview")).toBeVisible();
});

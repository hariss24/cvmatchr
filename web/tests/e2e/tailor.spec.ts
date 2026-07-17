import { test, expect } from "@playwright/test";

/**
 * Flux d'adaptation IA (Phase 5) avec le backend `/api/tailor-resume` mocké via `page.route`.
 * Vérifie : ouverture de la modale, envoi de l'offre, mise à jour de l'aperçu avec le CV adapté.
 */

test("adapter à une offre met à jour l'aperçu", async ({ page }) => {
  // Backend mocké : renvoie un CV adapté (le serveur normalise d'ordinaire ; le client normalise aussi).
  await page.route("**/api/tailor-resume", async (route) => {
    const body = route.request().postDataJSON() as { resume?: { photo?: string } };
    // La photo ne doit jamais être transmise au serveur (retirée côté client).
    expect(body.resume?.photo ?? "").toBe("");
    await route.fulfill({
      json: {
        resume: {
          name: "Profil Adapté IA",
          experience: [{ title: "Poste adapté", company: "Acme" }],
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Adapter à une offre" }).click();
  await page
    .locator("#job-desc-input")
    .fill("Développeur Frontend React / TypeScript");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Adapter le CV" })
    .click();

  // L'aperçu reflète le CV adapté
  await page.waitForFunction(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { name: string } } } }).useDocStore.getState();
    return store.json.name === "Profil Adapté IA";
  }, { timeout: 10000 });
  await expect(page.locator(".pdf-preview")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("le niveau d'adaptation est un segmented control : les 3 cellules ont un contenant", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adapter à une offre" }).click();

  const cells = page.locator(".tailor-level-list .tailor-level-item");
  await expect(cells).toHaveCount(3);

  // Aucune cellule n'est un texte nu : toutes ont un fond et une ombre.
  for (let i = 0; i < 3; i += 1) {
    const bg = await cells.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    const shadow = await cells.nth(i).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
  }

  // Seule la cellule sélectionnée est en relief (« Adapté » par défaut).
  await expect(page.locator(".tailor-level-item.active")).toHaveCount(1);
  await expect(page.locator(".tailor-level-item.active .tailor-level-title")).toHaveText("Adapté");
});

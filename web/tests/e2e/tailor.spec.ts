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
    .locator(".tailor-modal-content")
    .getByRole("button", { name: "Adapter le CV" })
    .click();

  // L'aperçu reflète le CV adapté
  await page.waitForFunction(() => (window as any).useDocStore.getState().json.name === "Profil Adapté IA", { timeout: 10000 });
  await expect(page.locator(".pdf-preview")).toBeVisible();
  await page.locator(".tailor-modal-content").getByRole("button", { name: "Fermer" }).click();
  await expect(page.locator(".tailor-modal-content")).toHaveCount(0);
});

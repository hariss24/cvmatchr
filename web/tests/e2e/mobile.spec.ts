import { test, expect } from "@playwright/test";

/**
 * Parcours mobile (viewport téléphone). La topbar tient sur une ligne :
 * la navigation secondaire vit dans le menu ☰ (panneau latéral).
 */
test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("le menu ☰ donne accès à la navigation secondaire", async ({ page }) => {
    await page.goto("/");

    // Sur mobile, Offres/Historique ne sont pas dans la topbar…
    await expect(page.locator(".topbar").getByRole("link", { name: "Offres" })).toBeHidden();

    // …mais dans le menu ☰.
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.locator(".mobile-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Offres" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Historique" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Nouveau CV" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Paramètres API" })).toBeVisible();

    // Navigation réelle depuis le menu.
    await menu.getByRole("link", { name: "Offres" }).click();
    await expect(page).toHaveURL(/\/jobs/);
  });

  test("l'aperçu est en tête, le formulaire s'ouvre en tiroir", async ({ page }) => {
    await page.goto("/");

    // L'aperçu PDF est visible dans le premier écran, sans scroller.
    const preview = page.locator(".pane.preview-pane");
    await expect(preview).toBeVisible();
    const box = await preview.boundingBox();
    expect(box!.y).toBeLessThan(500);

    // Le formulaire est masqué par défaut…
    const editor = page.locator(".pane.editor-pane");
    await expect(editor.getByText("Informations personnelles")).not.toBeInViewport();

    // …et s'ouvre via le bouton ✏️ de la topbar.
    await page.getByRole("button", { name: "Modifier le contenu" }).click();
    await expect(editor.getByText("Informations personnelles")).toBeInViewport();

    // Une saisie dans le tiroir met à jour le document, puis « Terminé » referme.
    await editor.getByText("Nom complet").locator("xpath=following-sibling::input").fill("Test Mobile");
    await page.getByRole("button", { name: "Terminé" }).click();
    await expect(editor.getByText("Informations personnelles")).not.toBeInViewport();

    // Le CTA « Adapter à une offre » est visible sans scroller (barre épinglée).
    await expect(page.getByRole("button", { name: "Adapter à une offre" })).toBeInViewport();
  });
  test("le header de l'Historique tient dans l'écran (Retour et thème accessibles)", async ({ page }) => {
    await page.goto("/history");

    // Toutes les actions du header sont entièrement visibles dans le viewport.
    for (const name of ["↑ Importer", "↓ Exporter"]) {
      await expect(page.getByRole("button", { name })).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole("link", { name: "‹ Retour" })).toBeInViewport({ ratio: 1 });
    // Le switcher de thème n'apparaît pas sur mobile (il vit dans le menu ☰ de l'éditeur).
    await expect(page.locator("#btn-theme")).toBeHidden();

    // Et la page ne défile pas horizontalement.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("la loupe agrandit l'aperçu (défilement horizontal)", async ({ page }) => {
    await page.goto("/");
    const container = page.locator(".pdf-preview");
    await expect(container.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    // Ajusté à l'écran : la page ne déborde pas.
    const fitted = await container.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fitted).toBe(true);

    await page.getByRole("button", { name: "Agrandir l'aperçu" }).click();

    // Zoomé : le canvas dépasse et défile horizontalement.
    const zoomed = await container.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(zoomed).toBe(true);

    await page.getByRole("button", { name: "Réduire l'aperçu" }).click();
    const back = await container.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(back).toBe(true);
  });
});

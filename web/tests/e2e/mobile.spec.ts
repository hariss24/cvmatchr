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
});

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
    await page.locator(".topbar-burger").click();
    const menu = page.locator(".mobile-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Offres" })).toBeVisible();
    // « Historique » a été absorbée par « Candidatures » (commit d0d9082, 25/07).
    await expect(menu.getByRole("link", { name: "Candidatures" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Nouveau CV" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Paramètres & Dashboard" })).toBeVisible();

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
  test("le header de Mes candidatures tient dans l'écran (actions et navigation accessibles)", async ({ page }) => {
    // « Historique » a été absorbée par « Candidatures » (commit d0d9082, 25/07) :
    // /history redirige désormais vers /candidatures.
    await page.goto("/candidatures");

    // Toutes les actions du header sont entièrement visibles dans le viewport.
    await expect(page.getByRole("button", { name: "Ajouter" })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("link", { name: "Retour" })).toBeInViewport({ ratio: 1 });

    // Sur les pages secondaires (Historique, Offres), la nav segmentée n'est PAS
    // masquée sur mobile : elle reflue en pleine largeur sous le header au lieu
    // de disparaître (cf. globals.css `.topbar--secondary .topbar-center`,
    // @media max-width: 900px). Seule la topbar principale (éditeur) la cache.
    const nav = page.locator(".topbar-center");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Candidatures" })).toBeInViewport({ ratio: 1 });

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

import { test, expect } from "@playwright/test";

/**
 * L'enregistrement est automatique depuis le 16/08 : il n'y a plus de bouton
 * « Enregistrer ». Ce fichier vérifiait l'inverse — il vérifie maintenant que
 * l'utilisateur non connecté est invité à créer un compte plutôt que laissé
 * devant un « Modifications non enregistrées » qu'aucun geste ne résolvait.
 */
test.describe("Enregistrement automatique", () => {
  test("sans compte : rien ne part, et l'état le dit sans crier à la panne", async ({ page }) => {
    await page.goto("/");

    const saveState = page.locator(".save-state");

    // Au calme, l'état ne dit rien et ne mange pas la barre.
    await expect(saveState).toBeEmpty();

    const nameInput = page
      .locator(".form-field", { hasText: "Nom complet" })
      .locator(".form-input");
    await nameInput.fill("Camille Martin");

    // Non connecté : ce n'est ni un échec ni un enregistrement.
    await expect(saveState).toHaveAttribute("data-state", "anonymous");
    await expect(saveState).toHaveText("Non enregistré");
    await expect(saveState).toHaveAttribute(
      "title",
      /Connectez-vous/,
    );
  });

  test("le bouton « Enregistrer » a disparu de la barre du haut", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Enregistrer", exact: true })).toHaveCount(0);
  });
});

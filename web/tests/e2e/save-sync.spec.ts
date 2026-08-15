import { test, expect } from "@playwright/test";

test.describe("Enregistrement explicite et état d'enregistrement", () => {
  test("le bouton Enregistrer invite à se connecter si non connecté et l'état reste dirty", async ({ page }) => {
    await page.goto("/");

    // 1. État initial
    const saveState = page.locator(".save-state");
    await expect(saveState).toBeVisible();

    // 2. Saisie d'un nom de candidat
    const nameInput = page
      .locator(".form-field", { hasText: "Nom complet" })
      .locator(".form-input");
    await nameInput.fill("Camille Martin");

    // L'indicateur affiche Modifications non enregistrées
    await expect(saveState).toHaveAttribute("data-state", "dirty");
    await expect(saveState).toHaveText("Modifications non enregistrées");

    // 3. Clic sur le bouton Enregistrer sans être connecté -> dialogue d'information
    const saveBtn = page.getByRole("button", { name: "Enregistrer" });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // La modale d'alerte s'affiche
    await expect(page.locator(".ui-dialog")).toBeVisible();
    await expect(page.locator(".ui-dialog__message")).toBeVisible();

    // Fermer le dialogue
    await page.locator(".ui-dialog__ok").click();
    await expect(page.locator(".ui-dialog")).toBeHidden();

    // L'état reste dirty car non enregistré sans compte
    await expect(saveState).toHaveAttribute("data-state", "dirty");
  });
});

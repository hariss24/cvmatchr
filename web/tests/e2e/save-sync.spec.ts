import { test, expect } from "@playwright/test";

test.describe("Enregistrement explicite et état d'enregistrement", () => {
  test("le bouton Enregistrer persiste le document localement et met à jour l'indicateur d'état", async ({ page }) => {
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

    // 3. Clic sur le bouton Enregistrer
    const saveBtn = page.getByRole("button", { name: "Enregistrer" });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 4. L'indicateur passe à « Enregistré sur cet appareil » (car non connecté)
    await expect(saveState).toHaveAttribute("data-state", "device");
    await expect(saveState).toHaveText("Enregistré sur cet appareil");

    // 5. Modification suivante -> repasse immédiatement à dirty
    await nameInput.fill("Camille Martin-Dupont");
    await expect(saveState).toHaveAttribute("data-state", "dirty");
    await expect(saveState).toHaveText("Modifications non enregistrées");

    // 6. Enregistrement à nouveau
    await saveBtn.click();
    await expect(saveState).toHaveAttribute("data-state", "device");

    // 7. Navigation vers « Mes candidatures » (/candidatures) -> présent dans « Mes CV »
    await page.goto("/candidatures");
    await expect(page.getByText("Mes CV")).toBeVisible();
    await expect(page.getByText("Dernier CV exporté")).toBeVisible();
  });

  test("enregistrer avec entreprise et poste rattache la candidature automatiquement", async ({ page }) => {
    await page.goto("/");

    // Renseigner entreprise et poste dans la MetaBar
    await page.locator("#company").fill("Doctolib");
    await page.locator("#role").fill("Frontend Engineer");

    const saveBtn = page.getByRole("button", { name: "Enregistrer" });
    await saveBtn.click();

    const saveState = page.locator(".save-state");
    await expect(saveState).toHaveAttribute("data-state", "device");

    await page.goto("/candidatures");
    await expect(page.getByText("Doctolib")).toBeVisible();
    await expect(page.getByText("Frontend Engineer")).toBeVisible();
  });
});


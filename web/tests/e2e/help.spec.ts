import { test, expect } from "@playwright/test";

test("l'aide « Comment ça marche ? » s'ouvre et se ferme", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("help-open").click();
  const dialog = page.getByRole("dialog", { name: "Comment ça marche ?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("CV Maître");
  await expect(dialog).toContainText("Ctrl+Entrée");
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(dialog).toHaveCount(0);
});

test("« Régler ma clé API » ouvre l'invite de clé", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("help-open").click();
  await page.getByRole("button", { name: "Régler ma clé API" }).click();
  await expect(page.getByText("Collez votre clé API")).toBeVisible();
});

test("l'aide se ferme par la croix, sans bouton « Fermer » redondant en pied", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("help-open").click();
  const dialog = page.getByRole("dialog", { name: "Comment ça marche ?" });
  await expect(dialog).toBeVisible();

  // La croix en haut à droite est la convention unique.
  await expect(dialog.locator(".ui-dialog__close")).toBeVisible();
  // Elle n'est pas doublée par un pied d'actions.
  await expect(dialog.locator(".ui-dialog__actions")).toHaveCount(0);

  await dialog.locator(".ui-dialog__close").click();
  await expect(dialog).toHaveCount(0);
});

import { test, expect } from "@playwright/test";

test.describe("Page d'aide et FAQ", () => {
  test("La page d'aide s'affiche et explique le fonctionnement local", async ({ page }) => {
    // 1. Accéder à l'accueil
    await page.goto("/");
    
    // 2. Cliquer sur le lien "Comment ça marche"
    await page.getByTestId("help-open").click();
    
    // 3. Vérifier qu'on est sur la page d'aide
    await expect(page).toHaveURL(/.*\/help/);
    await expect(page.locator("h1")).toContainText("Comment fonctionne CVMatchr ?");
    
    // 4. Vérifier la présence du texte sur le fonctionnement sans compte
    // Phrase complète : « sans créer de compte » seul apparaît aussi dans la FAQ (clé API).
    await expect(
      page.getByText("Vous pouvez l'utiliser immédiatement, sans créer de compte."),
    ).toBeVisible();
    await expect(
      page.locator("text=vos documents restent stockés uniquement dans votre navigateur"),
    ).toBeVisible();
  });

  test("Les accordéons de la FAQ s'ouvrent et se ferment", async ({ page }) => {
    await page.goto("/help");

    // Vérifier la présence d'une question (accordéon `<button className="faq-summary">`
    // piloté par state React depuis le commit 5dc0a01, plus un <details>/<summary>).
    const firstQuestion = page.locator(".faq-summary").filter({ hasText: "Comment démarrer en 4 étapes ?" });
    await expect(firstQuestion).toBeVisible();

    // Le contenu est caché par défaut : l'état ouvert/fermé est porté par `aria-expanded`.
    await expect(firstQuestion).toHaveAttribute("aria-expanded", "false");

    // Cliquer pour ouvrir
    await firstQuestion.click();
    await expect(firstQuestion).toHaveAttribute("aria-expanded", "true");

    // Cliquer pour fermer
    await firstQuestion.click();
    await expect(firstQuestion).toHaveAttribute("aria-expanded", "false");
  });

  test("« Régler ma clé API » ouvre l'invite de clé depuis la FAQ", async ({ page }) => {
    await page.goto("/help");

    // Ouvrir l'accordéon correspondant
    const apiKeyQuestion = page.locator(".faq-summary").filter({ hasText: "clé API" });
    await apiKeyQuestion.click();
    
    // Cliquer sur le bouton
    await page.getByRole("button", { name: "Régler ma clé API" }).click();
    
    // Vérifier que la modale (prompt) native ou UI apparait
    // Note: promptApiKey() lance la modale sweetalert / uiPrompt
    await expect(page.getByText("Collez votre clé API")).toBeVisible();
  });
});

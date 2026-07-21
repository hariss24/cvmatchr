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
    
    // 4. Vérifier la présence du texte sur le fonctionnement local
    await expect(page.locator("text=100% privé")).toBeVisible();
    await expect(page.locator("text=stockés directement dans le stockage local de votre navigateur")).toBeVisible();
  });

  test("Les accordéons de la FAQ s'ouvrent et se ferment", async ({ page }) => {
    await page.goto("/help");
    
    // Vérifier la présence d'une question
    const firstQuestion = page.locator("summary").filter({ hasText: "Comment démarrer rapidement en 4 étapes ?" });
    await expect(firstQuestion).toBeVisible();
    
    // Le contenu (ol.help-steps) est caché par défaut par le navigateur sur un <details> non-ouvert.
    const detailsNode = firstQuestion.locator(".."); // Le parent <details>
    await expect(detailsNode).not.toHaveAttribute("open", "");
    
    // Cliquer pour ouvrir
    await firstQuestion.click();
    await expect(detailsNode).toHaveAttribute("open", "");
    
    // Cliquer pour fermer
    await firstQuestion.click();
    await expect(detailsNode).not.toHaveAttribute("open", "");
  });

  test("« Régler ma clé API » ouvre l'invite de clé depuis la FAQ", async ({ page }) => {
    await page.goto("/help");
    
    // Ouvrir l'accordéon correspondant
    const apiKeyQuestion = page.locator("summary").filter({ hasText: "clé API" });
    await apiKeyQuestion.click();
    
    // Cliquer sur le bouton
    await page.getByRole("button", { name: "Régler ma clé API" }).click();
    
    // Vérifier que la modale (prompt) native ou UI apparait
    // Note: promptApiKey() lance la modale sweetalert / uiPrompt
    await expect(page.getByText("Collez votre clé API")).toBeVisible();
  });
});

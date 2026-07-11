import { test, expect } from "@playwright/test";

test.describe("Profil - Mes informations", () => {
  test("sauvegarde les informations et pré-remplit les nouveaux CV", async ({ page }) => {
    // 1. Aller sur l'accueil puis la page profil
    await page.goto("/");
    await page.click("button[aria-label='Mes informations']");
    
    // 2. Remplir quelques champs
    await page.fill("input[placeholder='Prénom *']", "Jean");
    await page.fill("input[placeholder='Nom *']", "Dupont");
    await page.fill("input[placeholder='Email *']", "jean.dupont@example.com");
    await page.fill("input[placeholder='Téléphone *']", "0601020304");
    await page.fill("input[placeholder='Ville *']", "Paris");
    
    // Attendre le debounce de sauvegarde
    await page.waitForTimeout(1000);

    // 3. Retour à l'accueil
    await page.click("button:has-text('Retour')");
    
    // Attendre que la page se charge
    await page.waitForURL("/");
    await expect(page.locator(".editor-pane")).toBeVisible();

    // 4. Créer un nouveau CV
    await page.click("button:has-text('Nouveau CV')");
    await page.click("button:has-text('Nouveau CV')"); // Confirm the prompt modal
    
    // 5. Vérifier que les champs d'identité du CV sont pré-remplis
    const editor = page.locator(".editor-pane");
    await expect(editor.locator("input[aria-label='Nom complet']")).toHaveValue("Jean Dupont");
    await expect(editor.locator("input[aria-label='Email']")).toHaveValue("jean.dupont@example.com");
    await expect(editor.locator("input[aria-label='Téléphone']")).toHaveValue("0601020304");
    await expect(editor.locator("input[aria-label='Lieu']")).toHaveValue("Paris");
    
    // 6. Aller sur l'onglet Lettre et vérifier l'identité
    await page.goto("/pack");
    
    // Variables de la lettre
    const vars = page.locator(".pack-vars");
    // La variable Prénom et Nom devraient être remplies, mais elles ne sont pas dans des inputs de la lettre pour l'utilisateur final. 
    // Cependant on peut voir que la lettre générée contient "Jean Dupont" à la fin par exemple, ou dans l'en-tête.
    // L'en-tête de la lettre (objet etc.) on peut juste vérifier que le preview n'est pas cassé.
    await expect(page.locator("text=Jean Dupont")).toBeVisible();
  });
});

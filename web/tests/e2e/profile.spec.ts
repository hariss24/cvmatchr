import { test, expect } from "@playwright/test";

test.describe("Profil - Mes informations", () => {
  test("sauvegarde les informations et pré-remplit les nouveaux CV", async ({ page }) => {
    // 1. Aller sur l'accueil puis la page profil
    await page.goto("/");
    await page.click("a[href='/profil']");
    
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
    await page.locator(".ui-dialog__ok").click(); // Confirm the prompt modal
    
    // 5. Vérifier que les champs d'identité du CV sont pré-remplis
    const editor = page.locator(".editor-pane");
    await expect(editor.locator(".form-field:has-text('Nom complet') input")).toHaveValue("Jean Dupont");
    await expect(editor.locator(".form-field:has-text('Email') input")).toHaveValue("jean.dupont@example.com");
    await expect(editor.locator(".form-field:has-text('Téléphone') input")).toHaveValue("0601020304");
    await expect(editor.locator(".form-field:has-text('Ville, Pays') input")).toHaveValue("Paris");
    
    // 6. La page Lettre s'ouvre avec le profil chargé (l'identité de l'en-tête
    // vient de resolveLetterIdentity, couvert par les tests unitaires). Ici on
    // vérifie juste que la lettre est constructible : le bouton « Créer ma lettre »
    // n'est actif que si l'identité a bien été résolue.
    await page.goto("/pack");
    await expect(page.locator(".pack-page")).toBeVisible();
    await expect(page.getByRole("button", { name: /Créer ma lettre/ })).toBeEnabled();
  });
});

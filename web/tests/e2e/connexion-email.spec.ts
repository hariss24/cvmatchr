import { test, expect } from '@playwright/test';

test.describe('Connexion par email', () => {
  test('la page propose les deux chemins', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.getByRole('heading', { name: /se connecter/i })).toBeVisible();
    await expect(page.getByLabel(/adresse email/i)).toBeVisible();
    await expect(page.getByLabel(/^mot de passe$/i)).toBeVisible();
  });

  test('une adresse invalide est refusée sans appel réseau', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel(/adresse email/i).fill('pas-une-adresse');
    await page.getByLabel(/^mot de passe$/i).fill('motdepasse');
    await page.getByRole('button', { name: /^se connecter$/i }).click();
    await expect(page.getByText(/adresse email n'est pas valide/i)).toBeVisible();
  });

  test('mot de passe oublié masque le champ mot de passe', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByRole('button', { name: /mot de passe oublié/i }).click();
    await expect(page.getByLabel(/^mot de passe$/i)).toHaveCount(0);
    await expect(page.getByLabel(/adresse email/i)).toBeVisible();
  });

  test('la page de nouveau mot de passe répond au lieu de rester muette', async ({ page }) => {
    await page.goto('/connexion/nouveau-mot-de-passe');
    await page.getByLabel(/nouveau mot de passe/i).fill('court');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.locator('.connexion__erreur')).toBeVisible();
  });
});

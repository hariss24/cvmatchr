import { test, expect } from "@playwright/test";

/**
 * Chat éditeur (Phase 3) avec `/api/editor-chat` mocké via `page.route`.
 * Vérifie : ouverture du panneau, envoi d'un message (en JSON), affichage de la réponse + proposition,
 * application de la proposition (le JSON du store change → l'aperçu HTML/PDF reflète la proposition).
 */

test("le chat applique une proposition JSON à l'aperçu", async ({ page }) => {
  await page.route("**/api/editor-chat", async (route) => {
    const body = route.request().postDataJSON() as { doc_json?: { photo?: string; [k: string]: unknown } };
    // La photo base64 ne doit jamais partir vers l'IA (retirée côté client).
    expect(body.doc_json?.photo ?? "").toBe("");
    
    await route.fulfill({
      json: {
        reply: "Voici une proposition adaptée.",
        proposals: [
          {
            id: "p1",
            title: "Titre plus impactant",
            summary: "Met en avant le poste visé.",
            json: {
              ...body.doc_json,
              title: "Développeur IA Sénior"
            },
          },
        ],
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Assistant IA" }).click();

  await page.locator(".chat-input").fill("Rends le titre plus percutant");
  await page.locator(".chat-panel").getByRole("button", { name: "Envoyer" }).click();

  // Réponse + proposition affichées.
  await expect(page.getByText("Voici une proposition adaptée.")).toBeVisible();
  await expect(page.getByText("Titre plus impactant")).toBeVisible();

  // Application → l'aperçu reflète la proposition, la carte passe en "appliquée".
  await page.getByRole("button", { name: "Appliquer" }).click();
  // On vérifie que le texte 'Développeur IA Sénior' est dans le store et le PDF visible.
  const jsonTitle = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { json: { title: string } } } }).useDocStore.getState();
    return store.json.title;
  });
  expect(jsonTitle).toBe("Développeur IA Sénior");
  await expect(page.locator(".pdf-preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Appliquer" })).toBeDisabled();
});

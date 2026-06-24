import { test, expect } from "@playwright/test";

/**
 * Chat éditeur (Phase 5) avec `/api/editor-chat` mocké via `page.route`.
 * Vérifie : ouverture du panneau, envoi d'un message, affichage de la réponse + proposition,
 * application de la proposition (le HTML/CSS du store change → l'aperçu reflète la proposition).
 */

const PROPOSAL_HTML =
  "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\"><style>body{color:#111}</style></head><body><h1>CV Modifié IA</h1></body></html>";

test("le chat applique une proposition à l'aperçu", async ({ page }) => {
  await page.route("**/api/editor-chat", async (route) => {
    const body = route.request().postDataJSON() as { html?: string };
    // La photo base64 ne doit jamais partir vers l'IA (retirée côté client).
    expect(body.html ?? "").not.toContain("data:image/");
    await route.fulfill({
      json: {
        reply: "Voici une proposition adaptée.",
        proposals: [
          {
            id: "p1",
            title: "Titre plus impactant",
            summary: "Met en avant le poste visé.",
            html: PROPOSAL_HTML,
            css: "",
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
  await expect(page.frameLocator(".preview-frame").getByText("CV Modifié IA")).toBeVisible();
  await expect(page.getByRole("button", { name: "Appliquer" })).toBeDisabled();
});

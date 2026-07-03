import { test, expect } from "@playwright/test";

/**
 * Onglet « Offres » (backend `/api/jobs/*` mocké via `page.route`). Vérifie : le scan affiche une
 * carte notée, « Adapter mon CV » ouvre l'éditeur avec la modale pré-remplie, « Masquer » retire
 * la carte, et l'écran de configuration s'affiche si les clés manquent.
 */

const OFFER = {
  id: "1",
  title: "Webmaster SEO",
  company: "ACME",
  location: "75 - Paris",
  commuteDestination: "48.8,2.3",
  url: "https://example.fr/offre/1",
  jobText: "Offre de Webmaster SEO chez ACME, missions SEO et WordPress.",
  publishedAt: "2026-06-30T10:00:00Z",
};

async function mockScanOk(page: import("@playwright/test").Page) {
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER] } }),
  );
  await page.route("**/api/jobs/score", (route) =>
    route.fulfill({
      json: { score: 88, breakdown: { total_score: 88 }, commute: { transit: "25 min" }, commuteText: "TC: 25 min" },
    }),
  );
}

test("le scan affiche une offre notée, datée et marquée « Nouveau »", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();

  const card = page.getByTestId("job-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Webmaster SEO");
  await expect(card).toContainText("88");
  await expect(card).toContainText("TC: 25 min");
  await expect(card).toContainText("Publié le 30/06/2026");
  await expect(card.getByTestId("job-new")).toBeVisible();
});

test("« Adapter mon CV » ouvre l'éditeur avec la modale pré-remplie", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);

  await page.getByTestId("job-adapt").click();

  // Navigation vers l'éditeur + TailorModal pré-remplie avec le texte de l'offre.
  await expect(page.locator("#job-desc-input")).toHaveValue(/Webmaster SEO chez ACME/);
});

test("« Pas intéressé » retire l'offre, « Annuler » la restaure", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);

  await page.getByTestId("job-dismiss").click();
  await expect(page.getByTestId("job-card")).toHaveCount(0);

  // Le toast propose « Annuler » → l'offre revient.
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);
});

test("une offre déjà explorée n'est pas re-notée, et le badge s'efface au clic", async ({ page }) => {
  let scoreCalls = 0;
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER] } }),
  );
  await page.route("**/api/jobs/score", (route) => {
    scoreCalls++;
    route.fulfill({ json: { score: 88, breakdown: { total_score: 88 }, commute: {}, commuteText: "TC: 25 min" } });
  });
  // Empêche le popup « Voir l'offre » de partir sur le réseau.
  await page.route("**example.fr**", (route) => route.fulfill({ body: "ok" }));

  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);
  await expect(page.getByTestId("jobs-scan")).toBeEnabled();
  expect(scoreCalls).toBe(1);

  // 2e scan : l'offre est déjà en base → pas de nouvelle notation, badge « Nouveau » conservé.
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("jobs-scan")).toBeEnabled();
  expect(scoreCalls).toBe(1);
  await expect(page.getByTestId("job-new")).toBeVisible();

  // Clic sur « Voir l'offre » → l'offre est consultée → le badge disparaît.
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Voir l'offre" }).click(),
  ]);
  await popup.close();
  await expect(page.getByTestId("job-new")).toHaveCount(0);
});

test("une offre sans recoupement mots-clés n'est pas notée", async ({ page }) => {
  let scoreCalls = 0;
  const OFFTOPIC = { ...OFFER, id: "2", title: "Boulanger", jobText: "Pétrin, four et pâtisserie artisanale." };
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER, OFFTOPIC] } }),
  );
  await page.route("**/api/jobs/score", (route) => {
    scoreCalls++;
    route.fulfill({ json: { score: 88, breakdown: { total_score: 88 }, commute: {}, commuteText: "TC: 25 min" } });
  });

  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);
  await expect(page.getByTestId("jobs-scan")).toBeEnabled();
  expect(scoreCalls).toBe(1); // seule l'offre pertinente (OFFER) est notée
});

test("l'encart de notation s'ouvre et affiche la grille", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");

  const info = page.getByTestId("scoring-info");
  await expect(info).toBeVisible();
  await info.locator("summary").click();
  await expect(info.getByText("Technique")).toBeVisible();
  await expect(info.getByText("Seuil de sélection")).toBeVisible();
});

test("écran de configuration si les clés manquent", async ({ page }) => {
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ status: 400, json: { error: "config", message: "Configurez FT_CLIENT_ID et FT_CLIENT_SECRET." } }),
  );
  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("jobs-config")).toContainText("Configurez FT_CLIENT_ID");
});

import { test, expect } from "@playwright/test";

/**
 * Onglet « Offres » (backend `/api/jobs/*` mocké via `page.route`). Vérifie : le scan affiche une
 * carte classée, « Adapter mon CV » ouvre l'éditeur avec la modale pré-remplie, le menu « ⋯ »
 * donne accès à « Pas intéressé » qui retire la carte, et l'écran de configuration s'affiche si
 * les clés manquent.
 *
 * Depuis le 28/07 (spec notation-lettres), le classement est **local, sans IA** (`lib/jobs/rank/`) :
 * il n'y a plus de route `/api/jobs/score`, plus de score affiché dans la carte (seule la lettre,
 * calculée, sert au tri — cf. JobCard.tsx:61), et le trajet n'est plus calculé pendant le scan mais
 * au dépliage de l'offre via `POST /api/jobs/commute`.
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
  // Champs requis par `JobOffer` (lib/jobs/offer.ts) : sans eux, `rankOffer` plante sur
  // `offer.contractLabel.toUpperCase()` (undefined), le scan échoue silencieusement et
  // zéro `job-card` n'apparaît — c'était le vrai bug derrière l'ancien fixture incomplet.
  contractLabel: "",
  salaryLabel: "",
  boardDomain: "",
  boardName: "",
  logoUrl: "",
  source: "francetravail",
};

async function mockScanOk(page: import("@playwright/test").Page) {
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER], calls: { francetravail: 1, adzuna: 0, jsearch: 0 }, failed: [] } }),
  );
}

/**
 * Depuis le 22/07 (commit bb315e8), le bouton « Rechercher » reste désactivé
 * tant qu'aucun mot-clé métier n'est renseigné (`canScan`, décision produit
 * volontaire — cf. JobsView.tsx `canScan = profile.keywords.length >= 1`).
 * Renseigne un mot-clé libre (Entrée) avant de pouvoir lancer un scan.
 */
async function fillKeyword(page: import("@playwright/test").Page) {
  await page.route("**/api/jobs/metiers*", (route) => route.fulfill({ json: { results: [] } }));
  await page.getByLabel("Poste recherché").fill("Webmaster");
  await page.getByLabel("Poste recherché").press("Enter");
}

/** Ouvre le menu « ⋯ » d'une carte : « Candidater », « Suivre » et « Pas intéressé » y vivent
 *  désormais (cf. JobCard.tsx), pour ne pas surcharger la carte de cinq boutons visibles. */
async function openMenu(card: import("@playwright/test").Locator) {
  await card.getByTestId("job-menu-toggle").click();
}

test("le scan affiche une offre classée et marquée « Nouveau », sans score chiffré", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();

  const card = page.getByTestId("job-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Webmaster SEO");
  await expect(card.getByTestId("job-new")).toBeVisible();
  // La lettre n'est plus affichée (JobCard.tsx:61) : c'est le détail du classement
  // (« job-why »), pas un score, qui justifie le rang à l'écran.
  await expect(card.getByTestId("job-why")).toBeVisible();
});

test("« Adapter mon CV » ouvre l'éditeur avec la modale pré-remplie", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);

  await page.getByTestId("job-adapt").click();

  // Navigation vers l'éditeur + TailorModal pré-remplie avec le texte de l'offre.
  await expect(page.locator("#job-desc-input")).toHaveValue(/Webmaster SEO chez ACME/);
});

test("« Pas intéressé » (menu ⋯) retire l'offre, « Annuler » la restaure", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();
  const card = page.getByTestId("job-card");
  await expect(card).toHaveCount(1);

  await openMenu(card);
  await page.getByTestId("job-dismiss").click();
  await expect(page.getByTestId("job-card")).toHaveCount(0);

  // Le toast propose « Annuler » → l'offre revient.
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);
});

test("une offre déjà en base n'est pas dupliquée au rescan, et le badge s'efface au clic", async ({ page }) => {
  let searchCalls = 0;
  await page.route("**/api/jobs/search", (route) => {
    searchCalls++;
    route.fulfill({ json: { offers: [OFFER], calls: { francetravail: 1, adzuna: 0, jsearch: 0 }, failed: [] } });
  });
  // Empêche le popup « Voir l'offre » de partir sur le réseau.
  await page.route("**example.fr**", (route) => route.fulfill({ body: "ok" }));

  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);
  await expect(page.getByTestId("jobs-scan")).toBeEnabled();
  expect(searchCalls).toBe(1);

  // 2e scan : la recherche part bien à nouveau (aucun cache côté requête), mais
  // l'offre est déjà en base (`jobExists`, JobsView.scanGroupe) → pas de doublon,
  // et l'entrée existante n'est pas retouchée : le badge « Nouveau » est conservé.
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("jobs-scan")).toBeEnabled();
  expect(searchCalls).toBe(2);
  await expect(page.getByTestId("job-card")).toHaveCount(1);
  await expect(page.getByTestId("job-new")).toBeVisible();

  // Clic sur « Voir l'offre » → l'offre est consultée → le badge disparaît.
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Voir l'offre" }).click(),
  ]);
  await popup.close();
  await expect(page.getByTestId("job-new")).toHaveCount(0);
});

test("une offre sans recoupement mots-clés est conservée mais classée après la pertinente", async ({ page }) => {
  // Depuis la notation locale (spec notation-lettres §3.5), `shouldPersist` garde
  // TOUJOURS l'offre — plus de rejet serveur sous un seuil. La pertinence ne se
  // traduit plus par une absence de notation, mais par un rang plus bas dans la liste
  // (`listJobs` trie par score décroissant, cf. storage/db.ts).
  const OFFTOPIC = {
    ...OFFER,
    id: "2",
    title: "Boulanger",
    company: "Fournil du Coin",
    jobText: "Pétrin, four et pâtisserie artisanale.",
  };
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER, OFFTOPIC], calls: { francetravail: 1, adzuna: 0, jsearch: 0 }, failed: [] } }),
  );

  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();

  const cards = page.getByTestId("job-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Webmaster SEO");
  await expect(cards.nth(1)).toContainText("Boulanger");
});

test("l'encart de notation s'ouvre et affiche la grille des critères", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");

  const info = page.getByTestId("scoring-info");
  await expect(info).toBeVisible();
  await info.locator("summary").click();
  // Grille à jour (ScoringInfo.tsx) : critères réels du barème local, plus de
  // « Technique » ni de « Seuil de sélection » (notions de l'ancienne notation IA).
  await expect(info.getByText("Compétences & missions")).toBeVisible();
  await expect(info.getByText("Métier", { exact: true })).toBeVisible();
  await expect(info.getByText("Aucune note n'est")).toBeVisible();
});

test("écran de configuration si les clés manquent", async ({ page }) => {
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ status: 400, json: { error: "config", message: "Configurez FT_CLIENT_ID et FT_CLIENT_SECRET." } }),
  );
  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("jobs-config")).toContainText("Configurez FT_CLIENT_ID");
});

test("dans le pied de carte, seule « Adapter mon CV » est une primaire pleine", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);

  // « Adapter mon CV » (.job-cta) est la seule primaire : fond en dégradé orange.
  const adaptBg = await page
    .getByTestId("job-adapt")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(adaptBg).toContain("gradient");

  // « Voir l'offre » (.job-ghost) n'a aucun dégradé : c'est un bouton de contour neutre.
  const view = page.getByRole("link", { name: "Voir l'offre" });
  const viewBg = await view.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(viewBg).toBe("none");

  // Sa couleur de texte est neutre (« muted »), pas du blanc comme la primaire.
  const viewColor = await view.evaluate((el) => getComputedStyle(el).color);
  expect(viewColor).not.toBe("rgb(255, 255, 255)");
});

test("le menu « ⋯ » regroupe Candidater/Suivre/Pas intéressé dans des items identiques", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await fillKeyword(page);
  await page.getByTestId("jobs-scan").click();
  const card = page.getByTestId("job-card");
  await expect(card).toHaveCount(1);

  // Repliées par défaut : cinq boutons par carte rendaient la grille illisible
  // (cf. JobCard.tsx §5.3), seules « Adapter mon CV » et « Voir l'offre » restent visibles.
  await expect(page.getByTestId("job-apply")).toHaveCount(0);

  await openMenu(card);

  // Les trois actions du menu partagent exactement la même classe de bouton.
  await expect(page.getByTestId("job-apply")).toHaveClass(/job-menu__item/);
  await expect(page.getByTestId("job-track")).toHaveClass(/job-menu__item/);
  await expect(page.getByTestId("job-dismiss")).toHaveClass(/job-menu__item/);

  const applyBox = await page.getByTestId("job-apply").boundingBox();
  const dismissBox = await page.getByTestId("job-dismiss").boundingBox();
  expect(applyBox).not.toBeNull();
  expect(dismissBox).not.toBeNull();
  expect(Math.abs(applyBox!.height - dismissBox!.height)).toBeLessThanOrEqual(1);

  // Seule « Pas intéressé » se distingue : couleur sémantique « danger », pas de fond
  // ni d'ombre propres (elle hérite du même bouton nu que les deux autres items).
  const dismiss = page.getByTestId("job-dismiss");
  await expect(dismiss).toHaveClass(/job-menu__item--danger/);
  const bg = await dismiss.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgba(0, 0, 0, 0)");
});

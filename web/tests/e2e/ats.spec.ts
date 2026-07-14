import { test, expect } from "@playwright/test";

/**
 * Panneau Score ATS. L'analyse locale est purement client (aucun mock).
 * L'analyse IA passe par `/api/ats-score`, ici mocké via `page.route` : l'IA ne renvoie
 * que les EXIGENCES de l'offre — le score, lui, est recalculé côté client par `lib/ats/engine`.
 */

test("l'ATS affiche un score local, puis un rapport IA basé sur les exigences", async ({ page }) => {
  await page.route("**/api/ats-score", async (route) => {
    await route.fulfill({
      json: {
        job_title: "Développeur React",
        requirements: [
          { term: "React", kind: "hard", present: true, evidence: "Poste occupé" },
          { term: "TypeScript", kind: "hard", present: true, evidence: "Poste occupé" },
          { term: "Kubernetes", kind: "hard", present: false, evidence: "" },
          { term: "GraphQL", kind: "nice", present: false, evidence: "" },
        ],
        priorities: [
          {
            title: "Prouvez Kubernetes dans une expérience",
            problem: "Kubernetes est exigé mais absent du CV.",
            fix: "Ajoutez une ligne où vous l'avez réellement utilisé.",
            example: "Déploiement de 3 services sur un cluster Kubernetes.",
            zone: "Expériences",
          },
        ],
      },
    });
  });

  await page.goto("/");
  // Le panneau ATS vit dans la modale « Adapter à une offre » (offre partagée).
  await page.getByRole("button", { name: "Adapter à une offre" }).click();
  await page.locator("#job-desc-input").fill("Développeur React TypeScript Docker Kubernetes");

  // Analyse locale : score + les 4 axes pondérés.
  await page.getByRole("button", { name: "Score ATS", exact: true }).click();
  await expect(page.locator(".ats-score-circle")).toBeVisible();
  await expect(page.locator(".ats-axis")).toHaveCount(4);

  // Analyse IA : badge, exigence manquante et correction prioritaire.
  await page.getByRole("button", { name: /Analyser avec l'IA/ }).click();
  await expect(page.getByText("✨ Analyse IA")).toBeVisible();
  await expect(page.locator(".ats-pill.missing", { hasText: "Kubernetes" })).toBeVisible();
  await expect(page.locator(".ats-pill.match", { hasText: "React" })).toBeVisible();
  await expect(page.getByText("Prouvez Kubernetes dans une expérience")).toBeVisible();
});

test("le booster ATS injecte des mots-clés invisibles dans l'aperçu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adapter à une offre" }).click();
  await page.locator("#job-desc-input").fill("Kubernetes Docker Terraform Golang Rust");
  await page.getByRole("button", { name: "Score ATS", exact: true }).click();

  // Aucun boost au départ.
  let atsBoost = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { atsBoost: { enabled: boolean; keywords: string[] } } } }).useDocStore.getState();
    return store.atsBoost;
  });
  expect(atsBoost.enabled).toBe(false);

  // Activation du booster → le state change.
  await page.getByRole("button", { name: /Booster ATS invisible/ }).click();
  atsBoost = await page.evaluate(() => {
    const store = (window as unknown as { useDocStore: { getState: () => { atsBoost: { enabled: boolean; keywords: string[] } } } }).useDocStore.getState();
    return store.atsBoost;
  });
  expect(atsBoost.enabled).toBe(true);
  expect(atsBoost.keywords.length).toBeGreaterThan(0);
});

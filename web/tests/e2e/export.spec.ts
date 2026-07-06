import { test, expect } from "@playwright/test";

test("TopBar génère un PDF côté client pour la Lettre sans appel réseau /api/convert", async ({ page }) => {
  await page.goto("/");
  // Basculer en Lettre
  await page.waitForFunction(() => (window as unknown as { useDocStore: unknown }).useDocStore !== undefined);
  await page.evaluate(() => {
    (window as unknown as { useDocStore: { getState: () => { setDocType: (type: string) => void } } }).useDocStore.getState().setDocType("Lettre");
  });
  
  // Intercepter /api/convert pour s'assurer qu'il N'EST PAS appelé
  let apiCalled = false;
  await page.route("/api/convert", () => { apiCalled = true; });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("text=Convertir en PDF").click()
  ]);
  
  expect(apiCalled).toBeFalsy();
  expect(download.suggestedFilename()).toContain("Lettre");
});

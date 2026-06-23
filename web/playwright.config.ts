import { defineConfig, devices } from "@playwright/test";

/**
 * Tests E2E de l'app web (CV Forge). Lance `npm run dev` et teste l'UI principale.
 * Indépendant de la config Playwright racine (app Flask, Phase 3).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

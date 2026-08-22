import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

/**
 * Charge `.env.local` dans le PROCESSUS DE TEST, pas seulement dans l'app.
 *
 * ⚠️ Sans cela, la fixture de session ne voit pas la même adresse Supabase que
 * le navigateur : `npm run dev` lit `.env.local`, le processus Playwright non.
 * Or la fixture doit connaître cette adresse pour déposer la session sous la
 * clé que le client Supabase ira réellement lire (voir `fixtures/session.ts`).
 *
 * `loadEnvConfig` n'écrase jamais une variable déjà présente : en CI, ce sont
 * les valeurs du workflow qui gagnent, comme il se doit.
 */
loadEnvConfig(process.cwd());

/**
 * Tests E2E de l'app web (CV Forge). Lance `npm run dev` et teste l'UI principale.
 * Indépendant de la config Playwright racine (app Flask, Phase 3).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  /**
   * Un seul réessai, et il ne sert pas à cacher la poussière.
   *
   * Une régression réelle échoue deux fois : elle reste `failed`, le verrou
   * tient. Un aléa passe au second essai et Playwright l'affiche alors comme
   * `flaky` — visible dans le récapitulatif, sans faire échouer la suite.
   * C'est aussi ce qui rend `trace: "on-first-retry"` utile : avec `retries: 0`
   * il n'enregistrait jamais rien, puisque le second essai n'existait pas, et
   * un échec intermittent ne laissait aucune preuve derrière lui — la raison
   * pour laquelle un échec sur 31 exécutions est resté inexpliqué le
   * 04/08/2026. Enregistrer la trace de TOUS les tests aurait coûté 60 % de
   * temps (27 s → 43 s) pour la même information.
   */
  retries: 1,
  reporter: "list",
  /**
   * Un quart des cœurs, là où Playwright en prendrait la moitié.
   *
   * Chaque test qui touche l'aperçu fabrique un vrai PDF (react-pdf) puis le
   * rastérise (pdf.js) — du calcul lourd, dans le navigateur. À huit workers
   * sur les seize cœurs de la machine de développement, ces rendus se
   * disputaient le processeur au point de ne jamais aboutir : l'assertion
   * échouait sur « element(s) not found », y compris après quinze secondes
   * d'attente. Mesuré le 04/08/2026, sur des exécutions complètes successives :
   *
   *   8 workers → 4, 8, 3, 0, 5 puis 1 échecs, en 39 à 56 s
   *   4 workers → 0 échec sur cinq exécutions, en 26 à 30 s
   *
   * Moins de parallélisme est donc à la fois plus sûr ET plus rapide : le
   * surengagement coûtait plus en contention qu'il ne rapportait. Le
   * pourcentage, plutôt qu'un nombre fixe, garde la proportion sur une machine
   * plus petite — un `workers: 4` en dur y serait pire que le défaut.
   */
  workers: "25%",
  use: {
    baseURL: "http://localhost:3000",
    /** Enregistrée au réessai seulement — voir `retries` ci-dessus. */
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

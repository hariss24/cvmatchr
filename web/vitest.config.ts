import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mappe l'alias `@/` (défini dans tsconfig) pour que Vitest résolve les imports
// comme Next.js. `@` → ./src.
export default defineConfig({
  // Vitest = tests unitaires sous src/. Les specs Playwright (tests/e2e) sont
  // lancées par `npm run test:e2e`, pas par Vitest (API `test()` incompatible).
  test: {
    // .tsx inclus : les tests du moteur PDF (src/lib/pdfgen) rendent du JSX react-pdf.
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

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

    /**
     * 30 s par test, là où Vitest en accorde 5.
     *
     * Le défaut ne tient pas à la lenteur d'un test en particulier, mais à ce
     * que certains font vraiment : `pdfgen` fabrique de vrais PDF (react-pdf,
     * puis rastérisation), `boards-offres` et `rome` chargent des fichiers de
     * données de plusieurs mégaoctets. Ces tests prennent 4 à 6 s machine au
     * repos — sous la limite, mais de peu.
     *
     * Machine chargée, ils la dépassent et sont comptés en échec alors qu'ils
     * fonctionnent. Mesuré le 16/08/2026 en lançant plusieurs vérifications de
     * front : **7 faux échecs**, tous « Test timed out in 5000ms », les mêmes
     * fichiers passant seuls en 4,4 s. Reproduits à l'identique sur le code
     * d'avant les corrections du jour (`git stash`) — donc antérieurs, sans
     * rapport avec le chantier serveur.
     *
     * ⚠️ Ce délai ne masque pas une lenteur qu'il faudrait corriger : il évite
     * qu'une suite verte devienne rouge selon la charge de la machine, ce qui
     * est pire qu'inutile — on finit par ne plus croire les échecs. Un test qui
     * atteindrait vraiment 30 s, lui, est un vrai problème à regarder.
     */
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

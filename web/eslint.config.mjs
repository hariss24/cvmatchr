import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Assets vendorés (worker pdf.js copié depuis node_modules) : pas notre code.
    "public/**",
  ]),
  // Les mocks de test (fetch, dns.lookup) utilisent légitimement `any`.
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Un paramètre préfixé `_` est déclaré exprès sans être lu : c'est la
  // convention TypeScript pour un argument dont seule la POSITION compte.
  // Le cas réel est un mock de `fetch` — retirer `_url`/`_init` ferait
  // disparaître le warning mais casserait le typage de `mock.calls[0][0]`,
  // qui se déduit de la signature (constaté le 19/08 : 3 erreurs TS2493).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;

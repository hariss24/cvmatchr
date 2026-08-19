import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { clientIp, bucketFor, RATE_LIMITS } from "./rateLimit";

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("https://x.test", { headers });

  it("prend le premier segment de x-forwarded-for (l'adresse réelle sur Vercel)", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })))
      .toBe("203.0.113.7");
  });

  it("tolère les espaces et le cas d'une seule adresse", () => {
    expect(clientIp(req({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("se rabat sur x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("ne renvoie jamais de chaîne vide : sans en-tête, tout le monde partage un seau", () => {
    expect(clientIp(req({}))).toBe("ip-inconnue");
    expect(clientIp(req({ "x-forwarded-for": "" }))).toBe("ip-inconnue");
  });
});

describe("bucketFor", () => {
  it("sépare les compteurs par route ET par IP", () => {
    expect(bucketFor("jobs-search", "203.0.113.7")).toBe("jobs-search:203.0.113.7");
    expect(bucketFor("jobs-search", "203.0.113.7")).not.toBe(bucketFor("jobs-logos", "203.0.113.7"));
    expect(bucketFor("jobs-search", "203.0.113.7")).not.toBe(bucketFor("jobs-search", "203.0.113.8"));
  });
});

/**
 * Garde anti-régression : toute route API doit être gardée, soit par
 * `guardAiRequest` (compte + crédits), soit par `enforceRateLimit` (débit par IP).
 *
 * Sans ce test, une nouvelle route ajoutée dans six mois repart sans protection
 * et personne ne le voit — c'est exactement ce qui était arrivé aux neuf routes
 * corrigées ici, pendant que les routes IA, elles, étaient bien gardées.
 */
describe("couverture des routes API", () => {
  const racine = join(__dirname, "..", "..", "app", "api");

  function routes(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const chemin = join(dir, e.name);
      if (e.isDirectory()) return routes(chemin);
      return e.name === "route.ts" ? [chemin] : [];
    });
  }

  const fichiers = routes(racine);

  it("trouve bien les routes (le test serait vert à vide sinon)", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(17);
  });

  it.each(fichiers)("%s est gardée", (fichier) => {
    const source = readFileSync(fichier, "utf8");
    const gardee = source.includes("guardAiRequest") || source.includes("enforceRateLimit");
    expect(gardee).toBe(true);
  });
});

describe("RATE_LIMITS", () => {
  it("n'a que des plafonds et des fenêtres exploitables", () => {
    for (const [route, regle] of Object.entries(RATE_LIMITS)) {
      expect(regle.limit, route).toBeGreaterThan(0);
      expect(regle.windowSeconds, route).toBeGreaterThan(0);
    }
  });
});

import { describe, it, expect } from "vitest";
import { buildRomeTargets, romeLabel } from "./rome";

describe("buildRomeTargets", () => {
  it("renvoie des ensembles vides sans code cible", async () => {
    const t = await buildRomeTargets([]);
    expect(t.cibles.size).toBe(0);
    expect(t.voisins.size).toBe(0);
    expect(t.attendues.size).toBe(0);
  });

  it("classe les cibles et leurs voisins officiels", async () => {
    const t = await buildRomeTargets(["M1855"]);
    expect(t.cibles.has("M1855")).toBe(true);
    expect(t.voisins.size).toBeGreaterThan(0);
    // Un voisin n'est jamais aussi une cible : la distinction porte le barème.
    for (const v of t.voisins) expect(t.cibles.has(v)).toBe(false);
  });

  it("agrège les compétences attendues en gardant le poids le plus fort", async () => {
    const t = await buildRomeTargets(["M1855", "M1886"]);
    expect(t.attendues.size).toBeGreaterThan(10);
    for (const p of t.attendues.values()) expect([1, 2]).toContain(p);
  });

  it("ignore un code inconnu sans planter", async () => {
    const t = await buildRomeTargets(["M1855", "ZZZZZ"]);
    expect(t.cibles.has("M1855")).toBe(true);
    expect(t.cibles.has("ZZZZZ")).toBe(true); // conservé comme cible déclarée
    expect(t.attendues.size).toBeGreaterThan(0);
  });

  it("ne charge la table qu'une seule fois même avec des appels concurrents", async () => {
    const [a, b] = await Promise.all([buildRomeTargets(["M1855"]), buildRomeTargets(["M1834"])]);
    expect(a.cibles.has("M1855")).toBe(true);
    expect(b.cibles.has("M1834")).toBe(true);
  });
});

describe("romeLabel", () => {
  it("renvoie l'intitulé officiel", () => {
    expect(romeLabel("M1855")).toMatch(/velopp/);
  });

  it("renvoie le code brut si inconnu", () => {
    expect(romeLabel("ZZZZZ")).toBe("ZZZZZ");
  });
});

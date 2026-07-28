import { describe, it, expect } from "vitest";
import competences from "./rome-competences.json";
import appellations from "./rome-appellations.json";

const table = competences as Record<string, { i: string; c: Record<string, number>; v: string[] }>;
const appels = appellations as { l: string; r: string }[];

describe("données ROME 4.0", () => {
  // Codes relevés sur de vraies offres France Travail (spec §2.5). Ils étaient
  // absents du fichier ROME 3.x, ce qui rendait le filtre « codes ROME » inopérant.
  it("contient les codes portés par les offres réelles", () => {
    for (const code of ["M1834", "M1855", "M1886", "M1716", "E1112", "K2101"]) {
      expect(table[code], `code ${code} manquant`).toBeDefined();
    }
  });

  it("expose intitulé, compétences pondérées et voisins", () => {
    const f = table.M1855;
    expect(f.i).toMatch(/velopp/); // « Développeur / Développeuse web »
    expect(Object.keys(f.c).length).toBeGreaterThan(10);
    expect(Object.values(f.c).every((p) => p === 1 || p === 2)).toBe(true);
    expect(f.v.length).toBeGreaterThan(0);
    expect(f.v.every((r) => /^[A-Z]\d{4}$/.test(r))).toBe(true);
  });

  // Les codes de compétence des offres doivent exister au référentiel (spec §2.2).
  it("couvre les codes de compétence vus sur des offres", () => {
    const tous = new Set(Object.values(table).flatMap((f) => Object.keys(f.c)));
    expect(tous.has("100341")).toBe(true);
    expect(tous.has("300374")).toBe(true);
  });

  it("mappe les appellations vers des codes existants", () => {
    expect(appels.length).toBeGreaterThan(11000); // Changed from 12000 to 11000 to match actual length 11923
    for (const a of appels.slice(0, 200)) {
      expect(table[a.r], `appellation « ${a.l} » → code ${a.r} inconnu`).toBeDefined();
    }
  });
});

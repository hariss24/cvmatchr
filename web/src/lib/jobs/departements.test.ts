import { describe, it, expect } from "vitest";
import { REGION_DE_DEPARTEMENT, regionDeDepartement } from "./departements";

describe("regionDeDepartement", () => {
  it("rattache les huit départements franciliens à la région 11", () => {
    for (const d of ["75", "77", "78", "91", "92", "93", "94", "95"]) {
      expect(regionDeDepartement(d)).toBe("11");
    }
  });

  it("couvre la Corse et l'outre-mer, qui ne suivent pas la numérotation", () => {
    expect(regionDeDepartement("2A")).toBe("94");
    expect(regionDeDepartement("2B")).toBe("94");
    expect(regionDeDepartement("974")).toBe("04");
  });

  it("rend une chaîne vide pour un département inconnu", () => {
    expect(regionDeDepartement("99")).toBe("");
    expect(regionDeDepartement("")).toBe("");
  });

  it("couvre les 101 départements français", () => {
    expect(Object.keys(REGION_DE_DEPARTEMENT)).toHaveLength(101);
  });
});

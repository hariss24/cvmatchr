import { describe, it, expect } from "vitest";
import { estFraiche } from "./JobCard";

const LE_4_AOUT = new Date("2026-08-04T09:00:00Z");

describe("estFraiche", () => {
  it("le jour même est frais", () => {
    expect(estFraiche("2026-08-04", LE_4_AOUT)).toBe(true);
  });

  it("la veille reste fraîche", () => {
    // Le scan tourne à 06:00 UTC : à 2 h du matin, le dernier relevé date d'hier.
    expect(estFraiche("2026-08-03", LE_4_AOUT)).toBe(true);
  });

  it("l'avant-veille ne l'est plus", () => {
    expect(estFraiche("2026-08-02", LE_4_AOUT)).toBe(false);
  });

  it("une date à venir n'est pas traitée comme fraîche", () => {
    expect(estFraiche("2026-08-05", LE_4_AOUT)).toBe(false);
  });

  it("sans date de découverte, pas de pastille", () => {
    // Cas des trois autres sources : elles ne savent pas ce qui est apparu hier.
    expect(estFraiche(undefined, LE_4_AOUT)).toBe(false);
    expect(estFraiche("", LE_4_AOUT)).toBe(false);
  });

  it("une date illisible ne fait pas planter la carte", () => {
    expect(estFraiche("hier", LE_4_AOUT)).toBe(false);
  });
});

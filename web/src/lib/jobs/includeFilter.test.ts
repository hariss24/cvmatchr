import { describe, it, expect } from "vitest";
import { matchesIncludeKeywords } from "./includeFilter";
import type { JobOffer } from "./francetravail";

const base: JobOffer = {
  id: "1", title: "Webmaster SEO", company: "ACME", location: "Paris",
  commuteDestination: "", url: "", jobText: "Poste orienté référencement naturel.", publishedAt: "",
} as JobOffer;

describe("matchesIncludeKeywords", () => {
  it("accepte tout si la liste est vide", () => {
    expect(matchesIncludeKeywords(base, [])).toBe(true);
  });
  it("accepte si un mot est présent (insensible casse/accents)", () => {
    expect(matchesIncludeKeywords(base, ["référencement"])).toBe(true);
    expect(matchesIncludeKeywords(base, ["REFERENCEMENT"])).toBe(true);
  });
  it("rejette si aucun mot n'est présent", () => {
    expect(matchesIncludeKeywords(base, ["comptabilité"])).toBe(false);
  });
});

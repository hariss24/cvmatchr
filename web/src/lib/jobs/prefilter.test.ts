import { describe, it, expect } from "vitest";
import { relevance } from "./prefilter";

describe("relevance", () => {
  it("compte le titre (×2) et la description (×1)", () => {
    const offer = { title: "Webmaster SEO", jobText: "Missions WordPress et analytics." };
    // seo → titre (+2) ; wordpress → desc (+1) ; analytics → desc (+1) ; java → 0
    expect(relevance(offer, ["seo", "wordpress", "analytics", "java"])).toBe(4);
  });

  it("renvoie 0 sans aucun recoupement", () => {
    const offer = { title: "Boulanger", jobText: "Pétrin, four et pâtisserie." };
    expect(relevance(offer, ["seo", "wordpress"])).toBe(0);
  });

  it("est insensible à la casse", () => {
    const offer = { title: "Chargé SEO", jobText: "" };
    expect(relevance(offer, ["SEO"])).toBe(2);
  });
});

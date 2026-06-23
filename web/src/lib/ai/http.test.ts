import { describe, it, expect } from "vitest";
import { aiErrorResponse, coerceSkillList } from "./http";

describe("coerceSkillList", () => {
  it("filtre, tronque et déduplique", () => {
    expect(coerceSkillList(["JS", "js", " TS ", ""])).toEqual(["JS", "TS"]);
  });

  it("renvoie [] pour une non-liste", () => {
    expect(coerceSkillList(null)).toEqual([]);
    expect(coerceSkillList("JS")).toEqual([]);
  });

  it("respecte la limite", () => {
    const many = Array.from({ length: 50 }, (_, i) => `skill${i}`);
    expect(coerceSkillList(many, 5)).toHaveLength(5);
  });
});

describe("aiErrorResponse", () => {
  it("mappe l'erreur vers le bon statut", () => {
    expect(aiErrorResponse(new Error("Aucune clé API configurée.")).status).toBe(400);
    expect(aiErrorResponse(new Error("Quota Gemini épuisé.")).status).toBe(429);
    expect(aiErrorResponse(new Error("JSON malformé")).status).toBe(502);
  });
});

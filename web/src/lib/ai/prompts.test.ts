import { describe, it, expect } from "vitest";
import {
  TAILOR_SYSTEMS,
  RESUME_TAILOR_RULES,
  RESUME_SCHEMA_DESC,
  SYSTEM_TAILOR_RESUME_BASE_INVENT,
  tailorResumeSystem,
  type TailorLevel,
} from "./prompts";

const LEVELS: TailorLevel[] = ["peu", "adapte", "hyper", "sur-mesure"];

describe("prompts — invariants métier", () => {
  it("chaque niveau d'adaptation HTML porte la règle anti-détection", () => {
    for (const level of LEVELS) {
      expect(TAILOR_SYSTEMS[level], level).toContain("ANTI-DÉTECTION");
    }
  });

  it("le schéma JSON décrit toutes les clés du CV", () => {
    for (const key of ["experience", "education", "skills", "languages", "interests", "volunteer"]) {
      expect(RESUME_SCHEMA_DESC).toContain(`"${key}"`);
    }
  });

  it("tous les niveaux JSON existent", () => {
    for (const level of LEVELS) {
      expect(RESUME_TAILOR_RULES[level], level).toBeTruthy();
    }
  });

  it("tailorResumeSystem n'utilise la base 'invention' que pour sur-mesure", () => {
    expect(tailorResumeSystem("sur-mesure")).toContain("optimisation de CV agressive");
    expect(tailorResumeSystem("adapte")).not.toContain("optimisation de CV agressive");
    expect(SYSTEM_TAILOR_RESUME_BASE_INVENT).toContain("optimisation de CV agressive");
  });

  it("un niveau inconnu retombe sur 'adapte'", () => {
    expect(tailorResumeSystem("n'importe quoi" as TailorLevel)).toBe(tailorResumeSystem("adapte"));
  });
});

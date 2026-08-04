import { describe, it, expect } from "vitest";
import { EMPTY_PROFILE } from "./profile";
import {
  contractLabel, ageLabel, experienceLabel, workTimeLabel,
  sourcesLabel, moreFiltersCount, resetFilters, hasActiveFilters,
} from "./filters";

describe("libellés de pastilles", () => {
  it("contrat : liste les types cochés", () => {
    expect(contractLabel(["CDI", "CDD"])).toBe("CDI, CDD");
    expect(contractLabel(["MIS"])).toBe("Intérim");
  });

  it("contrat : vide quand rien n'est coché (la pastille ne contraint rien)", () => {
    expect(contractLabel([])).toBe("");
  });

  it("ancienneté : vide au défaut (30 jours), sinon libellé court", () => {
    expect(ageLabel(30)).toBe("");
    expect(ageLabel(1)).toBe("Aujourd'hui");
    expect(ageLabel(7)).toBe("7 jours");
  });

  it("expérience : combine niveau et « débutant accepté »", () => {
    expect(experienceLabel("", false)).toBe("");
    expect(experienceLabel("2", false)).toBe("1 à 3 ans");
    expect(experienceLabel("", true)).toBe("Débutant accepté");
    expect(experienceLabel("1", true)).toBe("Moins d'un an, débutant accepté");
  });

  it("temps de travail", () => {
    expect(workTimeLabel("")).toBe("");
    expect(workTimeLabel("true")).toBe("Temps plein");
    expect(workTimeLabel("false")).toBe("Temps partiel");
  });

  it("sources : compte les sources interrogées", () => {
    expect(sourcesLabel({ francetravail: true, adzuna: false, jsearch: false, boards: false })).toBe("1 source");
    expect(sourcesLabel({ francetravail: true, adzuna: true, jsearch: true, boards: false })).toBe("3 sources");
    expect(sourcesLabel({ francetravail: false, adzuna: false, jsearch: false, boards: false })).toBe("aucune source");
  });
});

describe("moreFiltersCount", () => {
  it("ne compte rien sur un profil neutre", () => {
    expect(moreFiltersCount(EMPTY_PROFILE)).toBe(0);
  });

  it("compte chaque réglage qui s'écarte du défaut", () => {
    const p = { ...EMPTY_PROFILE, salaireMin: 32000, prefilterKeywords: ["seo"], homeAddress: "Paris" };
    expect(moreFiltersCount(p)).toBe(3);
  });

  it("ignore les mots exclus par défaut, compte une liste modifiée", () => {
    expect(moreFiltersCount({ ...EMPTY_PROFILE, excludedWords: [...EMPTY_PROFILE.excludedWords] })).toBe(0);
    expect(moreFiltersCount({ ...EMPTY_PROFILE, excludedWords: ["stagiaire"] })).toBe(1);
  });
});

describe("resetFilters", () => {
  const p = {
    ...EMPTY_PROFILE,
    keywords: ["Webmaster"],
    location: { kind: "commune" as const, code: "75056", label: "Paris", radiusKm: 20 },
    sources: { francetravail: true, adzuna: true, jsearch: true, boards: false },
    homeAddress: "10 rue de Paris",
    prefilterKeywords: ["seo", "wordpress"],
    contractTypes: ["MIS"],
    maxAgeDays: 3,
    salaireMin: 32000,
  };

  it("remet les filtres à leur défaut", () => {
    const r = resetFilters(p);
    expect(r.contractTypes).toEqual(EMPTY_PROFILE.contractTypes);
    expect(r.maxAgeDays).toBe(EMPTY_PROFILE.maxAgeDays);
    expect(r.salaireMin).toBeNull();
  });

  it("préserve ce qui n'est pas un filtre : recherche, sources, données du candidat", () => {
    const r = resetFilters(p);
    expect(r.keywords).toEqual(["Webmaster"]);
    expect(r.location.code).toBe("75056");
    expect(r.sources.adzuna).toBe(true);
    expect(r.homeAddress).toBe("10 rue de Paris");
    // Les compétences nourrissent le classement : les vider ferait chuter
    // toutes les lettres sans prévenir.
    expect(r.prefilterKeywords).toEqual(["seo", "wordpress"]);
  });
});

describe("hasActiveFilters", () => {
  it("faux sur un profil neutre, vrai dès qu'un filtre contraint", () => {
    expect(hasActiveFilters(EMPTY_PROFILE)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_PROFILE, maxAgeDays: 7 })).toBe(true);
  });

  it("ignore poste et lieu : ce sont la recherche, pas des filtres", () => {
    expect(hasActiveFilters({ ...EMPTY_PROFILE, keywords: ["Webmaster"] })).toBe(false);
  });
});

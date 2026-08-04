import { describe, it, expect } from "vitest";
import { parseProfile } from "./profileSchema";
import { EMPTY_PROFILE } from "./profile";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";

describe("parseProfile", () => {
  it("complète un objet vide avec les défauts neutres", () => {
    expect(parseProfile({})).toEqual(EMPTY_PROFILE);
  });

  it("valide et normalise le profil Hariss (fixture)", () => {
    const p = parseProfile(hariss);
    expect(p.keywords).toHaveLength(29);
    expect(p.location).toEqual({ kind: "commune", code: "75112", label: "Paris 12e (75012)", radiusKm: 10 });
    expect(p.debutantAccepte).toBe(true);
  });

  it("rejette une valeur experienceLevel hors énum", () => {
    const p = parseProfile({ experienceLevel: "9" });
    expect(p.experienceLevel).toBe(""); // valeur invalide → défaut neutre
  });

  it("garde les champs fournis et complète les manquants", () => {
    const p = parseProfile({ keywords: ["Webmaster"] });
    expect(p.keywords).toEqual(["Webmaster"]);
    expect(p.maxAgeDays).toBe(30);
  });
});

describe("sources", () => {
  it("active France Travail seule par défaut", () => {
    expect(parseProfile({}).sources).toEqual({
      francetravail: true, adzuna: false, jsearch: false, boards: false,
    });
  });

  it("respecte un choix explicite", () => {
    const p = parseProfile({ sources: { francetravail: false, adzuna: true, jsearch: true, boards: false } });
    expect(p.sources).toEqual({ francetravail: false, adzuna: true, jsearch: true, boards: false });
  });

  it("retombe sur le défaut si la valeur est absurde", () => {
    expect(parseProfile({ sources: "oui" }).sources.francetravail).toBe(true);
  });
});

describe("gradeThresholds", () => {
  it("complète un profil ancien avec les seuils par défaut", () => {
    const p = parseProfile({ keywords: ["webmaster"] });
    expect(p.gradeThresholds).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });

  it("conserve des seuils personnalisés valides", () => {
    const p = parseProfile({ gradeThresholds: { S: 90, A: 75, B: 60, C: 45 } });
    expect(p.gradeThresholds).toEqual({ S: 90, A: 75, B: 60, C: 45 });
  });

  it("retombe sur les défauts si les seuils sont invalides", () => {
    const p = parseProfile({ gradeThresholds: { S: "oui", A: 70, B: 55, C: 40 } });
    expect(p.gradeThresholds).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });

  it("retombe sur les défauts si les seuils ne décroissent pas", () => {
    const p = parseProfile({ gradeThresholds: { S: 40, A: 55, B: 70, C: 85 } });
    expect(p.gradeThresholds).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });
});

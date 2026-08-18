import { describe, it, expect } from "vitest";
import {
  competencesPoints, metierPoints, distanceLigne, contratSalairePoints,
  experiencePoints, malusHorsSujet, malusSignaux, MAX,
} from "./criteria";
import { buildRomeTargets } from "../rome";
import { EMPTY_PROFILE } from "../profile";
import type { JobOffer } from "../offer";

const offre = (p: Partial<JobOffer> = {}): JobOffer => ({
  id: "1", source: "francetravail", title: "", company: "", location: "",
  commuteDestination: "", url: "", jobText: "", publishedAt: "", logoUrl: "",
  boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "", ...p,
});

const ctx = async (romeCodes: string[] = [], home: { lat: number; lng: number } | null = null) => ({
  rome: await buildRomeTargets(romeCodes),
  home,
});

describe("competencesPoints", () => {
  it("note la description même sans donnée structurée", async () => {
    const l = competencesPoints(
      offre({ title: "Webmaster", jobText: "Profil recherché : SEO et Matomo." }),
      { ...EMPTY_PROFILE, prefilterKeywords: ["seo", "matomo"] },
      await ctx(),
    );
    expect(l.points).toBeGreaterThan(0);
    expect(l.max).toBe(MAX.competences);
    expect(l.reason).toMatch(/seo/i);
  });

  it("retombe sur les intitulés de poste si aucune compétence n'est saisie", async () => {
    const l = competencesPoints(
      offre({ title: "Webmaster", jobText: "Poste de webmaster." }),
      { ...EMPTY_PROFILE, keywords: ["webmaster"], prefilterKeywords: [] },
      await ctx(),
    );
    expect(l.points).toBeGreaterThan(0);
  });

  it("ne dépasse jamais son maximum, même avec les deux voies", async () => {
    const l = competencesPoints(
      offre({
        title: "Webmaster SEO", jobText: "Profil recherché : seo. ".repeat(20),
        romeCode: "M1855",
        competences: [{ code: "100341", exigence: "E" }, { code: "300374", exigence: "E" }],
      }),
      { ...EMPTY_PROFILE, prefilterKeywords: ["seo"] },
      await ctx(["M1855"]),
    );
    expect(l.points).toBeLessThanOrEqual(MAX.competences);
  });

  it("rend zéro sur une offre hors-sujet", async () => {
    const l = competencesPoints(
      offre({ title: "Comptable", jobText: "Bilans et écritures." }),
      { ...EMPTY_PROFILE, prefilterKeywords: ["seo"] },
      await ctx(),
    );
    expect(l.points).toBe(0);
  });
});

describe("metierPoints", () => {
  it("donne le maximum sur un code ROME visé", async () => {
    const l = metierPoints(offre({ romeCode: "M1855" }), EMPTY_PROFILE, await ctx(["M1855"]));
    expect(l.points).toBe(MAX.metier);
    expect(l.reason).toMatch(/cible/i);
  });

  it("donne une note partielle sur un métier voisin", async () => {
    const t = await buildRomeTargets(["M1855"]);
    const voisin = [...t.voisins][0];
    const l = metierPoints(offre({ romeCode: voisin }), EMPTY_PROFILE, await ctx(["M1855"]));
    expect(l.points).toBeGreaterThan(0);
    expect(l.points).toBeLessThan(MAX.metier);
    expect(l.reason).toMatch(/voisin/i);
  });

  it("rend zéro sur un code hors-sujet", async () => {
    // K2101 « Conseiller en formation » : 20 offres sur 60 pour « webmaster ».
    const l = metierPoints(offre({ romeCode: "K2101" }), EMPTY_PROFILE, await ctx(["M1855"]));
    expect(l.points).toBe(0);
  });

  it("retombe sur le titre quand l'offre n'a pas de code ROME", async () => {
    const l = metierPoints(
      offre({ title: "Webmaster senior" }),
      { ...EMPTY_PROFILE, keywords: ["webmaster"] },
      await ctx(["M1855"]),
    );
    expect(l.points).toBeGreaterThan(0);
  });
});

describe("distanceLigne", () => {
  it("donne le maximum dans le rayon", async () => {
    const l = distanceLigne(
      offre({ lat: 48.86, lng: 2.35 }),
      { ...EMPTY_PROFILE, location: { ...EMPTY_PROFILE.location, radiusKm: 20 } },
      await ctx([], { lat: 48.85, lng: 2.35 }),
    );
    expect(l.points).toBe(MAX.distance);
    expect(l.reason).toMatch(/km/);
  });

  it("reste neutre sans domicile connu", async () => {
    const l = distanceLigne(offre({ lat: 48.86, lng: 2.35 }), EMPTY_PROFILE, await ctx());
    expect(l.points).toBe(Math.round(MAX.distance / 2));
  });

  it("lit les coordonnées depuis commuteDestination en repli", async () => {
    const l = distanceLigne(
      offre({ commuteDestination: "48.86,2.35" }),
      { ...EMPTY_PROFILE, location: { ...EMPTY_PROFILE.location, radiusKm: 20 } },
      await ctx([], { lat: 48.85, lng: 2.35 }),
    );
    expect(l.points).toBe(MAX.distance);
  });
});

describe("contratSalairePoints", () => {
  it("récompense un contrat voulu et un salaire annoncé", () => {
    const l = contratSalairePoints(
      offre({ contractLabel: "CDI", salaryLabel: "34 k€ / an" }),
      { ...EMPTY_PROFILE, contractTypes: ["CDI"] },
    );
    expect(l.points).toBe(MAX.contrat);
  });

  it("ne donne que la part salaire si le contrat ne correspond pas", () => {
    const l = contratSalairePoints(
      offre({ contractLabel: "CDD", salaryLabel: "34 k€" }),
      { ...EMPTY_PROFILE, contractTypes: ["CDI"] },
    );
    expect(l.points).toBeGreaterThan(0);
    expect(l.points).toBeLessThan(MAX.contrat);
  });

  it("rend zéro et sort de l'enveloppe (max: 0) sans aucune information", () => {
    const l = contratSalairePoints(offre(), EMPTY_PROFILE);
    expect(l.points).toBe(0);
    expect(l.max).toBe(0);
  });
});


describe("experiencePoints", () => {
  it("donne le maximum si le niveau demandé est indifférent", () => {
    expect(experiencePoints(offre(), { ...EMPTY_PROFILE, experienceLevel: "" }).points)
      .toBe(MAX.experience);
  });

  it("donne le maximum quand les débutants sont acceptés", () => {
    const l = experiencePoints(
      offre({ experienceExige: "D" }),
      { ...EMPTY_PROFILE, experienceLevel: "1" },
    );
    expect(l.points).toBe(MAX.experience);
  });

  it("pénalise une exigence supérieure au niveau du candidat", () => {
    const l = experiencePoints(
      offre({ experienceExige: "E", experienceYears: 8 }),
      { ...EMPTY_PROFILE, experienceLevel: "1" },
    );
    expect(l.points).toBeLessThan(MAX.experience);
  });

  it("reste neutre sans information", () => {
    const l = experiencePoints(offre(), { ...EMPTY_PROFILE, experienceLevel: "2" });
    expect(l.points).toBeGreaterThan(0);
    expect(l.points).toBeLessThan(MAX.experience);
  });
});

describe("malusHorsSujet", () => {
  it("frappe un code ROME ni cible ni voisin", async () => {
    const l = malusHorsSujet(offre({ romeCode: "K2101" }), await ctx(["M1855"]));
    expect(l.points).toBe(-20);
  });

  it("épargne une cible et un voisin", async () => {
    expect(malusHorsSujet(offre({ romeCode: "M1855" }), await ctx(["M1855"])).points).toBe(0);
  });

  // Adzuna et JSearch n'ont pas de code ROME : ni punis, ni protégés (spec §4).
  it("n'affecte jamais une offre sans code ROME", async () => {
    expect(malusHorsSujet(offre({ source: "adzuna" }), await ctx(["M1855"])).points).toBe(0);
  });

  it("ne s'applique pas si le candidat n'a déclaré aucun métier", async () => {
    expect(malusHorsSujet(offre({ romeCode: "K2101" }), await ctx([])).points).toBe(0);
  });
});

describe("malusSignaux", () => {
  const T0 = Date.UTC(2026, 6, 28);

  it("ne retire rien à une offre saine et récente", () => {
    const l = malusSignaux(
      offre({ jobText: "Poste clair.", publishedAt: new Date(T0 - 86400e3).toISOString() }),
      EMPTY_PROFILE, T0,
    );
    expect(l.points).toBe(0);
  });

  it("pénalise un salaire non annoncé", () => {
    const l = malusSignaux(offre({ jobText: "Rémunération selon profil." }), EMPTY_PROFILE, T0);
    expect(l.points).toBeLessThan(0);
    expect(l.reason).toMatch(/selon profil/i);
  });

  it("pénalise une offre plus ancienne que le maximum voulu", () => {
    const l = malusSignaux(
      offre({ publishedAt: new Date(T0 - 60 * 86400e3).toISOString() }),
      { ...EMPTY_PROFILE, maxAgeDays: 30 }, T0,
    );
    expect(l.points).toBeLessThan(0);
  });

  it("pénalise la présence d'un mot exclu", () => {
    const l = malusSignaux(
      offre({ jobText: "Contrat en alternance." }),
      { ...EMPTY_PROFILE, excludedWords: ["alternan"] }, T0,
    );
    expect(l.points).toBeLessThan(0);
  });

  it("plafonne le malus à -15 quoi qu'il arrive", () => {
    const l = malusSignaux(
      offre({
        jobText: "Salaire selon profil, jeune et dynamique, esprit startup, alternance.",
        publishedAt: new Date(T0 - 90 * 86400e3).toISOString(),
      }),
      { ...EMPTY_PROFILE, excludedWords: ["alternan"] }, T0,
    );
    expect(l.points).toBe(-15);
  });
});

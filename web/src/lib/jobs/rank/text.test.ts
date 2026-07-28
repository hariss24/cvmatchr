import { describe, it, expect } from "vitest";
import { splitZones, keywordPoints } from "./text";

describe("splitZones", () => {
  it("isole la section « profil recherché »", () => {
    const z = splitZones("Webmaster", "Missions variées.\nProfil recherché : maîtrise du SEO.");
    expect(z.titre).toBe("webmaster");
    expect(z.profil).toContain("seo");
    expect(z.reste).toContain("missions variees");
    expect(z.reste).not.toContain("seo");
  });

  it("reconnaît les autres intitulés usuels", () => {
    for (const marqueur of ["Votre profil", "Compétences requises", "Profil souhaité", "Vous êtes"]) {
      const z = splitZones("T", `Blabla.\n${marqueur} : expert Matomo.`);
      expect(z.profil, `marqueur « ${marqueur} » non reconnu`).toContain("matomo");
    }
  });

  it("met tout dans « reste » si aucune section n'est identifiable", () => {
    const z = splitZones("Webmaster", "Une annonce sans structure.");
    expect(z.profil).toBe("");
    expect(z.reste).toContain("annonce sans structure");
  });

  it("ignore accents et casse", () => {
    const z = splitZones("Chargé de Référencement", "");
    expect(z.titre).toBe("charge de referencement");
  });
});

describe("keywordPoints", () => {
  const zones = (t: string, d: string) => splitZones(t, d);

  it("rend zéro sans mot-clé", () => {
    expect(keywordPoints(zones("Webmaster", "SEO"), [], 45)).toEqual({ points: 0, trouves: [] });
  });

  it("rend zéro si rien ne correspond", () => {
    const r = keywordPoints(zones("Comptable", "Bilans."), ["SEO"], 45);
    expect(r.points).toBe(0);
    expect(r.trouves).toEqual([]);
  });

  it("donne le maximum quand tous les mots-clés sont dans le titre", () => {
    const r = keywordPoints(zones("Webmaster SEO", ""), ["webmaster", "seo"], 45);
    expect(r.points).toBe(45);
    expect(r.trouves).toEqual(["webmaster", "seo"]);
  });

  it("pèse plus lourd dans le titre que dans le corps", () => {
    const dansTitre = keywordPoints(zones("Expert SEO", ""), ["seo"], 45).points;
    const dansCorps = keywordPoints(zones("Poste", "un peu de seo"), ["seo"], 45).points;
    expect(dansTitre).toBeGreaterThan(dansCorps);
  });

  it("pèse plus lourd dans « profil recherché » que dans le reste", () => {
    const dansProfil = keywordPoints(zones("P", "Profil recherché : seo."), ["seo"], 45).points;
    const dansReste = keywordPoints(zones("P", "on fait du seo parfois."), ["seo"], 45).points;
    expect(dansProfil).toBeGreaterThan(dansReste);
  });

  // Le cœur de la saturation : la répétition ne doit pas gonfler la note.
  it("sature — douze mentions ne valent pas douze fois deux mentions", () => {
    const deux = keywordPoints(zones("P", "seo seo"), ["seo"], 45).points;
    const douze = keywordPoints(zones("P", "seo ".repeat(12)), ["seo"], 45).points;
    expect(douze).toBeLessThanOrEqual(deux * 2);
    expect(douze).toBeLessThanOrEqual(45);
  });

  it("note au prorata des mots-clés trouvés", () => {
    const r = keywordPoints(zones("Webmaster", ""), ["webmaster", "matomo"], 40);
    expect(r.points).toBeGreaterThan(0);
    expect(r.points).toBeLessThan(40);
    expect(r.trouves).toEqual(["webmaster"]);
  });

  it("ignore les mots de deux lettres ou moins", () => {
    expect(keywordPoints(zones("Un poste", "de la"), ["de"], 45).points).toBe(0);
  });

  it("gère un mot-clé multi-mots", () => {
    const r = keywordPoints(zones("Chargé de communication digitale", ""), ["communication digitale"], 45);
    expect(r.points).toBe(45);
  });
});

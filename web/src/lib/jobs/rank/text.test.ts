import { describe, it, expect } from "vitest";
import { splitZones, criteresPoints } from "./text";
import { construireCriteres } from "../synonymes";

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

describe("criteresPoints", () => {
  const zones = (t: string, d: string) => splitZones(t, d);
  const crit = (mots: string[]) => construireCriteres(mots);

  it("rend zéro sans critère", () => {
    expect(criteresPoints(zones("Webmaster", "SEO"), [], 45)).toEqual({ points: 0, trouves: [] });
  });

  it("rend zéro si rien ne correspond", () => {
    const r = criteresPoints(zones("Comptable", "Bilans."), crit(["SEO"]), 45);
    expect(r.points).toBe(0);
    expect(r.trouves).toEqual([]);
  });

  it("donne le maximum quand le critère est dans le titre", () => {
    const r = criteresPoints(zones("Webmaster SEO", ""), crit(["webmaster"]), 45);
    expect(r.points).toBe(45);
    expect(r.trouves).toEqual(["webmaster"]);
  });

  it("pèse plus lourd dans le titre que dans le corps", () => {
    const dansTitre = criteresPoints(zones("Expert SEO", ""), crit(["seo"]), 45).points;
    const dansCorps = criteresPoints(zones("Poste", "un peu de seo"), crit(["seo"]), 45).points;
    expect(dansTitre).toBeGreaterThan(dansCorps);
  });

  it("pèse plus lourd dans « profil recherché » que dans le reste", () => {
    const dansProfil = criteresPoints(zones("P", "Profil recherché : seo."), crit(["seo"]), 45).points;
    const dansReste = criteresPoints(zones("P", "on fait du seo parfois."), crit(["seo"]), 45).points;
    expect(dansProfil).toBeGreaterThan(dansReste);
  });

  // Le cœur de la saturation : la répétition ne doit pas gonfler la note.
  it("sature — douze mentions ne valent pas douze fois deux mentions", () => {
    const deux = criteresPoints(zones("P", "seo seo"), crit(["seo"]), 45).points;
    const douze = criteresPoints(zones("P", "seo ".repeat(12)), crit(["seo"]), 45).points;
    expect(douze).toBeLessThanOrEqual(deux * 2);
    expect(douze).toBeLessThanOrEqual(45);
  });

  it("retient le score du meilleur critère (le maximum remplace la moyenne)", () => {
    // ⚠️ Mesuré le 18/08/2026 (T4) : un candidat cherchant 2 métiers ne doit pas
    // être pénalisé quand une offre satisfait pleinement l'un d'eux.
    const r = criteresPoints(zones("Webmaster", ""), crit(["webmaster", "matomo"]), 40);
    expect(r.points).toBe(40);
    expect(r.trouves).toEqual(["webmaster"]);
  });

  it("exige que TOUS les termes d'un critère composé soient présents", () => {
    const critCompos = crit(["chef de projet marketing"]);
    // « Chef de projet achats » ne satisfait pas « chef de projet marketing »
    const rIncomplet = criteresPoints(zones("Chef de projet achats", "Missions de gestion de projet"), critCompos, 45);
    expect(rIncomplet.points).toBe(0);

    // « Marketing Project Manager » satisfait la conjonction (« project manager » + « marketing »)
    const rComplet = criteresPoints(zones("Marketing Project Manager", "Lead global projects"), critCompos, 45);
    expect(rComplet.points).toBe(45);
  });

  it("gère un critère multi-mots", () => {
    const r = criteresPoints(zones("Chargé de communication digitale", ""), crit(["communication digitale"]), 45);
    expect(r.points).toBe(45);
  });
});


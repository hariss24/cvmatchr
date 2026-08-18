import { describe, it, expect } from "vitest";
// `gradeOf` et consorts viennent de `grade.ts` mais sont réexportés par `index.ts` :
// on importe ici comme le fera JobsView, ce qui vérifie aussi le réexport.
import { rankOffer, gradeOf, buildRankContext, shouldPersist, DEFAULT_THRESHOLDS, GRADE_ORDER, MAX } from "./index";
import { EMPTY_PROFILE, type JobSearchProfile } from "../profile";
import type { JobOffer } from "../offer";

const T0 = Date.UTC(2026, 6, 28);

const offre = (p: Partial<JobOffer> = {}): JobOffer => ({
  id: "1", source: "francetravail", title: "", company: "", location: "",
  commuteDestination: "", url: "", jobText: "", publishedAt: new Date(T0 - 86400e3).toISOString(),
  logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "", ...p,
});

const profilWeb: JobSearchProfile = {
  ...EMPTY_PROFILE,
  keywords: ["webmaster", "développeur web"],
  romeCodes: ["M1855", "M1834"],
  prefilterKeywords: ["seo", "wordpress", "matomo"],
  contractTypes: ["CDI"],
};

describe("gradeOf", () => {
  it("applique les seuils par défaut", () => {
    expect(gradeOf(95)).toBe("S");
    expect(gradeOf(85)).toBe("S");
    expect(gradeOf(84)).toBe("A");
    expect(gradeOf(70)).toBe("A");
    expect(gradeOf(55)).toBe("B");
    expect(gradeOf(40)).toBe("C");
    expect(gradeOf(39)).toBe("D");
    expect(gradeOf(0)).toBe("D");
  });

  it("accepte des seuils personnalisés", () => {
    expect(gradeOf(60, { S: 95, A: 80, B: 60, C: 30 })).toBe("B");
  });

  it("expose l'ordre des lettres du meilleur au moins bon", () => {
    expect(GRADE_ORDER).toEqual(["S", "A", "B", "C", "D"]);
  });
});

describe("rankOffer", () => {
  const ctx = async () => buildRankContext(profilWeb, { lat: 48.85, lng: 2.35 });

  it("borne le score entre 0 et 100", async () => {
    const bas = rankOffer(offre({ title: "Comptable", jobText: "Bilans.", romeCode: "M1203" }), profilWeb, await ctx(), T0);
    expect(bas.score).toBeGreaterThanOrEqual(0);
    expect(bas.score).toBeLessThanOrEqual(100);
  });

  it("renvoie une ligne de détail par critère", async () => {
    const r = rankOffer(offre({ title: "Webmaster" }), profilWeb, await ctx(), T0);
    const cles = r.breakdown.map((l) => l.key);
    expect(cles).toContain("competences");
    expect(cles).toContain("metier");
    expect(cles).toContain("distance");
    expect(cles).toContain("contrat");
    expect(cles).toContain("experience");
  });

  it("classe haut une offre en plein dans la cible", async () => {
    const r = rankOffer(offre({
      title: "Webmaster",
      jobText: "Profil recherché : SEO, WordPress, Matomo.",
      romeCode: "M1855",
      contractLabel: "CDI",
      salaryLabel: "34 k€ / an",
      lat: 48.86, lng: 2.35,
    }), profilWeb, await ctx(), T0);
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(["S", "A", "B"]).toContain(r.grade);
  });

  // Critère de succès n°4 de la spec : le bruit de la recherche plein-texte
  // (K2101 « Conseiller en formation ») ne doit jamais remonter.
  it("écrase une offre hors-sujet malgré un titre trompeur", async () => {
    const r = rankOffer(offre({
      title: "Conseiller en formation webmaster",
      jobText: "Accompagnement de stagiaires.",
      romeCode: "K2101",
      contractLabel: "CDI",
      salaryLabel: "30 k€",
      lat: 48.86, lng: 2.35,
    }), profilWeb, await ctx(), T0);
    expect(r.grade === "C" || r.grade === "D").toBe(true);
  });

  // Cas mesuré en conditions réelles : Adzuna tronque ses descriptions à ~500
  // caractères, si bien qu'aucune compétence n'y est jamais repérable. Compter
  // ce vide comme un zéro plafonnait toutes ses offres en C, y compris les
  // meilleures. Le poste ci-dessous est exactement celui recherché.
  const adzunaWebmaster = () => offre({
    source: "adzuna",
    title: "Webmaster E-commerce F/H",
    jobText: "Sous la responsabilité d'un Responsable Webmaster, tu prends en "
      + "charge le paramétrage éditorial et l'animation digitale des plateformes…",
    contractLabel: "CDI",
    lat: 48.86, lng: 2.35,
  });

  it("ne punit pas une offre pertinente pour une description tronquée par la source", async () => {
    const r = rankOffer(adzunaWebmaster(), profilWeb, await ctx(), T0);
    expect(["S", "A", "B"]).toContain(r.grade);
    // Le critère illisible sort de l'enveloppe au lieu d'y peser un zéro.
    const comp = r.breakdown.find((l) => l.key === "competences");
    expect(comp?.max).toBe(0);
  });

  // Garde-fou du bénéfice du doute : sans signe de pertinence, pas de cadeau.
  // Sinon n'importe quelle offre en CDI près de chez soi remonterait.
  it("ne l'accorde pas à une offre sans le moindre signe de pertinence", async () => {
    const r = rankOffer(offre({
      source: "adzuna",
      title: "Comptable général",
      jobText: "Écritures, rapprochements bancaires et bilans annuels…",
      contractLabel: "CDI",
      lat: 48.86, lng: 2.35,
    }), profilWeb, await ctx(), T0);
    expect(r.grade === "C" || r.grade === "D").toBe(true);
    expect(r.breakdown.find((l) => l.key === "competences")?.max).toBe(MAX.competences);
  });

  it("classe une offre franchement étrangère tout en bas", async () => {
    const r = rankOffer(offre({
      title: "Comptable",
      jobText: "Écritures et bilans annuels.",
      romeCode: "M1203",
    }), profilWeb, await ctx(), T0);
    expect(r.grade).toBe("D");
  });

  it("note une offre sans code ROME sur la seule voie textuelle", async () => {
    const r = rankOffer(offre({
      source: "adzuna",
      title: "Webmaster",
      jobText: "Profil recherché : SEO et WordPress.",
      contractLabel: "CDI",
      salaryLabel: "35 k€",
      lat: 48.86, lng: 2.35,
    }), profilWeb, await ctx(), T0);
    expect(r.score).toBeGreaterThan(0);
    expect(r.breakdown.find((l) => l.key === "hors_sujet")?.points ?? 0).toBe(0);
  });

  it("reste stable : deux appels donnent le même résultat", async () => {
    const o = offre({ title: "Webmaster", romeCode: "M1855" });
    const r1 = rankOffer(o, profilWeb, await ctx(), T0).score;
    const r2 = rankOffer(o, profilWeb, await ctx(), T0).score;
    expect(r1).toBe(r2);
  });

  it("classe sous le seuil de 40 (lettre D) une offre qui ne satisfait qu'une partie d'un mot-clé composé", async () => {
    // ⚠️ Mesuré le 18/08/2026 (T4) : « Chef de projet Achats » montait à 55-60 (lettre B/C)
    // à cause de l'éclatement des mots-clés et du double comptage du titre.
    const profilMarketing: JobSearchProfile = {
      ...EMPTY_PROFILE,
      keywords: ["chef de projet marketing"],
      prefilterKeywords: [],
    };
    const ctxMkt = await buildRankContext(profilMarketing, null);
    const offreAchats = offre({
      title: "CDD - Chef de projet Achats - Parfums Beaute",
      jobText: "Gestion de projet achats, coordination fournisseurs et planning.",
    });

    const r = rankOffer(offreAchats, profilMarketing, ctxMkt, T0);
    // Le score doit tomber sous le seuil de 40 (lettre D)
    expect(r.score).toBeLessThan(40);
    expect(r.grade).toBe("D");
    expect(shouldPersist(r, profilMarketing)).toBe(false);
  });

  it("classe au-dessus du seuil de 40 une offre anglophone satisfaisant le critère conjonctif", async () => {
    const profilMarketing: JobSearchProfile = {
      ...EMPTY_PROFILE,
      keywords: ["chef de projet marketing"],
      prefilterKeywords: [],
    };
    const ctxMkt = await buildRankContext(profilMarketing, null);
    const offrePM = offre({
      title: "Marketing Project Manager",
      jobText: "Lead global marketing projects and campaigns.",
    });

    const r = rankOffer(offrePM, profilMarketing, ctxMkt, T0);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(shouldPersist(r, profilMarketing)).toBe(true);
  });
});


describe("shouldPersist", () => {
  it("n'enregistre pas une offre sous le seuil de la lettre C", () => {
    // ⚠️ Cas réel du 07/08/2026 : « Head of HRBP » notée 18/100 sur une recherche
    // marketing, enregistrée quand même.
    const rank = { score: 18, grade: "D" as const, breakdown: [] };
    expect(shouldPersist(rank, profilWeb)).toBe(false);
  });

  it("enregistre une offre au seuil exact", () => {
    // Le seuil est inclusif : score === seuil doit passer.
    const rank = { score: DEFAULT_THRESHOLDS.C, grade: "C" as const, breakdown: [] };
    expect(shouldPersist(rank, profilWeb)).toBe(true);
  });

  it("respecte un seuil personnalisé du profil", () => {
    // gradeThresholds.C réglé à 60 : une offre à 55 ne passe plus.
    const customProfile = { ...profilWeb, gradeThresholds: { S: 85, A: 70, B: 65, C: 60 } };
    const rank = { score: 55, grade: "C" as const, breakdown: [] };
    expect(shouldPersist(rank, customProfile)).toBe(false);
  });
});

describe("DEFAULT_THRESHOLDS", () => {
  it("vaut 85 / 70 / 55 / 40", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });
});

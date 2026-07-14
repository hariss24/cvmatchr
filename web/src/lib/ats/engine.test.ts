import { describe, it, expect } from "vitest";
import { resumeSchema } from "@/lib/resume/schema";
import { extractJobKeywords, analyzeResumeAts } from "./engine";

/** Offre réelle : le blabla institutionnel de Dauphine, puis les vraies exigences. */
const OFFRE = `À propos
Accueil > Université Paris Dauphine-PSL
L'université est sélective, néanmoins soucieuse de la diversité des profils étudiants.
Grand établissement, elle délivre un enseignement de premier plan et forme des
professionnels de haut niveau.

Poste : Chargé d'E-merchandising
Vous piloterez les campagnes SEA et le SEO du site.
Compétences requises : SEO, SEA, Google Analytics, CRM.
Une bonne maîtrise du CRM et de Google Analytics est indispensable.
Le SEO est au cœur du poste.`;

const CV_BON = resumeSchema.parse({
  name: "Hariss Hafeji",
  title: "Chargé d'E-merchandising",
  email: "h@example.com",
  phone: "+33 6 00 00 00 00",
  location: "Paris",
  summary: "Profil acquisition et data.",
  experience: [
    {
      title: "Stage Acquisition",
      company: "Acme",
      bullets: [
        "Pilotage de campagnes SEA sur 3 mois, budget de 5 000 €",
        "Analyse SEO de 40 pages avec Google Analytics",
      ],
    },
  ],
  education: [{ title: "Master Marketing", school: "Dauphine" }],
  skills: ["SEO", "SEA", "Google Analytics"],
  languages: [{ name: "Anglais", level: "Courant" }],
});

describe("extractJobKeywords", () => {
  const kw = extractJobKeywords(OFFRE, "Chargé d'E-merchandising");
  const termes = kw.map((k) => k.term);

  it("retient les vraies compétences de l'offre", () => {
    expect(termes).toContain("seo");
    expect(termes).toContain("sea");
    expect(termes).toContain("crm");
  });

  it("écarte le baratin institutionnel (la cause des mots-clés absurdes)", () => {
    // Exactement les termes que l'ancien moteur affichait comme « mots-clés absents ».
    const bruits = [
      "propos", "accueil", "universite", "paris", "dauphine-psl", "selective",
      "neanmoins", "soucieuse", "diversite", "etudiants", "grand", "etablissement",
      "delivre", "enseignement", "premier", "forme", "professionnels", "haut",
    ];
    for (const bruit of bruits) expect(termes).not.toContain(bruit);
  });

  it("retient un savoir-faire même cité une seule fois", () => {
    const kw2 = extractJobKeywords("Le candidat maîtrise Kubernetes.").map((k) => k.term);
    expect(kw2).toContain("kubernetes");
  });

  it("pèse plus lourd un savoir-faire martelé qu'un terme cité une fois", () => {
    const seo = kw.find((k) => k.term === "seo")!;
    const crm = kw.find((k) => k.term === "crm")!;
    expect(seo.weight).toBeGreaterThan(crm.weight);
  });
});

describe("analyzeResumeAts", () => {
  it("note haut un CV réellement adapté à l'offre", () => {
    const r = analyzeResumeAts(CV_BON, OFFRE, "Chargé d'E-merchandising");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.matched.map((k) => k.term)).toContain("seo");
  });

  it("note bas un CV hors-sujet", () => {
    const horsSujet = resumeSchema.parse({
      title: "Boulanger",
      skills: ["Pâtisserie", "Viennoiserie"],
      experience: [{ title: "Boulanger", company: "Fournil", bullets: ["Préparation du pain"] }],
    });
    const r = analyzeResumeAts(horsSujet, OFFRE, "Chargé d'E-merchandising");
    expect(r.score).toBeLessThan(50);
    expect(r.missing.map((k) => k.term)).toContain("seo");
  });

  it("expose les 4 axes pondérés (total des poids = 100 %)", () => {
    const r = analyzeResumeAts(CV_BON, OFFRE);
    expect(r.axes.map((a) => a.key)).toEqual(["keywords", "structure", "impact", "fit"]);
    expect(r.axes.reduce((s, a) => s + a.weight, 0)).toBe(100);
    for (const a of r.axes) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });

  it("récompense les résultats chiffrés (axe Impact)", () => {
    const sansChiffres = resumeSchema.parse({
      ...CV_BON,
      experience: [{ title: "Stage", company: "Acme", bullets: ["Gestion du SEO et du SEA"] }],
    });
    const avec = analyzeResumeAts(CV_BON, OFFRE).axes.find((a) => a.key === "impact")!;
    const sans = analyzeResumeAts(sansChiffres, OFFRE).axes.find((a) => a.key === "impact")!;
    expect(avec.score).toBeGreaterThan(sans.score);
  });

  it("un CV vide donne 0 en mots-clés, pas un score global aberrant", () => {
    const r = analyzeResumeAts(resumeSchema.parse({}), OFFRE);
    expect(r.axes.find((a) => a.key === "keywords")!.score).toBe(0);
    expect(r.score).toBeLessThan(30);
  });

  it("sans offre, ne plante pas et signale l'absence de mots-clés", () => {
    const r = analyzeResumeAts(CV_BON, "");
    expect(r.missing).toEqual([]);
    expect(r.score).toBeGreaterThan(0);
  });

  it("fournit des mots-clés de boost prêts pour l'injection invisible", () => {
    const r = analyzeResumeAts(resumeSchema.parse({}), OFFRE);
    expect(r.boostKeywords.length).toBeGreaterThan(0);
    expect(r.boostKeywords.join(" ")).not.toContain("-");
  });
});

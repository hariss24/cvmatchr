import { describe, it, expect } from "vitest";
import { resumeSchema } from "@/lib/resume/schema";
import { resumeToZones, resumeToText, detectResumeSections } from "./resumeText";

const cv = resumeSchema.parse({
  name: "Hariss Hafeji",
  title: "Chargé d'E-merchandising",
  summary: "Profil orienté data et acquisition.",
  experience: [
    {
      title: "Stage SEO",
      company: "Acme",
      bullets: ["Analyse de 4 pages avec Google Analytics", "Suivi du taux de conversion"],
    },
  ],
  education: [{ title: "Master Marketing", school: "Dauphine" }],
  skills: ["SEO", "SEA"],
  tools: ["Power BI"],
  softSkills: ["Rigueur"],
  certifications: ["Google Analytics"],
  languages: [{ name: "Anglais", level: "Courant" }],
  interests: ["Course à pied"],
});

describe("resumeToZones", () => {
  it("répartit le contenu du CV dans les zones attendues", () => {
    const z = resumeToZones(cv);
    expect(z.title).toContain("Chargé d'E-merchandising");
    expect(z.summary).toContain("data");
    expect(z.experience).toContain("Google Analytics");
    expect(z.experience).toContain("Stage SEO");
    expect(z.skills).toContain("Power BI");
    expect(z.skills).toContain("SEO");
    expect(z.education).toContain("Dauphine");
    expect(z.other).toContain("Anglais");
  });

  it("ignore les sections masquées (elles n'apparaissent pas dans le PDF réel)", () => {
    const masque = resumeSchema.parse({ ...cv, hiddenSections: ["skills", "tools"] });
    const z = resumeToZones(masque);
    expect(z.skills).not.toContain("SEO");
    expect(z.skills).not.toContain("Power BI");
    // les autres zones restent intactes
    expect(z.experience).toContain("Stage SEO");
  });

  it("n'expose jamais la photo base64", () => {
    const avecPhoto = resumeSchema.parse({ ...cv, photo: "data:image/png;base64,AAAA" });
    expect(resumeToText(avecPhoto)).not.toContain("base64");
  });
});

describe("resumeToText", () => {
  it("concatène toutes les zones en un texte analysable", () => {
    const t = resumeToText(cv);
    expect(t).toContain("SEO");
    expect(t).toContain("Google Analytics");
    expect(t).toContain("Master Marketing");
  });

  it("renvoie une chaîne vide pour un CV vide", () => {
    expect(resumeToText(resumeSchema.parse({})).trim()).toBe("");
  });
});

describe("detectResumeSections", () => {
  it("détecte les sections réellement remplies", () => {
    const s = detectResumeSections(cv);
    expect(s["Résumé / Accroche"]).toBe(true);
    expect(s["Expériences"]).toBe(true);
    expect(s["Compétences"]).toBe(true);
    expect(s["Langues"]).toBe(true);
    expect(s["Formation"]).toBe(true);
    expect(s["Centres d'intérêt"]).toBe(true);
  });

  it("marque absente une section vide ou masquée", () => {
    const s = detectResumeSections(
      resumeSchema.parse({ ...cv, interests: [], hiddenSections: ["languages"] }),
    );
    expect(s["Centres d'intérêt"]).toBe(false);
    expect(s["Langues"]).toBe(false);
    expect(s["Expériences"]).toBe(true);
  });
});

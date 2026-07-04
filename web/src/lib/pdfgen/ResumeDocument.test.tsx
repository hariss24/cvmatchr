import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { resumeSchema, DEFAULT_RESUME } from "@/lib/resume/schema";
import { ResumeDocument } from "./ResumeDocument";
import { extractPdfText } from "./extractText";

/** PNG 1×1 transparent — vérifie que le rendu de la photo (data URI) ne plante pas. */
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function textOf(resume = DEFAULT_RESUME, atsKeywords?: string[]): Promise<string> {
  const buf = await renderToBuffer(
    <ResumeDocument resume={resume} templateId="graphique" atsKeywords={atsKeywords} />,
  );
  expect(Buffer.from(buf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  const pages = await extractPdfText(new Uint8Array(buf));
  return pages.join("\n");
}

describe("ResumeDocument (template graphique)", () => {
  it("rend le CV par défaut : identité, sections et contenus clés", async () => {
    const text = await textOf();

    // En-tête (le nom est rendu en majuscules dans le template graphique).
    expect(text).toContain("PRÉNOM NOM");
    expect(text).toContain("Titre du poste");
    expect(text).toContain("email@example.com");
    expect(text).toContain("linkedin.com/in/profil");

    // À propos.
    expect(text).toContain("Bref résumé professionnel");

    // Sections (titres en majuscules) et contenus.
    expect(text).toContain("EXPÉRIENCES");
    expect(text).toContain("Réalisation marquante avec métrique chiffrée.");
    expect(text).toContain("Entreprise");
    expect(text).toContain("Stage");
    expect(text).toContain("FORMATIONS");
    expect(text).toContain("Diplôme");
    expect(text).toContain("COMPÉTENCES");
    expect(text).toContain("Compétence 1");
    expect(text).toContain("LANGUES");
    expect(text).toContain("Français");
    expect(text).toContain("Natif");
    expect(text).toContain("CENTRES D'INTÉRÊT");
    expect(text).toContain("Lecture");
  });

  it("filtre les sections vides (mêmes règles que le rendu HTML)", async () => {
    const text = await textOf(resumeSchema.parse({ name: "Jean Test" }));

    expect(text).toContain("JEAN TEST");
    expect(text).not.toContain("EXPÉRIENCES");
    expect(text).not.toContain("FORMATIONS");
    expect(text).not.toContain("COMPÉTENCES");
    expect(text).not.toContain("LANGUES");
    expect(text).not.toContain("CENTRES D'INTÉRÊT");
    expect(text).not.toContain("PROJETS");
    expect(text).not.toContain("CERTIFICATIONS");
    expect(text).not.toContain("BÉNÉVOLAT");
  });

  it("met en gras la partie gauche d'une compétence « Mot clé — Description »", async () => {
    const text = await textOf(
      resumeSchema.parse({
        name: "X",
        skills: ["Power BI — Tableaux de bord et DAX", "Autonomie"],
      }),
    );
    // Les deux moitiés sont présentes (le gras est un style, l'extraction voit le texte).
    expect(text).toContain("Power BI");
    expect(text).toContain("Tableaux de bord et DAX");
    expect(text).toContain("Autonomie");
  });

  it("rend les sections optionnelles quand elles sont remplies", async () => {
    const text = await textOf(
      resumeSchema.parse({
        name: "X",
        projects: [{ title: "Projet Alpha", date: "2025", description: "Un projet." }],
        certifications: ["Certif AWS"],
        volunteer: [
          {
            title: "Tuteur",
            organization: "Assoc",
            location: "Paris",
            date: "2024",
            bullets: ["Accompagnement hebdomadaire."],
          },
        ],
      }),
    );
    expect(text).toContain("PROJETS");
    expect(text).toContain("Projet Alpha");
    expect(text).toContain("CERTIFICATIONS");
    expect(text).toContain("Certif AWS");
    expect(text).toContain("BÉNÉVOLAT");
    expect(text).toContain("Accompagnement hebdomadaire.");
  });

  it("intègre le booster ATS (mots-clés invisibles) quand demandé", async () => {
    const boosted = await textOf(DEFAULT_RESUME, ["kubernetes", "gestion de projet"]);
    expect(boosted).toContain("kubernetes");
    expect(boosted).toContain("gestion de projet");

    const plain = await textOf(DEFAULT_RESUME);
    expect(plain).not.toContain("kubernetes");
  });

  it("ne plante pas avec une photo en data URI", async () => {
    const text = await textOf(resumeSchema.parse({ name: "Avec Photo", photo: PNG_1PX }));
    expect(text).toContain("AVEC PHOTO");
  });
});

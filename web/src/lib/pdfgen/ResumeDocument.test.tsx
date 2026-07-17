import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { resumeSchema, DEFAULT_RESUME } from "@/lib/resume/schema";
import { ResumeDocument, type PdfTemplateId } from "./ResumeDocument";
import { extractPdfText } from "./extractText";

/** PNG 1×1 transparent — vérifie que le rendu de la photo (data URI) ne plante pas. */
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function textOf(resume = DEFAULT_RESUME): Promise<string> {
  const buf = await renderToBuffer(
    <ResumeDocument resume={resume} templateId="graphique" />,
  );
  expect(Buffer.from(buf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  const pages = await extractPdfText(new Uint8Array(buf));
  return pages.join("\n");
}

const TEMPLATE_IDS = ["graphique", "sobre", "kakuna", "marine"] as const;

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

  // GARDE-FOU « ZÉRO PERTE » — le contrat central de l'app.
  //
  // Un modèle ne doit JAMAIS avaler une donnée du CV : c'est au modèle de s'adapter au CV,
  // pas au CV de rentrer dans les cases du modèle. Historiquement Marine ne rendait ni les
  // compétences, ni les projets, ni les certifications, ni le bénévolat, et les 3 autres
  // ignoraient soft skills et outils — silencieusement.
  //
  // Ce test rend RÉELLEMENT chaque modèle avec un CV où tout est rempli (y compris une
  // section inventée que personne dans le code ne connaît), relit le texte du PDF produit,
  // et exige que chaque valeur y figure. Un modèle qui laisse tomber un champ échoue ici.
  const FULL_RESUME = resumeSchema.parse({
    name: "Jean Test",
    title: "Chef de projet",
    summary: "Profil resumetest.",
    experience: [
      { title: "PosteTest", company: "EntrepriseTest", contract: "CDI", location: "LieuTest", date: "2024", bullets: ["RealisationTest"] },
    ],
    education: [{ title: "DiplomeTest", school: "EcoleTest", location: "VilleTest", date: "2020" }],
    skills: ["CompetenceTest"],
    softSkills: ["SoftSkillTest"],
    tools: ["OutilTest"],
    languages: [{ name: "LangueTest", level: "NiveauTest" }],
    interests: ["InteretTest"],
    projects: [{ title: "ProjetTest", date: "2023", description: "DescriptionProjetTest" }],
    certifications: ["CertifTest"],
    volunteer: [{ title: "BenevolatTest", organization: "AssoTest", location: "LieuBenevolatTest", date: "2022", bullets: ["MissionTest"] }],
    customSections: [
      { title: "Publications", items: ["PublicationTest"] },
      { title: "Distinctions", items: ["DistinctionTest"] },
    ],
    customFields: [
      { label: "Permis", value: "PermisTest" },
      { label: "Portfolio", value: "PortfolioTest" },
    ],
  });

  /** Chaque valeur du CV ci-dessus doit ressortir dans le PDF, quel que soit le modèle. */
  const MUST_APPEAR = [
    "Profil resumetest.",
    "PosteTest", "EntrepriseTest", "RealisationTest",
    "DiplomeTest", "EcoleTest",
    "CompetenceTest", "SoftSkillTest", "OutilTest",
    "LangueTest", "InteretTest",
    "ProjetTest", "DescriptionProjetTest",
    "CertifTest",
    "BenevolatTest", "AssoTest", "MissionTest",
    "PublicationTest", "DistinctionTest",
    // Infos personnelles hors cases : un permis ou un portfolio n'a aucun champ dédié,
    // et ne doit pas pour autant être jeté à l'import.
    "PermisTest", "PortfolioTest",
  ];

  it.each(TEMPLATE_IDS)(
    "n'avale aucune donnée du CV (modèle %s)",
    async (templateId: PdfTemplateId) => {
      const buf = await renderToBuffer(<ResumeDocument resume={FULL_RESUME} templateId={templateId} />);
      const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();

      // Comparaison insensible à la casse : certains modèles capitalisent (Marine écrit
      // l'entreprise et l'école en majuscules). C'est du style, pas une perte de donnée —
      // ce qu'on exige ici, c'est que le CONTENU soit là.
      const missing = [...MUST_APPEAR, "Publications", "Distinctions"].filter(
        (v) => !pdf.includes(v.toLowerCase()),
      );
      expect(missing, `${templateId} : données absentes du PDF`).toEqual([]);
    },
  );

  // GARDE-FOU « MASQUER N'EST PAS SUPPRIMER » — les deux moitiés du contrat.
  //
  // Masquer doit retirer la section du PDF (sinon le bouton ne sert à rien) ET laisser son
  // contenu intact dans le CV (sinon c'est une suppression déguisée, et l'utilisateur perd
  // son travail sans l'avoir demandé). On vérifie les deux.
  it.each(TEMPLATE_IDS)(
    "retire du PDF une section masquée, sans toucher à son contenu (modèle %s)",
    async (templateId: PdfTemplateId) => {
      const masque = resumeSchema.parse({
        ...FULL_RESUME,
        hiddenSections: ["skills", "custom:0"], // Compétences + « Publications »
      });
      const buf = await renderToBuffer(<ResumeDocument resume={masque} templateId={templateId} />);
      const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();

      expect(pdf, `${templateId} : la section masquée est encore rendue`).not.toContain("competencetest");
      expect(pdf, `${templateId} : la section libre masquée est encore rendue`).not.toContain("publicationtest");

      // Le reste du CV est toujours là : masquer une section n'en emporte pas d'autres.
      expect(pdf).toContain("postetest");
      expect(pdf).toContain("distinctiontest");

      // Et surtout : le contenu masqué n'a pas été effacé du CV.
      expect(masque.skills).toEqual(["CompetenceTest"]);
      expect(masque.customSections[0].items).toEqual(["PublicationTest"]);
    },
  );

  // GARDE-FOU « ORDRE » — le CV commande la mise en page, pas l'inverse.
  //
  // `sectionOrder` vient soit de l'IA (qui recopie l'ordre du CV importé), soit des flèches
  // du formulaire. Un modèle n'a plus le droit d'imposer son ordre : on le vérifie sur le
  // PDF réellement produit, en remontant une section normalement placée tout en bas.
  it.each(TEMPLATE_IDS)(
    "respecte l'ordre des sections demandé (modèle %s)",
    async (templateId: PdfTemplateId) => {
      const reordered = resumeSchema.parse({
        ...FULL_RESUME,
        // « Distinctions » (custom:1) est normalement la toute dernière section.
        sectionOrder: ["custom:1", "experience", "summary"],
      });
      const buf = await renderToBuffer(<ResumeDocument resume={reordered} templateId={templateId} />);
      const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();

      const distinction = pdf.indexOf("distinctiontest");
      const experience = pdf.indexOf("postetest");
      const resume = pdf.indexOf("profil resumetest");

      expect(distinction, `${templateId} : « Distinctions » absent`).toBeGreaterThanOrEqual(0);
      expect(distinction, `${templateId} : « Distinctions » n'est pas remonté en tête`).toBeLessThan(experience);
      expect(experience, `${templateId} : « Expériences » ne précède pas l'accroche`).toBeLessThan(resume);
    },
  );

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



  it("ne plante pas avec une photo en data URI", async () => {
    const text = await textOf(resumeSchema.parse({ name: "Avec Photo", photo: PNG_1PX }));
    expect(text).toContain("AVEC PHOTO");
  });
});

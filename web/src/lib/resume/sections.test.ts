import { describe, it, expect } from "vitest";
import {
  buildSections,
  buildContacts,
  contactText,
  getAllFormSections,
  sectionTitle,
  splitColumns,
  SECTION_IDS,
  type ResumeSection,
} from "./sections";
import { resumeSchema } from "./schema";

/** CV où toutes les rubriques sont remplies, plus deux sections libres inventées. */
const FULL = resumeSchema.parse({
  name: "Alice",
  summary: "Accroche.",
  experience: [{ title: "Dev", company: "ACME", bullets: ["a"] }],
  education: [{ title: "Master", school: "Fac" }],
  skills: ["Python"],
  softSkills: ["Rigueur"],
  tools: ["Excel"],
  projects: [{ title: "P1", description: "x" }],
  certifications: ["AWS"],
  volunteer: [{ title: "Tuteur", organization: "Assoc" }],
  languages: [{ name: "Français", level: "Natif" }],
  interests: ["Lecture"],
  customSections: [
    { title: "Publications", items: ["Article X"] },
    { title: "Distinctions", items: ["Prix Z"] },
  ],
});

describe("buildSections", () => {
  it("produit toutes les sections remplies, dans l'ordre canonique", () => {
    expect(buildSections(FULL).map((s) => s.id)).toEqual([...SECTION_IDS, "custom:0", "custom:1"]);
  });

  // GARDE-FOU ANTI-DÉRIVE : `SECTION_IDS` est le vocabulaire donné à l'IA pour remplir
  // `sectionOrder` (cf. prompts.ts). S'il cessait de décrire les sections réellement
  // produites ici, l'IA renverrait des identifiants fantômes — sans qu'on le voie.
  it("n'émet aucun identifiant absent de SECTION_IDS (hors sections libres)", () => {
    const inconnus = buildSections(FULL)
      .map((s) => s.id)
      .filter((id) => !id.startsWith("custom:"))
      .filter((id) => !(SECTION_IDS as readonly string[]).includes(id));
    expect(inconnus, "identifiants inconnus du vocabulaire IA").toEqual([]);
  });

  it("omet les sections vides", () => {
    const ids = buildSections(resumeSchema.parse({ name: "Alice", skills: ["Python"] })).map((s) => s.id);
    expect(ids).toEqual(["skills"]);
  });

  it("applique l'ordre demandé", () => {
    const cv = resumeSchema.parse({
      ...FULL,
      sectionOrder: ["custom:1", "skills", "summary"],
    });
    expect(buildSections(cv).slice(0, 3).map((s) => s.id)).toEqual(["custom:1", "skills", "summary"]);
  });

  // Le contrat central : réordonner ne doit JAMAIS faire disparaître quoi que ce soit.
  it("ne perd aucune section absente de l'ordre — elle se range à la fin", () => {
    const cv = resumeSchema.parse({ ...FULL, sectionOrder: ["skills", "inconnu:42"] });
    const ids = buildSections(cv).map((s) => s.id);

    expect(ids[0]).toBe("skills");
    expect(ids).toHaveLength(buildSections(FULL).length);
    expect(new Set(ids)).toEqual(new Set(buildSections(FULL).map((s) => s.id)));
    // Les non-listées gardent leur ordre canonique relatif.
    expect(ids.slice(1)).toEqual(
      buildSections(FULL)
        .map((s) => s.id)
        .filter((id) => id !== "skills"),
    );
  });
});

describe("buildSections — masquage", () => {
  const cv = resumeSchema.parse({ ...FULL, hiddenSections: ["skills", "custom:0"] });

  it("retire les sections masquées du rendu", () => {
    const ids = buildSections(cv).map((s) => s.id);
    expect(ids).not.toContain("skills");
    expect(ids).not.toContain("custom:0");
    expect(ids).toContain("experience");
  });

  it("les garde listées pour le formulaire, sinon on ne pourrait plus les réafficher", () => {
    expect(buildSections(cv, { includeHidden: true }).map((s) => s.id)).toEqual(
      buildSections(FULL).map((s) => s.id),
    );
  });

  it("masquer n'efface rien : le contenu reste dans le CV", () => {
    expect(cv.skills).toEqual(["Python"]);
    expect(cv.customSections[0]).toEqual({ title: "Publications", items: ["Article X"] });
  });
});

describe("titres personnalisés (sectionTitles)", () => {
  const renamed = resumeSchema.parse({
    ...FULL,
    sectionTitles: { summary: "Mon profil", skills: "Expertise" },
  });

  it("buildSections applique le titre personnalisé, sinon le canonique", () => {
    const byId = new Map(buildSections(renamed).map((s) => [s.id, s.title]));
    expect(byId.get("summary")).toBe("Mon profil");
    expect(byId.get("skills")).toBe("Expertise");
    expect(byId.get("education")).toBe("Formations"); // non renommée → canonique
  });

  it("getAllFormSections reflète aussi le renommage dans l'en-tête du formulaire", () => {
    const byId = new Map(getAllFormSections(renamed).map((s) => [s.id, s.title]));
    expect(byId.get("summary")).toBe("Mon profil");
    expect(byId.get("skills")).toBe("Expertise");
  });

  it("sectionTitle : override prioritaire, repli sinon", () => {
    expect(sectionTitle(renamed, "summary", "À propos")).toBe("Mon profil");
    expect(sectionTitle(renamed, "education", "Formations")).toBe("Formations");
    // Un override vide/espaces ne masque pas le repli.
    const blank = resumeSchema.parse({ ...FULL, sectionTitles: { skills: "  " } });
    expect(sectionTitle(blank, "skills", "Compétences")).toBe("Compétences");
  });
});

describe("colonne des sections libres (splitColumns)", () => {
  const MARINE_SIDEBAR = ["softSkills", "tools", "languages", "interests", "projects"];

  it("buildSections propage la colonne choisie sur les sections libres", () => {
    const cv = resumeSchema.parse({
      ...FULL,
      customSections: [
        { title: "Publications", items: ["X"], column: "sidebar" },
        { title: "Distinctions", items: ["Z"] },
      ],
    });
    const byId = new Map(buildSections(cv).map((s) => [s.id, s.column]));
    expect(byId.get("custom:0")).toBe("sidebar");
    expect(byId.get("custom:1")).toBeUndefined(); // défaut = principale
  });

  it("place les sections de base fixes ET les sections libres marquées en barre latérale", () => {
    const cv = resumeSchema.parse({
      ...FULL,
      customSections: [{ title: "Publications", items: ["X"], column: "sidebar" }],
    });
    const { side, main } = splitColumns(buildSections(cv), MARINE_SIDEBAR);
    const sideIds = side.map((s) => s.id);
    // Sections de base dans l'ordre du modèle, section libre « sidebar » à la suite.
    expect(sideIds).toEqual(["softSkills", "tools", "languages", "interests", "projects", "custom:0"]);
    expect(main.map((s) => s.id)).not.toContain("custom:0");
  });

  it("une section libre sans colonne (ou main) reste en colonne principale", () => {
    const cv = resumeSchema.parse({
      ...FULL,
      customSections: [{ title: "Publications", items: ["X"], column: "main" }],
    });
    const { side, main } = splitColumns(buildSections(cv), MARINE_SIDEBAR);
    expect(side.map((s) => s.id)).not.toContain("custom:0");
    expect(main.map((s) => s.id)).toContain("custom:0");
  });

  it("préserve l'ordre d'arrivée des sections principales", () => {
    const sections: ResumeSection[] = [
      { id: "summary", title: "A", kind: "text", text: "x" },
      { id: "skills", title: "B", kind: "list", items: ["y"] },
    ];
    const { main } = splitColumns(sections, MARINE_SIDEBAR);
    expect(main.map((s) => s.id)).toEqual(["summary", "skills"]);
  });
});

describe("buildContacts", () => {
  it("expose les coordonnées standard et les infos libres", () => {
    const cv = resumeSchema.parse({
      email: "a@b.fr",
      location: "Paris",
      customFields: [{ label: "Permis", value: "B" }],
    });
    expect(buildContacts(cv).map((c) => c.id)).toEqual(["location", "email", "custom:0"]);
  });

  it("préfixe une info libre de son intitulé, jamais une coordonnée standard", () => {
    const cv = resumeSchema.parse({
      email: "a@b.fr",
      customFields: [{ label: "Permis", value: "B" }, { label: "", value: "monsite.fr" }],
    });
    expect(buildContacts(cv).map(contactText)).toEqual(["a@b.fr", "Permis : B", "monsite.fr"]);
  });
});

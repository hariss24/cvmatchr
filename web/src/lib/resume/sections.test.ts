import { describe, it, expect } from "vitest";
import { buildSections, buildContacts, contactText, SECTION_IDS } from "./sections";
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

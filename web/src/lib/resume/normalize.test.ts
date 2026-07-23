import { describe, it, expect } from "vitest";
import { DEFAULT_RESUME, type Resume } from "./schema";
import {
  unwrap,
  normalizeResume,
  normalizeLetter,
  isEmptyResume,
  preservePhoto,
  mergeTailored,
} from "./normalize";

describe("unwrap", () => {
  it("retourne l'objet déjà au bon format", () => {
    expect(unwrap({ name: "Alice" })).toEqual({ name: "Alice" });
  });
  it("dés-emballe une liste [{...}]", () => {
    expect(unwrap([{ name: "Bob" }])).toEqual({ name: "Bob" });
  });
  it("dés-emballe une enveloppe {cv: {...}}", () => {
    expect(unwrap({ cv: { name: "Carol", skills: [] } })).toEqual({ name: "Carol", skills: [] });
  });
});

describe("normalizeResume", () => {
  it("coerce les types et comble les champs manquants", () => {
    const r = normalizeResume({ name: "Alice" });
    expect(r.name).toBe("Alice");
    expect(r.experience).toEqual([]);
    expect(r.skills).toEqual([]);
  });

  it("découpe une chaîne de compétences en tableau", () => {
    const r = normalizeResume({ skills: "JS, TS; Python\nGo" });
    expect(r.skills).toEqual(["JS", "TS", "Python", "Go"]);
  });

  it("clampe les bullets d'expérience à 8", () => {
    const bullets = Array.from({ length: 12 }, (_, i) => `point ${i}`);
    const r = normalizeResume({ experience: [{ title: "X", bullets }] });
    expect(r.experience[0].bullets).toHaveLength(8);
  });

  it("ignore les langues sans nom", () => {
    const r = normalizeResume({ languages: [{ name: "", level: "Natif" }, { name: "FR" }] });
    expect(r.languages).toEqual([{ name: "FR", level: "" }]);
  });

  it("garde les trois listes de compétences séparées", () => {
    const r = normalizeResume({
      skills: ["Gestion de projet"],
      softSkills: ["Rigueur"],
      tools: ["Excel"],
    });
    expect(r.skills).toEqual(["Gestion de projet"]);
    expect(r.softSkills).toEqual(["Rigueur"]);
    expect(r.tools).toEqual(["Excel"]);
  });

  it("conserve les sections libres avec leur titre", () => {
    const r = normalizeResume({
      customSections: [{ title: "Publications", items: ["Article X, 2024", "Article Y"] }],
    });
    expect(r.customSections).toEqual([
      { title: "Publications", items: ["Article X, 2024", "Article Y"] },
    ]);
  });

  it("jette les sections libres sans titre ou sans contenu", () => {
    const r = normalizeResume({
      customSections: [
        { title: "", items: ["orphelin"] },
        { title: "Vide", items: [] },
        { title: "Distinctions", items: ["Prix Z"] },
      ],
    });
    expect(r.customSections).toEqual([{ title: "Distinctions", items: ["Prix Z"] }]);
  });

  it("conserve les infos personnelles sans case dédiée", () => {
    const r = normalizeResume({
      customFields: [
        { label: "Permis", value: "B — véhiculé" },
        { label: "Portfolio", value: "monsite.fr" },
      ],
    });
    expect(r.customFields).toEqual([
      { label: "Permis", value: "B — véhiculé" },
      { label: "Portfolio", value: "monsite.fr" },
    ]);
  });

  it("jette une info complémentaire sans valeur (un libellé seul ne dit rien)", () => {
    const r = normalizeResume({
      customFields: [{ label: "Permis", value: "" }, { label: "Âge", value: "28 ans" }],
    });
    expect(r.customFields).toEqual([{ label: "Âge", value: "28 ans" }]);
  });

  it("conserve l'ordre des sections relevé dans le CV source", () => {
    const r = normalizeResume({ sectionOrder: ["education", "experience", "custom:0"] });
    expect(r.sectionOrder).toEqual(["education", "experience", "custom:0"]);
  });

  it("préserve la colonne d'une section libre (placement deux-colonnes)", () => {
    const r = normalizeResume({
      customSections: [
        { title: "Publications", items: ["X"], column: "sidebar" },
        { title: "Distinctions", items: ["Z"], column: "n'importe quoi" },
      ],
    });
    expect(r.customSections[0].column).toBe("sidebar");
    expect(r.customSections[1].column).toBeUndefined(); // valeur invalide → ignorée
  });

  it("préserve les titres personnalisés et jette les valeurs vides", () => {
    const r = normalizeResume({
      sectionTitles: { summary: "Mon profil", skills: "  ", education: 42 },
    });
    expect(r.sectionTitles).toEqual({ summary: "Mon profil", education: "42" });
  });
});

describe("normalizeLetter", () => {
  it("comble les champs vides avec DEFAULT_LETTER", () => {
    const l = normalizeLetter({ subject: "Mon sujet" });
    expect(l.subject).toBe("Mon sujet");
    expect(l.greeting).toBe("Madame, Monsieur,");
  });
});

describe("isEmptyResume", () => {
  it("vrai pour un CV sans cœur", () => {
    expect(isEmptyResume(normalizeResume({}))).toBe(true);
  });
  it("faux dès qu'il y a un nom", () => {
    expect(isEmptyResume(normalizeResume({ name: "Alice" }))).toBe(false);
  });
});

describe("preservePhoto", () => {
  it("restaure la photo de base si l'entrant n'en a pas", () => {
    const base = { ...DEFAULT_RESUME, photo: "data:image/png;base64,AAA" };
    const incoming = normalizeResume({ name: "Alice" });
    expect(preservePhoto(incoming, base).photo).toBe("data:image/png;base64,AAA");
  });
  it("garde la photo entrante si présente", () => {
    const base = { ...DEFAULT_RESUME, photo: "OLD" };
    const incoming = { ...normalizeResume({ name: "Alice" }), photo: "NEW" };
    expect(preservePhoto(incoming, base).photo).toBe("NEW");
  });
});

describe("mergeTailored (anti-wipe)", () => {
  const base: Resume = normalizeResume({
    name: "Alice",
    experience: [{ title: "Dev", bullets: ["a"] }],
    languages: [{ name: "FR", level: "Natif" }],
    interests: ["Lecture"],
    certifications: ["AWS"],
    projects: [{ title: "P1", date: "2024", description: "x" }],
    volunteer: [{ title: "Croix-Rouge", bullets: [] }],
    customSections: [{ title: "Publications", items: ["Article X"] }],
    customFields: [{ label: "Permis", value: "B" }],
    sectionOrder: ["education", "experience"],
    hiddenSections: ["interests"],
  });

  it("restaure languages/interests même si l'IA les renvoie", () => {
    const tailored = normalizeResume({
      name: "Alice",
      experience: [{ title: "Dev adapté" }],
      languages: [{ name: "EN", level: "Courant" }],
      interests: ["Autre"],
    });
    const merged = mergeTailored(base, tailored);
    expect(merged.languages).toEqual([{ name: "FR", level: "Natif" }]);
    expect(merged.interests).toEqual(["Lecture"]);
  });

  it("restaure projects/certifications/volunteer/customSections si l'IA les vide", () => {
    const tailored = normalizeResume({ name: "Alice", experience: [{ title: "Dev" }] });
    const merged = mergeTailored(base, tailored);
    expect(merged.certifications).toEqual(["AWS"]);
    expect(merged.projects).toHaveLength(1);
    expect(merged.volunteer).toHaveLength(1);
    expect(merged.customSections).toEqual([{ title: "Publications", items: ["Article X"] }]);
  });

  it("restaure customFields et sectionOrder si l'IA les oublie", () => {
    const tailored = normalizeResume({ name: "Alice", experience: [{ title: "Dev" }] });
    const merged = mergeTailored(base, tailored);
    expect(merged.customFields).toEqual([{ label: "Permis", value: "B" }]);
    expect(merged.sectionOrder).toEqual(["education", "experience"]);
  });

  // `hiddenSections` n'est jamais envoyé à l'IA : elle ne peut donc que l'omettre. Sans ce
  // report, une adaptation à une offre ferait silencieusement réapparaître les sections que
  // l'utilisateur avait masquées.
  it("reporte toujours le masquage choisi par l'utilisateur", () => {
    const tailored = normalizeResume({ name: "Alice", experience: [{ title: "Dev" }] });
    expect(mergeTailored(base, tailored).hiddenSections).toEqual(["interests"]);
  });

  // Titres personnalisés et colonnes : préférences d'affichage jamais émises par l'IA.
  it("reporte toujours les titres personnalisés des sections", () => {
    const withTitles = normalizeResume({ ...base, sectionTitles: { summary: "Profil", skills: "Expertise" } });
    const tailored = normalizeResume({ name: "Alice", experience: [{ title: "Dev" }], sectionTitles: {} });
    expect(mergeTailored(withTitles, tailored).sectionTitles).toEqual({ summary: "Profil", skills: "Expertise" });
  });

  it("restaure la colonne des sections libres par index, même quand l'IA réécrit leur contenu", () => {
    const withCol = normalizeResume({
      name: "Alice",
      experience: [{ title: "Dev", bullets: ["a"] }],
      customSections: [{ title: "Publications", items: ["Article X"], column: "sidebar" }],
    });
    // L'IA renvoie la section adaptée mais SANS colonne (elle ne la connaît pas).
    const tailored = normalizeResume({
      name: "Alice",
      experience: [{ title: "Dev" }],
      customSections: [{ title: "Publications", items: ["Article X adapté"] }],
    });
    const merged = mergeTailored(withCol, tailored);
    expect(merged.customSections[0].items).toEqual(["Article X adapté"]); // contenu adapté conservé
    expect(merged.customSections[0].column).toBe("sidebar"); // placement restauré
  });

  it("lève si la réponse IA vide un CV qui avait un cœur", () => {
    const empty = normalizeResume({});
    expect(() => mergeTailored(base, empty)).toThrow();
  });
});

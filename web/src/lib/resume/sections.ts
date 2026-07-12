import type { Resume, LanguageItem } from "./schema";

/**
 * Transforme un CV en liste ordonnée de sections AFFICHABLES.
 *
 * Renversement de responsabilité : jusqu'ici chaque modèle PDF listait en dur les
 * champs qu'il voulait bien rendre, et ignorait silencieusement tout le reste —
 * Marine avalait ainsi compétences, projets, certifications et bénévolat. Le défaut
 * était « je jette ».
 *
 * Ici, le CV produit SA liste de sections, exhaustive. Un modèle ne choisit plus ce
 * qui existe, seulement où le poser et avec quel style ; tout ce qu'il ne stylise pas
 * explicitement est rendu génériquement (cf. `GenericSections`). Le défaut devient
 * « j'affiche ». Une section inventée par l'IA à l'import (`customSections`) traverse
 * donc la chaîne sans qu'aucun code ne la connaisse.
 */

export interface TimelineEntry {
  title: string;
  subtitle: string;
  meta: string[];
  date: string;
  bullets: string[];
  description: string;
}

export type ResumeSection =
  | { id: string; title: string; kind: "text"; text: string }
  | { id: string; title: string; kind: "list"; items: string[] }
  | { id: string; title: string; kind: "timeline"; items: TimelineEntry[] }
  | { id: string; title: string; kind: "languages"; items: LanguageItem[] };

const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

function entry(p: Partial<TimelineEntry>): TimelineEntry {
  return {
    title: p.title ?? "",
    subtitle: p.subtitle ?? "",
    meta: (p.meta ?? []).filter(Boolean),
    date: p.date ?? "",
    bullets: (p.bullets ?? []).filter((b) => t(b)),
    description: p.description ?? "",
  };
}

/**
 * Sections d'un CV, dans l'ordre canonique, SANS les sections vides.
 * L'identité (nom, titre, coordonnées, photo) n'en fait pas partie : c'est l'en-tête,
 * rendu à part par chaque modèle.
 */
export function buildSections(resume: Resume): ResumeSection[] {
  const d = resume;
  const out: ResumeSection[] = [];

  const pushList = (id: string, title: string, raw: string[] | undefined) => {
    const items = (raw ?? []).filter((x) => t(x));
    if (items.length) out.push({ id, title, kind: "list", items });
  };
  const pushTimeline = (id: string, title: string, items: TimelineEntry[]) => {
    if (items.length) out.push({ id, title, kind: "timeline", items });
  };

  if (t(d.summary)) out.push({ id: "summary", title: "À propos", kind: "text", text: d.summary });

  pushTimeline(
    "experience",
    "Expériences",
    d.experience
      .filter((e) => e && (e.title || e.company || e.bullets.length))
      .map((e) =>
        entry({
          title: e.title,
          subtitle: e.company,
          meta: [e.contract, e.location],
          date: e.date,
          bullets: e.bullets,
        }),
      ),
  );

  pushTimeline(
    "education",
    "Formations",
    d.education
      .filter((e) => e && (e.title || e.school))
      .map((e) => entry({ title: e.title, subtitle: e.school, meta: [e.location], date: e.date })),
  );

  pushList("skills", "Compétences", d.skills);
  pushList("softSkills", "Soft skills", d.softSkills);
  pushList("tools", "Outils", d.tools);

  pushTimeline(
    "projects",
    "Projets",
    d.projects
      .filter((p) => p && (p.title || p.description))
      .map((p) => entry({ title: p.title, date: p.date, description: p.description })),
  );

  pushList("certifications", "Certifications", d.certifications);

  pushTimeline(
    "volunteer",
    "Bénévolat",
    d.volunteer
      .filter((v) => v && (v.title || v.organization || v.bullets.length))
      .map((v) =>
        entry({
          title: v.title,
          subtitle: v.organization,
          meta: [v.location],
          date: v.date,
          bullets: v.bullets,
        }),
      ),
  );

  const langs = d.languages.filter((l) => l && t(l.name));
  if (langs.length) out.push({ id: "languages", title: "Langues", kind: "languages", items: langs });

  pushList("interests", "Centres d'intérêt", d.interests);

  // Sections libres : titre choisi par l'utilisateur (ou relevé du CV importé par l'IA).
  // Aucun code ne les connaît — c'est le but.
  (d.customSections ?? []).forEach((c, i) => {
    const items = (c.items ?? []).filter((x) => t(x));
    if (t(c.title) && items.length) {
      out.push({ id: `custom:${i}`, title: c.title, kind: "list", items });
    }
  });

  return out;
}

import type { Resume, LanguageItem } from "./schema";

/**
 * Transforme un CV en liste ordonnée de sections AFFICHABLES.
 *
 * Renversement de responsabilité : jusqu'ici chaque modèle PDF listait en dur les
 * champs qu'il voulait bien rendre, et ignorait silencieusement tout le reste —
 * Marine avalait ainsi compétences, projets, certifications et bénévolat. Le défaut
 * était « je jette ».
 *
 * Ici, le CV produit SA liste de sections, exhaustive et déjà ordonnée. Un modèle ne
 * choisit plus ce qui existe ni dans quel ordre : il itère sur ce qu'on lui donne et ne
 * décide que du placement et du style (cf. `SectionContent`). Le défaut devient
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

/**
 * Identifiants canoniques des sections « connues », dans leur ordre par défaut.
 * Les sections libres portent `custom:<index dans customSections>`.
 * Sert aussi de vocabulaire à l'IA pour remplir `sectionOrder` (cf. `prompts.ts`) :
 * la liste n'est donc écrite qu'ici, et ne peut pas dériver.
 */
export const SECTION_IDS = [
  "summary", "experience", "education", "skills", "softSkills", "tools",
  "projects", "certifications", "volunteer", "languages", "interests",
] as const;

const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

/** Coordonnée d'en-tête. `custom:<i>` = champ libre (« Permis », « Portfolio »…). */
export interface ContactEntry {
  id: string;
  label: string;
  value: string;
}

/**
 * Coordonnées du CV, y compris les champs libres — même principe que `buildSections` :
 * l'en-tête d'un modèle ne choisit plus ce qui existe, il affiche ce que le CV contient.
 * Un « Permis B » ou un « Portfolio » relevé à l'import n'a donc besoin d'aucun code
 * dédié pour apparaître.
 */
export function buildContacts(resume: Resume): ContactEntry[] {
  const d = resume;
  const out: ContactEntry[] = [];
  const push = (id: string, label: string, value: string) => {
    if (t(value)) out.push({ id, label, value: t(value) });
  };

  push("location", "Ville", d.location);
  push("email", "Email", d.email);
  push("phone", "Téléphone", d.phone);
  push("linkedin", "LinkedIn", d.linkedin);

  (d.customFields ?? []).forEach((f, i) => {
    if (t(f.value)) out.push({ id: `custom:${i}`, label: t(f.label), value: t(f.value) });
  });

  return out;
}

/** Texte affichable d'une coordonnée : « Permis : B » pour un champ libre, la valeur seule sinon. */
export function contactText(c: ContactEntry): string {
  return c.label && c.id.startsWith("custom:") ? `${c.label} : ${c.value}` : c.value;
}

/**
 * Applique l'ordre choisi (par l'IA à l'import, ou par l'utilisateur via les flèches).
 * Tri stable : une section absente de `order` — nouvellement remplie, ou créée après un
 * réordonnancement — garde son rang canonique et se range à la fin. Elle n'est JAMAIS perdue.
 */
function applyOrder(sections: ResumeSection[], order: string[]): ResumeSection[] {
  if (!order.length) return sections;
  const rank = new Map(order.map((id, i) => [id, i]));
  return sections
    .map((sec, i) => ({ sec, key: rank.get(sec.id) ?? order.length + i }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.sec);
}

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
 * Sections d'un CV, dans l'ordre voulu (`resume.sectionOrder`, sinon canonique), SANS les
 * sections vides. L'identité (nom, titre, coordonnées, photo) n'en fait pas partie : c'est
 * l'en-tête, rendu à part par chaque modèle (cf. `buildContacts`).
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

  return applyOrder(out, resume.sectionOrder ?? []);
}

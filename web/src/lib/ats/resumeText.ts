/**
 * Sérialisation d'un CV structuré (`Resume`) en texte analysable par l'ATS.
 *
 * Remplace la lecture de `docStore.html` — vestige de l'ancien pipeline HTML, TOUJOURS vide
 * depuis la migration React PDF (`setJson` remet `html: ""`). C'était la cause du score 0.
 *
 * Les sections masquées (`hiddenSections`) sont exclues : elles n'apparaissent pas dans le PDF,
 * donc un vrai ATS ne les lit pas. `photo` (base64) n'est jamais sérialisée.
 */

import type { Resume } from "@/lib/resume/schema";

/** Zones d'un CV. Un ATS ne pèse pas de la même façon un titre de poste et un centre d'intérêt. */
export type ResumeZones = {
  title: string;
  summary: string;
  experience: string;
  skills: string;
  education: string;
  other: string;
};

const lines = (...parts: (string | string[])[]): string =>
  parts
    .flat()
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

export function resumeToZones(resume: Resume): ResumeZones {
  const hidden = new Set(resume.hiddenSections);
  const on = <T>(id: string, value: T[]): T[] => (hidden.has(id) ? [] : value);

  return {
    title: lines(resume.title),
    summary: lines(hidden.has("summary") ? "" : resume.summary),
    experience: lines(
      on("experience", resume.experience).map((e) =>
        lines([e.title, e.company, e.contract, e.location, e.date].join(" "), e.bullets),
      ),
      on("projects", resume.projects).map((p) => lines(p.title, p.description)),
      on("volunteer", resume.volunteer).map((v) =>
        lines([v.title, v.organization, v.location].join(" "), v.bullets),
      ),
    ),
    skills: lines(
      on("skills", resume.skills),
      on("tools", resume.tools),
      on("softSkills", resume.softSkills),
      on("certifications", resume.certifications),
    ),
    education: lines(
      on("education", resume.education).map((e) =>
        [e.title, e.school, e.location, e.date].join(" "),
      ),
    ),
    other: lines(
      on("languages", resume.languages).map((l) => `${l.name} ${l.level}`),
      on("interests", resume.interests),
      resume.customSections.flatMap((s, i) =>
        hidden.has(`custom:${i}`) ? [] : [lines(s.title, s.items)],
      ),
      resume.customFields.map((f) => `${f.label} ${f.value}`),
    ),
  };
}

/** Tout le texte visible du CV, zones confondues. */
export function resumeToText(resume: Resume): string {
  return lines(Object.values(resumeToZones(resume)));
}

/**
 * Présence des grandes sections, lue directement dans les données.
 * Remplace `detectSections()` (regex sur des balises `<h1>`…`<h6>` qui n'existent plus).
 */
export function detectResumeSections(resume: Resume): Record<string, boolean> {
  const hidden = new Set(resume.hiddenSections);
  const filled = (id: string, value: string | unknown[]): boolean =>
    !hidden.has(id) && (typeof value === "string" ? value.trim().length > 0 : value.length > 0);

  return {
    "Résumé / Accroche": filled("summary", resume.summary),
    "Expériences": filled("experience", resume.experience),
    "Compétences":
      filled("skills", resume.skills) ||
      filled("tools", resume.tools) ||
      filled("softSkills", resume.softSkills),
    "Langues": filled("languages", resume.languages),
    "Formation": filled("education", resume.education),
    "Centres d'intérêt": filled("interests", resume.interests),
  };
}

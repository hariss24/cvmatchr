import {
  resumeSchema,
  letterSchema,
  RESUME_TOP_KEYS,
  DEFAULT_LETTER,
  type Resume,
  type Letter,
} from "./schema";

/**
 * Coercition + garde-fous du domaine CV.
 *
 * Port fidèle de :
 *  - `ai_engine.py` : `_unwrap_resume`, `_normalize_resume`, et l'anti-wipe de `tailor_resume`
 *    (l.756-771) ;
 *  - `static/js/resume-form.js` : `unwrapResume`, `normalizeIncoming`, et `loadData` (rejectEmpty
 *    + conservation de la photo).
 *
 * Les caps (max 20 expériences, 60 compétences, 8 bullets…) et le découpage des chaînes
 * (`skills`/`interests`/`certifications` reçus en texte) reproduisent `_normalize_resume`.
 */

const TOP_KEYS = new Set<string>(RESUME_TOP_KEYS);

/** Équivalent de `_s` (Python) : trim, "" si null/undefined. */
function s(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

/** Découpe une chaîne sur \n , ; — sert quand l'IA renvoie une liste sous forme de texte. */
function splitToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[\n,;]/);
  return [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasTopKey(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some((k) => TOP_KEYS.has(k));
}

/**
 * Récupère le CV d'une réponse IA mal emballée (liste `[{...}]`, enveloppe `{"cv": {...}}`).
 * Évite le vidage silencieux. Port de `_unwrap_resume` / `unwrapResume`.
 */
export function unwrap(input: unknown): Record<string, unknown> {
  let obj = input;
  if (Array.isArray(obj)) {
    obj = obj.find((x) => x && typeof x === "object") ?? {};
  }
  const rec = asRecord(obj);
  if (hasTopKey(rec)) return rec;
  for (const v of Object.values(rec)) {
    const inner = asRecord(v);
    if (hasTopKey(inner)) return inner;
    if (Array.isArray(v)) {
      const found = v.find(
        (x) => x && typeof x === "object" && hasTopKey(asRecord(x)),
      );
      if (found) return asRecord(found);
    }
  }
  return rec;
}

const cleanList = (value: unknown): string[] =>
  splitToArray(value).map(s).filter(Boolean);

/**
 * Coerce une structure quelconque vers un CV propre et sûr (caps, types).
 * Port de `_normalize_resume` (la photo est conservée comme dans `normalizeIncoming`).
 */
export function normalizeResume(input: unknown): Resume {
  const d = unwrap(input);

  const experience = asArray(d.experience).map((raw) => {
    const e = asRecord(raw);
    return {
      title: s(e.title),
      company: s(e.company),
      contract: s(e.contract),
      location: s(e.location),
      date: s(e.date),
      bullets: splitToArray(e.bullets).map(s).filter(Boolean).slice(0, 8),
    };
  });

  const education = asArray(d.education).map((raw) => {
    const e = asRecord(raw);
    return { title: s(e.title), school: s(e.school), location: s(e.location), date: s(e.date) };
  });

  const languages = asArray(d.languages)
    .map((raw) => {
      const l = asRecord(raw);
      return { name: s(l.name), level: s(l.level) };
    })
    .filter((l) => l.name);

  const projects = asArray(d.projects).map((raw) => {
    const p = asRecord(raw);
    return { title: s(p.title), date: s(p.date), description: s(p.description) };
  });

  const volunteer = asArray(d.volunteer).map((raw) => {
    const v = asRecord(raw);
    return {
      title: s(v.title),
      organization: s(v.organization),
      location: s(v.location),
      date: s(v.date),
      bullets: splitToArray(v.bullets).map(s).filter(Boolean).slice(0, 8),
    };
  });

  const coerced = {
    name: s(d.name),
    title: s(d.title),
    location: s(d.location),
    email: s(d.email),
    phone: s(d.phone),
    linkedin: s(d.linkedin),
    photo: s(d.photo),
    summary: s(d.summary),
    experience: experience.slice(0, 20),
    education: education.slice(0, 20),
    skills: cleanList(d.skills).slice(0, 60),
    softSkills: cleanList(d.softSkills).slice(0, 40),
    tools: cleanList(d.tools).slice(0, 40),
    languages: languages.slice(0, 20),
    interests: cleanList(d.interests).slice(0, 20),
    projects: projects.slice(0, 20),
    certifications: cleanList(d.certifications).slice(0, 40),
    volunteer: volunteer.slice(0, 20),
  };

  // Garantie finale de forme via Zod (les défauts comblent un éventuel champ manquant).
  return resumeSchema.parse(coerced);
}

/** Coerce une lettre : comble les champs vides avec `DEFAULT_LETTER`. Port du branche Lettre de `normalizeIncoming`. */
export function normalizeLetter(input: unknown): Letter {
  const o = asRecord(input);
  const pick = (k: keyof Letter): string => s(o[k]) || DEFAULT_LETTER[k];
  return letterSchema.parse({
    sender_name: pick("sender_name"),
    sender_address: pick("sender_address"),
    sender_contact: pick("sender_contact"),
    date: pick("date"),
    recipient_name: pick("recipient_name"),
    recipient_service: pick("recipient_service"),
    recipient_address: pick("recipient_address"),
    subject: pick("subject"),
    greeting: pick("greeting"),
    body: pick("body"),
    signoff: pick("signoff"),
    signature: pick("signature"),
  });
}

/**
 * Un CV « vide » n'a ni nom, ni expérience, ni compétences, ni formation.
 * Sert au garde-fou `rejectEmpty` (loadData) : ne jamais écraser le formulaire avec du vide.
 */
export function isEmptyLetter(l: Letter): boolean {
  return l.body === DEFAULT_LETTER.body && l.subject === DEFAULT_LETTER.subject;
}

export function isEmptyResume(r: Resume): boolean {
  return !r.name && !r.experience.length && !r.skills.length && !r.education.length;
}

/** Si le CV entrant n'a pas de photo, conserver celle du CV de base. Port de `loadData` (l.822). */
export function preservePhoto(incoming: Resume, base: Resume | null | undefined): Resume {
  if (!incoming.photo && base?.photo) {
    return { ...incoming, photo: base.photo };
  }
  return incoming;
}

/**
 * Anti-wipe du tailoring (port de `tailor_resume`, l.756-771) :
 *  - projects/certifications/volunteer : restaurés depuis la base si l'IA les a vidés ;
 *  - languages/interests : TOUJOURS restaurés depuis la base (aucun niveau ne les modifie) ;
 *  - lève une erreur si la base avait un cœur (nom ou expériences) et que la réponse est vide.
 *
 * `base` et `tailored` doivent déjà être normalisés.
 */
export function mergeTailored(base: Resume, tailored: Resume): Resume {
  const result: Resume = { ...tailored };

  // Restaurés depuis la base seulement si l'IA les a vidés.
  if (result.projects.length === 0 && base.projects.length > 0) result.projects = base.projects;
  if (result.certifications.length === 0 && base.certifications.length > 0)
    result.certifications = base.certifications;
  if (result.volunteer.length === 0 && base.volunteer.length > 0) result.volunteer = base.volunteer;

  // Toujours restaurés depuis la base (aucun niveau d'adaptation ne les modifie).
  if (base.languages.length > 0) result.languages = base.languages;
  if (base.interests.length > 0) result.interests = base.interests;

  if ((base.name || base.experience.length) && !(result.name || result.experience.length)) {
    throw new Error(
      "Réponse IA invalide : le CV adapté est vide (structure JSON inattendue).",
    );
  }
  return result;
}

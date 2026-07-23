import { z } from "zod";

/**
 * Schéma JSON du CV/Lettre — source de vérité partagée client/serveur.
 *
 * Port fidèle de :
 *  - `ai_engine.py` (`_RESUME_SCHEMA_DESC`, l.460-476) — la forme attendue par l'IA ;
 *  - `static/js/resume-form.js` (`DEFAULT_RESUME` / `DEFAULT_LETTER`) — les valeurs par défaut.
 *
 * Tous les champs ont une valeur par défaut (`""` ou `[]`) : le parsing est tolérant,
 * ce qui sert la couche `normalize` (anti-wipe) qui fusionne les réponses partielles de l'IA.
 *
 * Note : `photo` (base64) fait partie du modèle Formulaire mais n'est JAMAIS envoyé à l'IA
 * (cf. `_RESUME_SCHEMA_DESC` qui ne le contient pas). Le strip/restore est géré ailleurs.
 */

export const experienceItemSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  contract: z.string().default(""),
  location: z.string().default(""),
  date: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const educationItemSchema = z.object({
  title: z.string().default(""),
  school: z.string().default(""),
  location: z.string().default(""),
  date: z.string().default(""),
});

export const languageItemSchema = z.object({
  name: z.string().default(""),
  level: z.string().default(""),
});

export const projectItemSchema = z.object({
  title: z.string().default(""),
  date: z.string().default(""),
  description: z.string().default(""),
});

export const volunteerItemSchema = z.object({
  title: z.string().default(""),
  organization: z.string().default(""),
  location: z.string().default(""),
  date: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

/**
 * Section libre : rattrape toute rubrique du CV source qui ne correspond à aucun
 * champ standard (« Publications », « Distinctions », « Références »…). Forme
 * volontairement minimale — un titre + des lignes — pour se brancher tel quel sur
 * `StringListSection` (formulaire) et `SectionTitle` + `Bullets` (PDF).
 */
export const customSectionSchema = z.object({
  title: z.string().default(""),
  items: z.array(z.string()).default([]),
  /**
   * Colonne cible dans un modèle à deux colonnes (cf. `templates.ts`, `columns: 2`) :
   * `"sidebar"` place la section dans la barre latérale, sinon (absent ou `"main"`) dans
   * la colonne principale. N'a d'effet QUE sur les modèles deux-colonnes ; les autres
   * l'ignorent. Ne concerne que les sections libres — les sections de base gardent le
   * placement défini par chaque modèle.
   */
  column: z.enum(["main", "sidebar"]).optional(),
});

/**
 * Info d'en-tête libre : rattrape tout ce que l'état civil d'un CV peut contenir sans
 * avoir de case dédiée (« Permis B », « Portfolio », « Mobilité », « Âge », « GitHub »,
 * « Disponibilité »…). Même rôle que `customSections`, mais pour l'identité plutôt que
 * pour le corps du CV.
 */
export const customFieldSchema = z.object({
  label: z.string().default(""),
  value: z.string().default(""),
});

export const resumeSchema = z.object({
  name: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  linkedin: z.string().default(""),
  photo: z.string().default(""),
  summary: z.string().default(""),
  experience: z.array(experienceItemSchema).default([]),
  education: z.array(educationItemSchema).default([]),
  skills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  languages: z.array(languageItemSchema).default([]),
  interests: z.array(z.string()).default([]),
  projects: z.array(projectItemSchema).default([]),
  certifications: z.array(z.string()).default([]),
  volunteer: z.array(volunteerItemSchema).default([]),
  customSections: z.array(customSectionSchema).default([]),
  customFields: z.array(customFieldSchema).default([]),
  /**
   * Ordre d'affichage des sections, par identifiant (cf. `SECTION_IDS`, plus `custom:<i>`
   * pour les sections libres). Vide = ordre canonique du modèle. C'est une DONNÉE du CV,
   * pas une constante du modèle : l'IA le remplit à l'import en recopiant l'ordre du CV
   * source, et l'utilisateur le réordonne à la main dans le formulaire.
   */
  sectionOrder: z.array(z.string()).default([]),
  /**
   * Titres personnalisés des sections, par identifiant (`summary`, `experience`… ou
   * `custom:<i>`). Vide = titre canonique du modèle (cf. `ALL_BASE_SECTIONS`). C'est une
   * préférence d'affichage de l'utilisateur : jamais envoyé à l'IA, toujours restauré
   * après une adaptation (cf. `mergeTailored`). Les sections libres portent en plus leur
   * titre dans `customSections[i].title` (source de vérité pour elles).
   */
  sectionTitles: z.record(z.string(), z.string()).default({}),
  /**
   * Sections masquées, par identifiant. Masquer n'est PAS supprimer : la section
   * disparaît du PDF mais son contenu reste intact dans le CV, et un clic la ramène.
   * Sert à adapter un CV à une offre sans rien perdre. Jamais envoyé à l'IA : c'est une
   * préférence d'affichage de l'utilisateur, pas du contenu.
   */
  hiddenSections: z.array(z.string()).default([]),
});

export const letterSchema = z.object({
  sender_name: z.string().default(""),
  sender_address: z.string().default(""),
  sender_contact: z.string().default(""),
  date: z.string().default(""),
  recipient_name: z.string().default(""),
  recipient_service: z.string().default(""),
  recipient_address: z.string().default(""),
  subject: z.string().default(""),
  greeting: z.string().default(""),
  body: z.string().default(""),
  signoff: z.string().default(""),
  signature: z.string().default(""),
});

export type ExperienceItem = z.infer<typeof experienceItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type LanguageItem = z.infer<typeof languageItemSchema>;
export type ProjectItem = z.infer<typeof projectItemSchema>;
export type VolunteerItem = z.infer<typeof volunteerItemSchema>;
export type CustomSection = z.infer<typeof customSectionSchema>;
export type CustomField = z.infer<typeof customFieldSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export type Letter = z.infer<typeof letterSchema>;

export type DocType = "CV" | "Lettre" | "Maître";

/** Clés de premier niveau d'un CV — sert à dés-emballer une réponse IA mal formée. */
export const RESUME_TOP_KEYS = [
  "name", "title", "location", "email", "phone", "linkedin", "summary",
  "experience", "education", "skills", "softSkills", "tools", "languages", "interests",
  "projects", "certifications", "volunteer", "customSections", "customFields",
  "sectionOrder", "sectionTitles", "hiddenSections",
] as const;

/** Port fidèle de `DEFAULT_RESUME` (resume-form.js, l.20-51). */
export const DEFAULT_RESUME: Resume = {
  name: "Prénom Nom",
  title: "Titre du poste",
  location: "Ville, Pays",
  email: "email@example.com",
  phone: "+33 6 00 00 00 00",
  linkedin: "linkedin.com/in/profil",
  photo: "",
  summary:
    "Bref résumé professionnel : 2 à 3 phrases qui présentent votre profil, votre expérience et ce que vous recherchez.",
  experience: [
    {
      title: "Poste occupé",
      company: "Entreprise",
      contract: "Stage",
      location: "Ville",
      date: "Jan 2024 - Présent",
      bullets: [
        "Réalisation marquante avec métrique chiffrée.",
        "Autre réalisation pertinente pour le poste visé.",
      ],
    },
    {
      title: "Poste précédent",
      company: "Autre entreprise",
      contract: "",
      location: "Ville",
      date: "2022 - 2023",
      bullets: ["Description courte de la mission."],
    },
  ],
  education: [
    { title: "Diplôme", school: "Établissement", location: "Ville", date: "2020 - 2022" },
  ],
  skills: [
    "Compétence 1", "Compétence 2", "Compétence 3",
    "Compétence 4", "Compétence 5", "Compétence 6",
  ],
  softSkills: ["Soft skill 1", "Soft skill 2", "Soft skill 3"],
  tools: ["Outil 1", "Outil 2", "Outil 3"],
  languages: [
    { name: "Français", level: "Natif" },
    { name: "Anglais", level: "Courant" },
  ],
  interests: ["Lecture", "Sport", "Voyages"],
  projects: [],
  certifications: [],
  volunteer: [],
  customSections: [],
  customFields: [],
  sectionOrder: [],
  sectionTitles: {},
  hiddenSections: [],
};

/** Port fidèle de `DEFAULT_LETTER` (resume-form.js, l.54-67). */
export const DEFAULT_LETTER: Letter = {
  sender_name: "Prénom Nom",
  sender_address: "Adresse, Ville",
  sender_contact: "email@example.com · +33 6 00 00 00 00",
  date: "Ville, le JJ/MM/AAAA",
  recipient_name: "Nom de l'entreprise",
  recipient_service: "Service Recrutement",
  recipient_address: "Adresse de l'entreprise",
  subject: "Candidature au poste de [Intitulé du poste]",
  greeting: "Madame, Monsieur,",
  body:
    "[Accroche : présentez-vous brièvement et expliquez pourquoi ce poste et cette entreprise vous intéressent particulièrement.]\n\n" +
    "[Argumentaire : décrivez vos compétences et expériences les plus pertinentes, avec des exemples concrets.]\n\n" +
    "[Conclusion : réaffirmez votre motivation, mentionnez votre disponibilité pour un entretien et remerciez pour l'attention portée à votre candidature.]",
  signoff:
    "Dans l'attente de votre réponse, je reste à votre disposition pour tout échange.\n\n" +
    "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
  signature: "Prénom Nom",
};

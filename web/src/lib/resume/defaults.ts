import type { Resume, Letter } from "./schema";

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
  // Politesse courte : la formule cérémonieuse d'origine (« Dans l'attente de votre réponse,
  // je reste à votre disposition… Veuillez agréer… ») terminait en langue de bois même une
  // lettre écrite au registre « Authentique » — ce champ échappe à l'IA, qui ne touche
  // qu'au corps.
  signoff: "Cordialement,",
  signature: "Prénom Nom",
};

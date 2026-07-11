import { DEFAULT_RESUME, type Resume } from "@/lib/resume/schema";

/**
 * Profil « Mes informations » : identité de l'utilisateur, saisie une fois et
 * réutilisée pour pré-remplir les CV vierges et les lettres. Singleton local
 * (id = "me"), pensé pour adosser un compte plus tard.
 */
export interface UserProfile {
  id: "me";
  // Requis
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  // Optionnels
  adresse: string;
  codePostal: string;
  linkedin: string;
  updatedAt: number;
}

export const EMPTY_PROFILE: UserProfile = {
  id: "me",
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  ville: "",
  adresse: "",
  codePostal: "",
  linkedin: "",
  updatedAt: 0,
};

/** Identité résolue pour construire une lettre (profil prioritaire, fallback CV). */
export interface LetterIdentity {
  cv: Resume;
  prenom: string;
  nom: string;
}

/** True si la valeur est vide ou encore égale au placeholder du CV par défaut. */
function isPlaceholder(value: string, def: string): boolean {
  return !value.trim() || value === def;
}

/**
 * Pré-remplit l'identité d'un CV vierge depuis le profil, SANS écraser une
 * saisie réelle : ne remplace qu'un champ vide ou resté au placeholder.
 */
export function applyProfileToResume(resume: Resume, profile: UserProfile | null): Resume {
  if (!profile) return resume;
  const name = `${profile.prenom} ${profile.nom}`.trim();
  return {
    ...resume,
    name: name && isPlaceholder(resume.name, DEFAULT_RESUME.name) ? name : resume.name,
    email: profile.email && isPlaceholder(resume.email, DEFAULT_RESUME.email) ? profile.email : resume.email,
    phone: profile.telephone && isPlaceholder(resume.phone, DEFAULT_RESUME.phone) ? profile.telephone : resume.phone,
    location: profile.ville && isPlaceholder(resume.location, DEFAULT_RESUME.location) ? profile.ville : resume.location,
    linkedin: profile.linkedin && isPlaceholder(resume.linkedin, DEFAULT_RESUME.linkedin) ? profile.linkedin : resume.linkedin,
  };
}

/**
 * Résout l'identité de l'en-tête de lettre : le profil est prioritaire (champ
 * par champ), sinon on retombe sur le CV chargé (nom redécoupé sur l'espace).
 */
export function resolveLetterIdentity(cv: Resume, profile: UserProfile | null): LetterIdentity {
  if (profile && (profile.prenom || profile.nom)) {
    const name = `${profile.prenom} ${profile.nom}`.trim();
    return {
      cv: {
        ...cv,
        name: name || cv.name,
        location: profile.ville || cv.location,
        email: profile.email || cv.email,
        phone: profile.telephone || cv.phone,
        linkedin: profile.linkedin || cv.linkedin,
      },
      prenom: profile.prenom,
      nom: profile.nom,
    };
  }
  const [prenom, ...rest] = (cv.name || "").trim().split(/\s+/);
  return { cv, prenom: prenom ?? "", nom: rest.join(" ") };
}

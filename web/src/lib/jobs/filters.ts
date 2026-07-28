import { EMPTY_PROFILE, type JobSearchProfile } from "./profile";
import type { SourceToggles } from "./sources";

/**
 * Ce que chaque pastille de la barre affiche, et si elle contraint réellement
 * la recherche. Une pastille au réglage par défaut n'affiche que son nom et
 * reste grise ; dès qu'elle filtre, elle passe en actif avec sa valeur — l'œil
 * repère ce qui contraint sans lire.
 *
 * Volontairement pur (aucun React) : c'est la seule logique de la barre qui
 * mérite des tests, et elle se teste sans DOM.
 */

export const CONTRACT_OPTIONS = [
  { code: "CDI", label: "CDI" },
  { code: "CDD", label: "CDD" },
  { code: "MIS", label: "Intérim" },
  { code: "SAI", label: "Saisonnier" },
];

export const AGE_OPTIONS = [
  { days: 1, label: "Aujourd'hui" },
  { days: 3, label: "3 jours" },
  { days: 7, label: "7 jours" },
  { days: 14, label: "14 jours" },
  { days: 30, label: "30 jours" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "", label: "Indifférent" },
  { value: "1", label: "Moins d'un an" },
  { value: "2", label: "1 à 3 ans" },
  { value: "3", label: "Plus de 3 ans" },
];

export const WORK_TIME_OPTIONS = [
  { value: "", label: "Indifférent" },
  { value: "true", label: "Temps plein" },
  { value: "false", label: "Temps partiel" },
];

export const QUALIFICATION_OPTIONS = [
  { value: "", label: "Indifférent" },
  { value: "0", label: "Non-cadre" },
  { value: "9", label: "Cadre" },
];

/** "" = ne contraint pas ⇒ pastille grise, sans valeur affichée. */
export function contractLabel(codes: string[]): string {
  if (codes.length === 0) return "";
  return codes
    .map((c) => CONTRACT_OPTIONS.find((o) => o.code === c)?.label ?? c)
    .join(", ");
}

export function ageLabel(days: number): string {
  if (days === EMPTY_PROFILE.maxAgeDays) return "";
  return AGE_OPTIONS.find((o) => o.days === days)?.label ?? `${days} jours`;
}

export function experienceLabel(level: JobSearchProfile["experienceLevel"], debutant: boolean): string {
  const niveau = EXPERIENCE_OPTIONS.find((o) => o.value === level && o.value !== "")?.label ?? "";
  if (niveau && debutant) return `${niveau}, débutant accepté`;
  if (debutant) return "Débutant accepté";
  return niveau;
}

export function workTimeLabel(value: JobSearchProfile["tempsPlein"]): string {
  return WORK_TIME_OPTIONS.find((o) => o.value === value && o.value !== "")?.label ?? "";
}

/** Toujours renseigné : le nombre de sources interrogées se lit en permanence. */
export function sourcesLabel(sources: SourceToggles): string {
  const n = Object.values(sources).filter(Boolean).length;
  if (n === 0) return "aucune source";
  return n === 1 ? "1 source" : `${n} sources`;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Nombre de réglages du panneau qui s'écartent du défaut (pastille « Plus de filtres »). */
export function moreFiltersCount(p: JobSearchProfile): number {
  let n = 0;
  if (p.prefilterKeywords.length > 0) n++;
  if (!sameList(p.excludedWords, EMPTY_PROFILE.excludedWords)) n++;
  if (p.includeKeywords.length > 0) n++;
  if (p.romeCodes.length > 0) n++;
  if (p.salaireMin != null) n++;
  if (p.qualification !== EMPTY_PROFILE.qualification) n++;
  if (p.homeAddress !== "") n++;
  return n;
}

export function hasActiveFilters(p: JobSearchProfile): boolean {
  return (
    !sameList(p.contractTypes, EMPTY_PROFILE.contractTypes) ||
    ageLabel(p.maxAgeDays) !== "" ||
    experienceLabel(p.experienceLevel, p.debutantAccepte) !== "" ||
    workTimeLabel(p.tempsPlein) !== "" ||
    moreFiltersCount(p) > 0
  );
}

/**
 * « Réinitialiser » remet les FILTRES au défaut, pas la recherche. On ne touche
 * ni au poste, ni au lieu, ni aux sources, ni aux données du candidat (adresse,
 * compétences) : les effacer par un bouton discret serait une perte de travail
 * disproportionnée par rapport à ce que le mot promet. Les compétences sont
 * sorties de ce reset avec la bascule en lettres : elles ne trient plus en
 * amont, elles nourrissent le classement — les vider ferait chuter toutes les
 * lettres sans que rien ne l'annonce.
 */
export function resetFilters(p: JobSearchProfile): JobSearchProfile {
  return {
    ...p,
    contractTypes: EMPTY_PROFILE.contractTypes,
    maxAgeDays: EMPTY_PROFILE.maxAgeDays,
    experienceLevel: EMPTY_PROFILE.experienceLevel,
    debutantAccepte: EMPTY_PROFILE.debutantAccepte,
    tempsPlein: EMPTY_PROFILE.tempsPlein,
    qualification: EMPTY_PROFILE.qualification,
    salaireMin: EMPTY_PROFILE.salaireMin,
    periodeSalaire: EMPTY_PROFILE.periodeSalaire,
    includeKeywords: EMPTY_PROFILE.includeKeywords,
    excludedWords: EMPTY_PROFILE.excludedWords,
    romeCodes: EMPTY_PROFILE.romeCodes,
  };
}

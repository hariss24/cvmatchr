import { DEFAULT_SOURCES, type SourceToggles } from "./sources";
import { DEFAULT_THRESHOLDS, type GradeThresholds } from "./grade";

/**
 * Profil de recherche d'offres — pièce centrale de la paramétrabilité.
 * Tous les réglages modifiables vivent ici, dans un objet unique passé en argument
 * aux fonctions `lib/jobs/`. Défauts neutres (EMPTY_PROFILE) ; les critères réels
 * sont saisis via l'UI et persistés dans Dexie. Cf. spec
 * `docs/superpowers/specs/2026-07-21-refonte-offres-formulaire-ft-design.md`.
 */

export type CommuteMode = "transit" | "driving" | "bicycling" | "walking";

/** Portée géographique d'un filtre de lieu (mappe les paramètres FT commune/departement/region). */
export type LocationKind = "commune" | "departement" | "region";

export interface LocationFilter {
  kind: LocationKind;
  code: string;   // code INSEE (commune 5 chiffres, département, région) ; "" = national
  label: string;  // libellé affiché, ex. "Paris 12e (75012)" / "Île-de-France"
  radiusKm: number; // rayon km, appliqué seulement si kind === "commune"
}

export interface JobSearchProfile {
  /** Adresse de départ pour le calcul du trajet. */
  homeAddress: string;
  /** Intitulés de postes recherchés (une requête France Travail par mot-clé). */
  keywords: string[];
  /** Filtre géographique (commune+rayon, département ou région). */
  location: LocationFilter;
  /** Débutant accepté → paramètre FT experienceExige="D". */
  debutantAccepte: boolean;
  /** Niveau d'expérience FT : "" (indifférent), "1" (-1 an), "2" (1-3 ans), "3" (+3 ans). */
  experienceLevel: "" | "1" | "2" | "3";
  /** Qualification FT : "" (indifférent), "0" (non-cadre), "9" (cadre). */
  qualification: "" | "0" | "9";
  /** Temps plein FT : "" (indifférent), "true" (plein), "false" (partiel). */
  tempsPlein: "" | "true" | "false";
  /** Modes de transport à calculer (Google Distance Matrix). */
  commuteModes: CommuteMode[];
  /** Types de contrat France Travail (ex. ["CDI", "CDD"]). */
  contractTypes: string[];
  /** Codes ROME (avancé, optionnel) → paramètre FT codeROME. */
  romeCodes: string[];
  /** Mots-clés à inclure : filtre serveur strict sur titre+description. */
  includeKeywords: string[];
  /** Ancienneté maximale des offres, en jours. */
  maxAgeDays: number;
  /** Mots interdits dans titre/description/type de contrat (filtre stages/alternances). */
  excludedWords: string[];
  /** Salaire minimum annuel/mensuel/horaire (null = pas de filtre). */
  salaireMin: number | null;
  /** Période du salaire : "M" (mensuel), "A" (annuel), "H" (horaire). */
  periodeSalaire: "M" | "A" | "H";
  /** Troncature de la description rapatriée par les sources. */
  maxDescriptionChars: number;
  /**
   * Compétences du candidat (minuscules) : matière première du critère
   * « compétences » du classement. Le nom vient de l'ancien pré-tri gratuit ;
   * il est conservé parce que la clé est persistée dans les profils Dexie.
   */
  prefilterKeywords: string[];
  /** Activation par provider. */
  sources: SourceToggles;
  /** Seuils de conversion score → lettre. Réglables (décision §3.1). */
  gradeThresholds: GradeThresholds;
}

/** Profil vide — défauts neutres. Aucune donnée personnelle. */
export const EMPTY_PROFILE: JobSearchProfile = {
  homeAddress: "",
  keywords: [],
  location: { kind: "commune", code: "", label: "", radiusKm: 10 },
  debutantAccepte: false,
  experienceLevel: "",
  qualification: "",
  tempsPlein: "",
  commuteModes: ["transit", "bicycling", "walking"],
  contractTypes: ["CDI", "CDD"],
  romeCodes: [],
  includeKeywords: [],
  maxAgeDays: 30,
  excludedWords: ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"],
  salaireMin: null,
  periodeSalaire: "M",
  maxDescriptionChars: 3000,
  prefilterKeywords: [],
  sources: DEFAULT_SOURCES,
  gradeThresholds: DEFAULT_THRESHOLDS,
};

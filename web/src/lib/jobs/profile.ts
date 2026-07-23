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

/** Un critère de la grille de notation (barème + affichage). */
export interface ScoringCriterion {
  key: string;
  label: string;
  max: number;
  description: string;
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
  /** Score minimum pour retenir une offre. */
  minScore: number;
  /** Troncature de la description envoyée à l'IA. */
  maxDescriptionChars: number;
  /** Résumé du candidat injecté dans le prompt de scoring. */
  candidateSummary: string;
  /** Barème de notation (structuré) : alimente le prompt IA ET l'encart de transparence. */
  scoringCriteria: ScoringCriterion[];
  /** Mots-clés de compétences pour le pré-tri gratuit (minuscules). */
  prefilterKeywords: string[];
  /** Nombre max d'offres envoyées à l'IA par recherche. */
  aiShortlist: number;
}

/** Barème générique par défaut (aucune donnée personnelle). */
const GENERIC_CRITERIA: ScoringCriterion[] = [
  { key: "tech", label: "Technique", max: 40, description: "Adéquation avec les compétences visées." },
  { key: "seniority", label: "Séniorité", max: 20, description: "Adéquation au niveau d'expérience recherché." },
  { key: "sector", label: "Secteur", max: 15, description: "Pertinence sectorielle." },
  { key: "geo", label: "Géo (trajet)", max: 15, description: "Ajuste selon les temps de trajet fournis." },
  { key: "red_flags", label: "Pièges", max: 10, description: "10 = aucun piège (salaire flou, missions imprécises)." },
];

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
  minScore: 70,
  maxDescriptionChars: 3000,
  candidateSummary: "",
  scoringCriteria: GENERIC_CRITERIA,
  prefilterKeywords: [],
  aiShortlist: 20,
};

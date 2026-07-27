import type { SourceId } from "./offer";

/**
 * Les trois sources interrogeables et leur quota mensuel gratuit.
 * `monthlyQuota: null` = pas de limite (France Travail).
 */
export const SOURCES: ReadonlyArray<{ id: SourceId; label: string; monthlyQuota: number | null }> = [
  { id: "francetravail", label: "France Travail", monthlyQuota: null },
  { id: "jsearch", label: "Google for Jobs", monthlyQuota: 200 },
  { id: "adzuna", label: "Adzuna", monthlyQuota: 1000 },
];

/** Quelles sources interroger lors d'une recherche. */
export type SourceToggles = Record<SourceId, boolean>;

/**
 * France Travail seule par défaut : l'utilisateur existant retrouve exactement
 * le comportement actuel, et aucun quota gratuit n'est consommé à son insu.
 */
export const DEFAULT_SOURCES: SourceToggles = {
  francetravail: true,
  adzuna: false,
  jsearch: false,
};

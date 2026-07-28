import { z } from "zod";
import { EMPTY_PROFILE, type JobSearchProfile } from "./profile";

const locationSchema = z.object({
  kind: z.enum(["commune", "departement", "region"]).catch("commune"),
  code: z.string().catch(""),
  label: z.string().catch(""),
  radiusKm: z.number().min(0).max(200).catch(10),
});

const criterionSchema = z.object({
  key: z.string(),
  label: z.string(),
  max: z.number(),
  description: z.string(),
});

const sourcesSchema = z.object({
  francetravail: z.boolean().catch(EMPTY_PROFILE.sources.francetravail),
  adzuna: z.boolean().catch(EMPTY_PROFILE.sources.adzuna),
  jsearch: z.boolean().catch(EMPTY_PROFILE.sources.jsearch),
}).catch(EMPTY_PROFILE.sources);

/**
 * Seuils score → lettre. Ils doivent décroître strictement, sinon deux lettres
 * deviendraient inatteignables : on retombe alors sur les défauts plutôt que
 * de laisser un classement incohérent.
 */
const gradeThresholdsSchema = z
  .object({
    S: z.number().int().min(0).max(100),
    A: z.number().int().min(0).max(100),
    B: z.number().int().min(0).max(100),
    C: z.number().int().min(0).max(100),
  })
  .refine((t) => t.S > t.A && t.A > t.B && t.B > t.C)
  .catch(EMPTY_PROFILE.gradeThresholds);

/**
 * Schéma tolérant : chaque champ retombe sur le défaut neutre d'EMPTY_PROFILE
 * via `.catch(...)`, pour qu'un corps de requête partiel ou légèrement invalide
 * ne casse jamais la recherche (on complète plutôt que rejeter).
 */
export const jobSearchProfileSchema = z.object({
  homeAddress: z.string().catch(EMPTY_PROFILE.homeAddress),
  keywords: z.array(z.string()).catch(EMPTY_PROFILE.keywords),
  location: locationSchema.catch(EMPTY_PROFILE.location),
  debutantAccepte: z.boolean().catch(EMPTY_PROFILE.debutantAccepte),
  experienceLevel: z.enum(["", "1", "2", "3"]).catch(EMPTY_PROFILE.experienceLevel),
  qualification: z.enum(["", "0", "9"]).catch(EMPTY_PROFILE.qualification),
  tempsPlein: z.enum(["", "true", "false"]).catch(EMPTY_PROFILE.tempsPlein),
  commuteModes: z.array(z.enum(["transit", "driving", "bicycling", "walking"])).catch(EMPTY_PROFILE.commuteModes),
  contractTypes: z.array(z.string()).catch(EMPTY_PROFILE.contractTypes),
  romeCodes: z.array(z.string()).catch(EMPTY_PROFILE.romeCodes),
  includeKeywords: z.array(z.string()).catch(EMPTY_PROFILE.includeKeywords),
  maxAgeDays: z.number().int().min(1).max(365).catch(EMPTY_PROFILE.maxAgeDays),
  excludedWords: z.array(z.string()).catch(EMPTY_PROFILE.excludedWords),
  salaireMin: z.number().positive().nullable().catch(EMPTY_PROFILE.salaireMin),
  periodeSalaire: z.enum(["M", "A", "H"]).catch(EMPTY_PROFILE.periodeSalaire),
  minScore: z.number().int().min(0).max(100).catch(EMPTY_PROFILE.minScore),
  maxDescriptionChars: z.number().int().min(500).max(10000).catch(EMPTY_PROFILE.maxDescriptionChars),
  candidateSummary: z.string().catch(EMPTY_PROFILE.candidateSummary),
  scoringCriteria: z.array(criterionSchema).catch(EMPTY_PROFILE.scoringCriteria),
  prefilterKeywords: z.array(z.string()).catch(EMPTY_PROFILE.prefilterKeywords),
  aiShortlist: z.number().int().min(1).max(100).catch(EMPTY_PROFILE.aiShortlist),
  sources: sourcesSchema,
  gradeThresholds: gradeThresholdsSchema,
});

/** Valide un input inconnu et complète les champs manquants avec les défauts neutres. */
export function parseProfile(input: unknown): JobSearchProfile {
  const base = (input && typeof input === "object") ? input : {};
  return jobSearchProfileSchema.parse({ ...EMPTY_PROFILE, ...base });
}

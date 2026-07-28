/**
 * Lettres de classement, isolées de tout le reste.
 *
 * Ce module n'importe RIEN, volontairement : `db.ts`, `profile.ts` et `JobCard`
 * n'ont besoin que d'ici. S'ils importaient depuis `rank/`, ils tireraient
 * `rome.ts` et ses 835 Ko de référentiel dans le bundle de chaque page touchant
 * à Dexie.
 */

export type Grade = "S" | "A" | "B" | "C" | "D";

/** De la meilleure à la moins bonne — sert aux filtres d'affichage. */
export const GRADE_ORDER: Grade[] = ["S", "A", "B", "C", "D"];

export interface GradeThresholds {
  S: number;
  A: number;
  B: number;
  C: number;
}

export const DEFAULT_THRESHOLDS: GradeThresholds = { S: 85, A: 70, B: 55, C: 40 };

/** Traduit un score en lettre. Seuils inclusifs, du haut vers le bas. */
export function gradeOf(score: number, t: GradeThresholds = DEFAULT_THRESHOLDS): Grade {
  if (score >= t.S) return "S";
  if (score >= t.A) return "A";
  if (score >= t.B) return "B";
  if (score >= t.C) return "C";
  return "D";
}

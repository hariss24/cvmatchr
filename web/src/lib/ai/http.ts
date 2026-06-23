import { NextResponse } from "next/server";

/**
 * Mappe une erreur de la couche IA vers une réponse HTTP cohérente :
 * - clé manquante       → 400
 * - quota épuisé        → 429
 * - sinon (JSON, etc.)  → 502 (réponse IA inexploitable)
 */
export function aiErrorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Échec de l'appel IA.";
  let status = 502;
  if (/Aucune clé API/i.test(message)) status = 400;
  else if (/Quota/i.test(message)) status = 429;
  return NextResponse.json({ error: message }, { status });
}

/** Normalise une liste de compétences : strings non vides, tronquées, dédupliquées. Port de `_coerce_skill_list`. */
export function coerceSkillList(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const label = String(item).trim().slice(0, 80);
    if (label && !seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
    if (out.length >= limit) break;
  }
  return out;
}

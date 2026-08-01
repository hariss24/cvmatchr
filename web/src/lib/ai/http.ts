import { NextResponse } from "next/server";

/** Lit la clé API + le modèle actif envoyés par le client (cf. lib/ai/client.ts `getApiHeaders`). */
export function readAiHeaders(req: Request): { key: string | null; model: string | null } {
  return {
    key: req.headers.get("x-api-key")?.trim() || null,
    model: req.headers.get("x-ai-model")?.trim() || null,
  };
}

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

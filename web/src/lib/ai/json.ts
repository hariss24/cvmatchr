/**
 * Parse une réponse IA en JSON, en retirant d'éventuelles clôtures markdown ```json.
 * Port de `_loads_ai_json` (ai_engine.py). Lève une erreur lisible si le JSON est malformé.
 */
export function parseAiJson(raw: string): unknown {
  let text = (raw || "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Réponse IA invalide (JSON malformé) : ${message}`);
  }
}

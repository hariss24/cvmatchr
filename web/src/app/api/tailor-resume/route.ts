import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { tailorResumeSystem, type TailorLevel } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { normalizeResume, mergeTailored, preservePhoto } from "@/lib/resume/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

const LEVELS: readonly TailorLevel[] = ["peu", "adapte", "hyper", "sur-mesure"];

type Body = {
  resume?: unknown;
  job_desc?: string;
  level?: string;
};

/**
 * Adapte un CV structuré (JSON) à une offre d'emploi. Port de `tailor_resume` (ai_engine.py).
 *
 * Sécurité/métier :
 * - la `photo` (base64) n'est JAMAIS envoyée à l'IA (retirée avant l'appel, restaurée au retour) ;
 * - anti-wipe via `mergeTailored` (langues/intérêts toujours restaurés, garde anti-vidage) ;
 * - anti-détection (nom de l'entreprise) assuré par le prompt système.
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const jobDesc = (body.job_desc ?? "").trim();
  if (!jobDesc) {
    return NextResponse.json({ error: "Offre d'emploi manquante." }, { status: 400 });
  }
  if (body.resume == null || typeof body.resume !== "object") {
    return NextResponse.json({ error: "CV manquant." }, { status: 400 });
  }

  const level: TailorLevel = LEVELS.includes(body.level as TailorLevel)
    ? (body.level as TailorLevel)
    : "adapte";

  const base = normalizeResume(body.resume);
  // La photo (base64) n'est jamais transmise à l'IA : inutile et coûteuse en tokens.
  const { photo: _photo, ...clean } = base;
  void _photo;

  const system = tailorResumeSystem(level);
  const content =
    "CV (JSON) :\n" + JSON.stringify(clean) + "\n\nOffre d'emploi :\n" + jobDesc;

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete([{ role: "user", content }], system, userKey);
    const tailored = normalizeResume(parseAiJson(raw));
    const merged = mergeTailored(base, tailored);
    const result = preservePhoto(merged, base);
    return NextResponse.json({ resume: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de l'adaptation.";
    let status = 502; // réponse IA inexploitable par défaut
    if (/Aucune clé API/i.test(message)) status = 400;
    else if (/Quota/i.test(message)) status = 429;
    return NextResponse.json({ error: message }, { status });
  }
}

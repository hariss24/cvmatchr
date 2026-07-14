import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_ATS_SCORE } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";
import type { Requirement, Priority } from "@/lib/ats/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { resume_text?: string; job_desc?: string; role?: string };

const str = (v: unknown, max = 400): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Ne garde que les exigences exploitables : un libellé court, un type connu. */
function coerceRequirements(value: unknown): Requirement[] {
  if (!Array.isArray(value)) return [];
  const out: Requirement[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const term = str(r.term, 80);
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push({
      term,
      kind: r.kind === "nice" ? "nice" : "hard",
      present: r.present === true,
      evidence: str(r.evidence, 300),
    });
    if (out.length >= 25) break;
  }
  return out;
}

function coercePriorities(value: unknown): Priority[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      title: str(p.title, 120),
      problem: str(p.problem),
      fix: str(p.fix),
      example: str(p.example, 600),
      zone: str(p.zone, 40),
    }))
    .filter((p) => p.title)
    .slice(0, 3);
}

/**
 * Analyse ATS assistée par IA. L'IA extrait les EXIGENCES de l'offre et dit lesquelles le CV
 * prouve ; elle ne calcule aucun score — c'est `lib/ats/engine.ts` qui s'en charge côté client,
 * pour un résultat reproductible (cf. `SYSTEM_ATS_SCORE`).
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const resumeText = (body.resume_text ?? "").trim();
  const jobDesc = (body.job_desc ?? "").trim();
  if (!resumeText || !jobDesc) {
    return NextResponse.json({ error: "CV et offre d'emploi requis." }, { status: 400 });
  }

  const userKey = req.headers.get("x-api-key")?.trim() || null;
  const role = (body.role ?? "").trim();
  const content =
    (role ? `Intitulé du poste visé : ${role}\n\n` : "") +
    `CV (texte) :\n${resumeText}\n\nOffre d'emploi :\n${jobDesc}`;

  try {
    const raw = await complete([{ role: "user", content }], SYSTEM_ATS_SCORE, userKey);
    const result = parseAiJson(raw);
    if (typeof result !== "object" || result === null) {
      throw new Error("Réponse IA invalide : objet JSON attendu.");
    }
    const r = result as Record<string, unknown>;
    const requirements = coerceRequirements(r.requirements);
    if (!requirements.length) {
      throw new Error("Réponse IA invalide : aucune exigence exploitable.");
    }
    return NextResponse.json({
      job_title: str(r.job_title, 120),
      requirements,
      priorities: coercePriorities(r.priorities),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

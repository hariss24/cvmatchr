import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_ATS_SCORE } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse, coerceSkillList } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { cv_html?: string; job_desc?: string };

/** Score ATS d'adéquation CV/offre. Port de `score_ats` (ai_engine.py). */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const cvHtml = (body.cv_html ?? "").trim();
  const jobDesc = (body.job_desc ?? "").trim();
  if (!cvHtml || !jobDesc) {
    return NextResponse.json({ error: "CV et offre d'emploi requis." }, { status: 400 });
  }

  const userKey = req.headers.get("x-api-key")?.trim() || null;
  const content = `CV (HTML) :\n${cvHtml}\n\nOffre d'emploi :\n${jobDesc}`;

  try {
    const raw = await complete([{ role: "user", content }], SYSTEM_ATS_SCORE, userKey);
    const result = parseAiJson(raw);
    if (typeof result !== "object" || result === null || !("score" in result)) {
      throw new Error("Réponse IA invalide : champ 'score' attendu.");
    }
    const r = result as Record<string, unknown>;
    const score = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0)));
    return NextResponse.json({
      score,
      matched_skills: coerceSkillList(r.matched_skills),
      missing_hard_skills: coerceSkillList(r.missing_hard_skills),
      missing_nice_to_have: coerceSkillList(r.missing_nice_to_have),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { streamCompletion, requireKey } from "@/lib/ai/clients";
import { tailorHtmlSystem, type TailorLevel } from "@/lib/ai/prompts";
import { sseFromGenerator } from "@/lib/ai/stream";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const LEVELS: readonly TailorLevel[] = ["peu", "adapte", "hyper", "sur-mesure"];

type Body = {
  html?: string;
  job_desc?: string;
  level?: string;
  is_master?: boolean;
};

/**
 * Adaptation HTML → HTML adapté (mode expert, streaming SSE). Port legacy de `/api/tailor`.
 * **Conservé** en plus de `/api/tailor-resume` (pipeline JSON). Le strip/restore des images
 * base64 (placeholders `[IMAGE_BASE64_n]`) est géré côté frontend (Phase 5).
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const html = (body.html ?? "").trim();
  const jobDesc = (body.job_desc ?? "").trim();
  if (!html || !jobDesc) {
    return NextResponse.json(
      { error: "Le HTML du CV et la description du poste sont requis." },
      { status: 400 },
    );
  }

  const level: TailorLevel = LEVELS.includes(body.level as TailorLevel)
    ? (body.level as TailorLevel)
    : "adapte";

  const userKey = req.headers.get("x-api-key")?.trim() || null;
  try {
    requireKey(userKey);
  } catch (err) {
    return aiErrorResponse(err);
  }

  const system = tailorHtmlSystem(level, Boolean(body.is_master));
  const prompt = `CV HTML :\n${html}\n\nOffre d'emploi :\n${jobDesc}`;
  return sseFromGenerator(streamCompletion(prompt, system, { apiKey: userKey }));
}

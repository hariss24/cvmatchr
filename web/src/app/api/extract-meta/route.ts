import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_EXTRACT_META } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Extrait { company, role } du texte d'une offre — préremplit la barre meta (nommage PDF). */
export async function POST(req: Request): Promise<Response> {
  let body: { job_desc?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const jobDesc = (body.job_desc ?? "").trim();
  if (!jobDesc) {
    return NextResponse.json({ error: "Offre d'emploi requise." }, { status: 400 });
  }

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete(
      [{ role: "user", content: `Offre d'emploi :\n${jobDesc}` }],
      SYSTEM_EXTRACT_META,
      userKey,
    );
    const result = parseAiJson(raw) as { company?: unknown; role?: unknown };
    return NextResponse.json({
      company: String(result?.company ?? "").trim(),
      role: String(result?.role ?? "").trim(),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

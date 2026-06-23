import { NextResponse } from "next/server";
import { streamCompletion, requireKey } from "@/lib/ai/clients";
import { SYSTEM_CV_IMPORT, SYSTEM_LETTRE_IMPORT } from "@/lib/ai/prompts";
import { sseFromGenerator } from "@/lib/ai/stream";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { text?: string; doc_type?: string };

/** Import texte → HTML (streaming SSE). Port de `/api/text-to-html`. */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Texte vide." }, { status: 400 });
  }

  const userKey = req.headers.get("x-api-key")?.trim() || null;
  // Échoue tôt (400) si aucune clé n'est disponible, plutôt qu'en cours de stream.
  try {
    requireKey(userKey);
  } catch (err) {
    return aiErrorResponse(err);
  }

  const system = body.doc_type === "Lettre" ? SYSTEM_LETTRE_IMPORT : SYSTEM_CV_IMPORT;
  return sseFromGenerator(streamCompletion(text, system, { apiKey: userKey }));
}

import { NextResponse } from "next/server";
import { streamCompletion } from "@/lib/ai/clients";
import { SYSTEM_TEXT_TO_RESUME } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse, readAiHeaders } from "@/lib/ai/http";
import { normalizeResume } from "@/lib/resume/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { text?: string };

/**
 * Extraction d'un CV (texte brut collé) vers le schéma JSON. Parallèle texte de
 * `pdf-to-resume/route.ts` : entrée = texte au lieu d'images. Réutilise streamCompletion
 * + SYSTEM_TEXT_TO_RESUME + parseAiJson + normalizeResume.
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 30_000);
  if (!text) {
    return NextResponse.json({ error: "Aucun texte reçu." }, { status: 400 });
  }

  const { key: userKey, model: userModel } = readAiHeaders(req);
  const prompt = "Voici le contenu texte du CV à structurer :\n\n" + text;

  try {
    let raw = "";
    for await (const chunk of streamCompletion(prompt, SYSTEM_TEXT_TO_RESUME, {
      apiKey: userKey,
      model: userModel,
    })) {
      raw += chunk;
    }
    const resume = normalizeResume(parseAiJson(raw));
    return NextResponse.json({ resume });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

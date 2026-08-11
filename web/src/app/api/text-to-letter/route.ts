import { NextResponse } from "next/server";
import { streamCompletion } from "@/lib/ai/clients";
import { SYSTEM_TEXT_TO_LETTER } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { guardAiRequest } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/http";
import { normalizeLetter } from "@/lib/resume/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { text?: string };

/**
 * Extraction d'une lettre de motivation (texte brut collé) vers le schéma JSON.
 * Remplaçant de text-to-html pour les lettres.
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

  const grant = await guardAiRequest(req, "text-to-letter");
  if (grant instanceof Response) return grant;
  const { key: userKey, model: userModel } = grant;
  const prompt = "Voici le contenu texte de la lettre à structurer :\n\n" + text;

  try {
    let raw = "";
    for await (const chunk of streamCompletion(prompt, SYSTEM_TEXT_TO_LETTER, {
      apiKey: userKey,
      model: userModel,
    })) {
      raw += chunk;
    }
    const letter = normalizeLetter(parseAiJson(raw));
    return NextResponse.json({ letter });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

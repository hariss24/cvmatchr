import { NextResponse } from "next/server";
import { streamCompletion } from "@/lib/ai/clients";
import { SYSTEM_PDF_TO_RESUME } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse, readAiHeaders } from "@/lib/ai/http";
import { normalizeResume } from "@/lib/resume/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAGES = 10;

type Body = { images?: string[] };

/** Retire le préfixe data: éventuel et décode une image base64 en octets. */
function decodeImage(b64: string): Uint8Array {
  const data = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  return new Uint8Array(Buffer.from(data, "base64"));
}

/**
 * Extraction d'un CV (pages PDF rendues en images PNG) vers le schéma JSON. Port de
 * `pdf_to_resume` (ai_engine.py). Le rendu PDF → PNG est fait côté frontend (Phase 5, pdf.js) :
 * la route reçoit les images déjà rendues, en base64.
 *
 * ⚠️ Images ⇒ clé Gemini obligatoire (la garde Anthropic+images lève sinon).
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length === 0) {
    return NextResponse.json({ error: "Aucune image de page reçue." }, { status: 400 });
  }
  if (images.length > MAX_PAGES) {
    return NextResponse.json(
      { error: `Trop de pages (max ${MAX_PAGES}).` },
      { status: 413 },
    );
  }

  let decoded: Uint8Array[];
  try {
    decoded = images.map(decodeImage);
  } catch {
    return NextResponse.json({ error: "Images illisibles." }, { status: 400 });
  }

  const { key: userKey, model: userModel } = readAiHeaders(req);
  const n = decoded.length;
  const prompt =
    `Voici le CV en ${n} page${n > 1 ? "s" : ""}. ` +
    "Extrais toutes les informations dans le schéma JSON demandé.";

  try {
    let raw = "";
    for await (const chunk of streamCompletion(prompt, SYSTEM_PDF_TO_RESUME, {
      images: decoded,
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

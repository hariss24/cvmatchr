import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_ADAPT_LETTER } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  letter_body?: string;
  job_desc?: string;
  cv_json?: unknown;
  company?: string;
  role?: string;
};

/** Adapte légèrement le corps du modèle de lettre de l'utilisateur à une offre. */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const letterBody = (body.letter_body ?? "").trim();
  const jobDesc = (body.job_desc ?? "").trim();
  if (!letterBody || !jobDesc) {
    return NextResponse.json({ error: "Modèle de lettre et offre d'emploi requis." }, { status: 400 });
  }

  let content = `Corps de la lettre (modèle du candidat) :\n${letterBody}`;
  content += `\n\nOffre d'emploi :\n${jobDesc}`;
  content += `\n\nCV (JSON) :\n${JSON.stringify(body.cv_json ?? {})}`;
  if (body.company?.trim()) content += `\n\nEntreprise visée : ${body.company.trim()}`;
  if (body.role?.trim()) content += `\n\nPoste visé : ${body.role.trim()}`;

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete([{ role: "user", content }], SYSTEM_ADAPT_LETTER, userKey);
    const result = parseAiJson(raw) as { body?: unknown };
    const adapted = String(result?.body ?? "").trim();
    if (!adapted) throw new Error("Réponse IA invalide : champ 'body' attendu.");
    return NextResponse.json({ body: adapted });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_PACK } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  cv_html?: string;
  cv_css?: string;
  job_desc?: string;
  company?: string;
  role?: string;
  /** Date du jour formatée côté client (fuseau de l'utilisateur) — pour dater la lettre. */
  today?: string;
};

/** Pack candidature (lettre + email) cohérent avec le CV. Port de `generate_pack`. */
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

  let content = `CV (HTML) :\n${cvHtml}`;
  if (body.cv_css?.trim()) content += `\n\nCV (CSS) :\n${body.cv_css.trim()}`;
  content += `\n\nOffre d'emploi :\n${jobDesc}`;
  if (body.company?.trim()) content += `\n\nEntreprise visée : ${body.company.trim()}`;
  if (body.role?.trim()) content += `\n\nPoste visé : ${body.role.trim()}`;
  const today =
    body.today?.trim() ||
    new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  content += `\n\nDate du jour (à utiliser pour dater la lettre) : ${today}`;

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete([{ role: "user", content }], SYSTEM_PACK, userKey);
    const result = parseAiJson(raw);
    if (
      typeof result !== "object" ||
      result === null ||
      !("letter_html" in result) ||
      !("email" in result)
    ) {
      throw new Error("Réponse IA invalide : champs 'letter_html' et 'email' attendus.");
    }
    const r = result as Record<string, unknown>;
    return NextResponse.json({
      letter_html: String(r.letter_html ?? "").trim(),
      letter_css: String(r.letter_css ?? "").trim(),
      email: String(r.email ?? "").trim(),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

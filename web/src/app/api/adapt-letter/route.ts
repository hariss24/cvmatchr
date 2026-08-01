import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { adaptLetterSystem } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse, readAiHeaders } from "@/lib/ai/http";
import { findLetterPlaceholder, isLetterSkeleton } from "@/lib/ai/letterPlaceholders";
import { parseLetterTone } from "@/lib/letter/tone";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  letter_body?: string;
  job_desc?: string;
  cv_json?: unknown;
  company?: string;
  role?: string;
  tone?: string;
};

async function askForBody(
  content: string,
  system: string,
  userKey: string | null,
  userModel: string | null,
): Promise<string> {
  const raw = await complete([{ role: "user", content }], system, userKey, userModel);
  const result = parseAiJson(raw) as { body?: unknown };
  const adapted = String(result?.body ?? "").trim();
  if (!adapted) throw new Error("Réponse IA invalide : champ 'body' attendu.");
  return adapted;
}

/** Adapte légèrement le corps du modèle de lettre de l'utilisateur à une offre. */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const letterBody = (body.letter_body ?? "").trim().slice(0, 30_000);
  const jobDesc = (body.job_desc ?? "").trim().slice(0, 30_000);
  if (!letterBody || !jobDesc) {
    return NextResponse.json({ error: "Modèle de lettre et offre d'emploi requis." }, { status: 400 });
  }

  let content = `Corps de la lettre (modèle du candidat) :\n${letterBody}`;
  content += `\n\nOffre d'emploi :\n${jobDesc}`;
  content += `\n\nCV (JSON) :\n${JSON.stringify(body.cv_json ?? {})}`;
  if (body.company?.trim()) content += `\n\nEntreprise visée : ${body.company.trim()}`;
  if (body.role?.trim()) content += `\n\nPoste visé : ${body.role.trim()}`;

  const { key: userKey, model: userModel } = readAiHeaders(req);

  // Un corps encore fait de consignes entre crochets n'a pas de voix à conserver : l'IA
  // rédige au lieu d'adapter, sinon elle décalque le ton scolaire du squelette d'usine.
  const system = adaptLetterSystem(
    parseLetterTone(body.tone),
    isLetterSkeleton(letterBody) ? "redige" : "adapte",
  );

  try {
    let adapted = await askForBody(content, system, userKey, userModel);

    // Garde-fou : une lettre à trous part telle quelle au recruteur. Le prompt l'interdit,
    // on vérifie quand même — une seule relance, en pointant le trou au modèle.
    const hole = findLetterPlaceholder(adapted);
    if (hole) {
      const retry =
        `${content}\n\nTa réponse précédente contenait un emplacement à compléter : « ${hole} ». ` +
        "Recommence. Écris le fait réel lu dans le CV, ou supprime la phrase.";
      adapted = await askForBody(retry, system, userKey, userModel);
      const still = findLetterPlaceholder(adapted);
      if (still) {
        throw new Error(
          `L'IA a laissé un passage à compléter (« ${still} ») : lettre conservée. Réessaie, ou complète ton CV.`,
        );
      }
    }

    return NextResponse.json({ body: adapted });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

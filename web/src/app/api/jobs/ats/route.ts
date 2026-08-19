import { NextResponse } from "next/server";
import { resolveAts, type AtsProvider } from "@/lib/jobs/ats";
import { enforceRateLimit } from "@/lib/security/rateLimit";

// Appels réseau sortants vers les boards publics : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Au-delà, c'est une liste de scan entière : on tronque plutôt que tout résoudre. */
const MAX_ENTREPRISES = 60;

/**
 * Détection de l'ATS d'un lot d'entreprises.
 *
 * Côté serveur, et pas dans le navigateur : les endpoints Greenhouse et Lever
 * sont publics mais leur en-tête CORS ne nous appartient pas. Même raison, même
 * patron que `/api/jobs/logos`.
 *
 * Réponse : `{ ats: { "<raison sociale>": { ats, slug } } }`, les entreprises
 * sans board confirmé étant simplement absentes.
 */
export async function POST(req: Request): Promise<Response> {
  const limite = await enforceRateLimit(req, "jobs-ats");
  if (limite) return limite;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const brut = (body as { companies?: unknown })?.companies;
  if (!Array.isArray(brut)) {
    return NextResponse.json({ error: "Champ 'companies' attendu." }, { status: 400 });
  }

  const companies = [
    ...new Set(brut.filter((c): c is string => typeof c === "string" && c.trim() !== "")),
  ].slice(0, MAX_ENTREPRISES);

  const resolus = await Promise.all(
    companies.map(async (nom) => [nom, await resolveAts(nom)] as const),
  );

  const ats: Record<string, { ats: AtsProvider; slug: string }> = {};
  for (const [nom, match] of resolus) {
    if (match.ats !== "none") ats[nom] = { ats: match.ats, slug: match.slug };
  }

  return NextResponse.json({ ats });
}

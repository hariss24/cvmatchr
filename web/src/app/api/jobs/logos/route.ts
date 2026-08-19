import { NextResponse } from "next/server";
import { logoUrlsFor } from "@/lib/jobs/logos";
import { enforceRateLimit } from "@/lib/security/rateLimit";

// Appels réseau sortants (annuaire de marques, pages d'accueil) : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Au-delà, c'est une liste de scan entière : on tronque plutôt que de tout résoudre. */
const MAX_ENTREPRISES = 120;

/**
 * Logos d'entreprise, résolus à part de la recherche.
 *
 * Retrouver un logo demande de visiter des pages d'accueil : ~9 s pour une
 * cinquantaine d'entreprises inconnues. Tant que cette étape vivait dans
 * `/api/jobs/search`, elle retardait l'affichage de toutes les offres pour un
 * ornement. Elle est donc appelée après coup, une fois les offres à l'écran.
 *
 * L'effet de bord est le vrai gain : cette route ignore d'où viennent les
 * entreprises. Le client peut donc réclamer les logos d'offres **déjà en base**,
 * que le scan écarte par dédoublonnage et qui restaient sans logo à jamais.
 *
 * Réponse : `{ logos: { "<raison sociale>": "<url>" } }`, les entreprises sans
 * logo confirmé étant simplement absentes.
 */
export async function POST(req: Request): Promise<Response> {
  const limite = await enforceRateLimit(req, "jobs-logos");
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

  const logos = await logoUrlsFor(companies, process.env.BRANDFETCH_CLIENT_ID);
  return NextResponse.json({ logos });
}

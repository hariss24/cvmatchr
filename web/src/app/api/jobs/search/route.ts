import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/jobs/resolveProfile";
import { search as searchFT } from "@/lib/jobs/francetravail";
import { matchesIncludeKeywords } from "@/lib/jobs/includeFilter";

// France Travail (fetch + OAuth) : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Recherche les offres pour le profil courant : jeton FT, une requête par mot-clé, filtre
 * stages/alternances, dédoublonnage par id, description tronquée. Réponse `{ offers }`.
 * Clés France Travail absentes → 400 `{ error: "config" }` (l'onglet affiche l'invite de config).
 */
export async function POST(req: Request): Promise<Response> {
  const clientId = process.env.FT_CLIENT_ID;
  const clientSecret = process.env.FT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "config", message: "Configurez FT_CLIENT_ID et FT_CLIENT_SECRET pour rechercher des offres." },
      { status: 400 },
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // corps vide/invalide toléré → profil neutre
  }
  const profile = resolveProfile(body);

  try {
    if (profile.keywords.length === 0) {
      return NextResponse.json({ offers: [] });
    }

    const creds = { clientId, clientSecret };
    const rawOffers = await searchFT(profile, creds);
    
    // Le filtre sur les mots-clés (includeKeywords) se fait post-unification
    const offers = rawOffers.filter(o => matchesIncludeKeywords(o, profile.includeKeywords));
    
    return NextResponse.json({ offers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ offers: [] });
  }
}

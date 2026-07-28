import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/jobs/resolveProfile";
import { search as searchFranceTravail } from "@/lib/jobs/francetravail";
import { searchAdzuna } from "@/lib/jobs/adzuna";
import { searchJSearch } from "@/lib/jobs/jsearch";
import { dedupeOffers } from "@/lib/jobs/dedupe";
import { matchesIncludeKeywords } from "@/lib/jobs/includeFilter";
import { withCompanyLogos } from "@/lib/jobs/logos";
import type { JobOffer, SourceId } from "@/lib/jobs/offer";

// Appels réseau sortants : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

const ZERO_CALLS: Record<SourceId, number> = { francetravail: 0, adzuna: 0, jsearch: 0 };

/**
 * Recherche les offres pour le profil courant, sur les seules sources activées.
 *
 * Les sources sont interrogées en parallèle : une panne de l'une n'empêche pas
 * les autres de répondre (elle est signalée dans `failed`). Les résultats sont
 * fusionnés, dédoublonnés inter-source, puis filtrés par `includeKeywords`.
 *
 * Réponse : `{ offers, calls, failed }`. `calls` alimente le compteur de quota
 * local côté client.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // corps vide/invalide toléré → profil neutre
  }
  const profile = resolveProfile(body);

  if (profile.keywords.length === 0) {
    return NextResponse.json({ offers: [], calls: ZERO_CALLS, failed: [] });
  }

  const ftId = process.env.FT_CLIENT_ID;
  const ftSecret = process.env.FT_CLIENT_SECRET;
  const adzId = process.env.ADZUNA_APP_ID;
  const adzKey = process.env.ADZUNA_APP_KEY;
  const jsKey = process.env.JSEARCH_API_KEY;

  // Chaque source activée doit avoir ses clés : mieux vaut le dire tout de suite
  // que de renvoyer une liste amputée sans explication.
  const missing: string[] = [];
  if (profile.sources.francetravail && !(ftId && ftSecret)) missing.push("FT_CLIENT_ID / FT_CLIENT_SECRET");
  if (profile.sources.adzuna && !(adzId && adzKey)) missing.push("ADZUNA_APP_ID / ADZUNA_APP_KEY");
  if (profile.sources.jsearch && !jsKey) missing.push("JSEARCH_API_KEY");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "config", message: `Clés manquantes pour les sources activées : ${missing.join(", ")}.` },
      { status: 400 },
    );
  }

  const enabled = (Object.keys(profile.sources) as SourceId[]).filter((s) => profile.sources[s]);
  if (enabled.length === 0) {
    return NextResponse.json(
      { error: "config", message: "Aucune source sélectionnée. Coche au moins une source dans « Où chercher »." },
      { status: 400 },
    );
  }

  const runners: Record<SourceId, () => Promise<{ offers: JobOffer[]; calls: number }>> = {
    francetravail: () => searchFranceTravail(profile, { clientId: ftId!, clientSecret: ftSecret! }),
    adzuna: () => searchAdzuna(profile, { appId: adzId!, appKey: adzKey! }),
    jsearch: () => searchJSearch(profile, { apiKey: jsKey! }),
  };

  // `allSettled` : une source qui jette ne doit pas emporter les autres.
  const settled = await Promise.allSettled(enabled.map((s) => runners[s]()));

  const calls = { ...ZERO_CALLS };
  const failed: SourceId[] = [];
  let merged: JobOffer[] = [];

  settled.forEach((r, i) => {
    const source = enabled[i];
    if (r.status === "fulfilled") {
      calls[source] = r.value.calls;
      merged = merged.concat(r.value.offers);
    } else {
      failed.push(source);
      console.warn(`Source ${source} en échec :`, r.reason);
    }
  });

  const retenues = dedupeOffers(merged).filter((o) => matchesIncludeKeywords(o, profile.includeKeywords));

  // Après le dédoublonnage : une offre présente sur deux sources a pu récupérer
  // le logo de l'autre, inutile d'aller le chercher. Sans clé Brandfetch, cette
  // étape est sautée et les cartes retombent sur l'initiale.
  const offers = await withCompanyLogos(retenues, process.env.BRANDFETCH_CLIENT_ID);

  return NextResponse.json({ offers, calls, failed });
}

import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/jobs/resolveProfile";
import { getCommuteTimes, commuteSummary } from "@/lib/jobs/maps";
import { scoreOffer } from "@/lib/jobs/score";
import { aiErrorResponse } from "@/lib/ai/http";
import type { RawOffer } from "@/lib/jobs/francetravail";

// Google Maps (fetch) + Gemini : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Note UNE offre : temps de trajet (Google Maps) + score IA (Gemini, profil courant).
 * Réponse `{ score, breakdown, commute, commuteText }`.
 * - clé Maps absente → 400 `{ error: "config" }` ;
 * - quota Gemini → 429 (via `aiErrorResponse`) pour que le client arrête proprement ;
 * - clé Gemini serveur absente → 400.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { offer?: RawOffer };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const offer = body.offer;
  if (!offer || typeof offer !== "object") {
    return NextResponse.json({ error: "Offre manquante." }, { status: 400 });
  }

  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!mapsKey) {
    return NextResponse.json(
      { error: "config", message: "Configurez GOOGLE_MAPS_API_KEY pour calculer les trajets." },
      { status: 400 },
    );
  }

  const profile = resolveProfile(req);

  try {
    const commute = await getCommuteTimes(offer, profile, mapsKey);
    const breakdown = await scoreOffer(offer, commute, profile); // clé Gemini serveur (env)
    return NextResponse.json({
      score: breakdown.total_score,
      breakdown,
      commute,
      commuteText: commuteSummary(commute),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

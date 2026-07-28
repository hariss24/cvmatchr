import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/jobs/resolveProfile";
import { getCommuteTimes, commuteSummary } from "@/lib/jobs/maps";

// Google Maps (fetch) : runtime Node.js.
export const runtime = "nodejs";

/**
 * Temps de trajet d'UNE offre, à la demande.
 *
 * Appelée à l'ouverture d'une offre, jamais pendant le scan : le scan en
 * émettait 354 par passage, soit jusqu'à 162 $/mois et 30 à 45 s de latence
 * (spec §2.7). Le client met le résultat en cache 30 jours.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { destination?: string; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    return NextResponse.json({ error: "Destination manquante." }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "config", message: "Configurez GOOGLE_MAPS_API_KEY pour calculer les trajets." },
      { status: 400 },
    );
  }

  const profile = resolveProfile(body);
  const commute = await getCommuteTimes(destination, profile, key);
  return NextResponse.json({ commuteText: commuteSummary(commute) });
}

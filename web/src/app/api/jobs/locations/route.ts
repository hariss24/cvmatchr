import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

type Result = { kind: "commune" | "departement" | "region"; code: string; label: string };

interface GeoCommune { nom: string; code: string; codesPostaux?: string[] }
interface GeoRegion { nom: string; code: string }

const COMMUNES_URL = "https://geo.api.gouv.fr/communes";
const REGIONS_URL = "https://geo.api.gouv.fr/regions";

/*
 * Paris, Lyon et Marseille étaient converties en département : leur code INSEE
 * agrégé était rejeté par France Travail (« commune incorrecte », 400), ce qui
 * renvoyait 0 offre. L'API les accepte désormais — vérifié le 26/07/2026 sur les
 * trois codes, avec des rayons croissants (Paris 75056 : 7 offres à 0 km, 12 à
 * 10 km, 14 à 30 km). La conversion est retirée : elle privait ces villes du
 * rayon, seul moyen d'inclure la proche banlieue, et ramenait moins d'offres que
 * la commune élargie. À noter : ces trois codes renvoient 0 offre à rayon 0 pour
 * Lyon et Marseille, d'où le défaut de 10 km côté formulaire.
 */

async function fetchJson<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

/**
 * Autocomplétion de lieu (proxy geo.api.gouv.fr, sans auth). Renvoie des codes INSEE
 * compatibles France Travail : communes (avec code postal principal) + régions.
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Après le filtre : une frappe trop courte ne coûte rien, elle ne doit donc
  // pas entamer le quota de l'utilisateur qui tape lettre par lettre.
  const limite = await enforceRateLimit(req, "jobs-locations");
  if (limite) return limite;

  const [communes, regions] = await Promise.all([
    fetchJson<GeoCommune>(`${COMMUNES_URL}?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux&boost=population&limit=8`),
    fetchJson<GeoRegion>(`${REGIONS_URL}?nom=${encodeURIComponent(q)}`),
  ]);

  const results: Result[] = [
    ...communes.map((c) => ({
      kind: "commune" as const,
      code: c.code,
      label: c.codesPostaux?.[0] ? `${c.nom} (${c.codesPostaux[0]})` : c.nom,
    })),
    ...regions.map((r) => ({ kind: "region" as const, code: r.code, label: r.nom })),
  ];

  return NextResponse.json({ results });
}

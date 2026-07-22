import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Result = { kind: "commune" | "departement" | "region"; code: string; label: string };

interface GeoCommune { nom: string; code: string; codesPostaux?: string[] }
interface GeoRegion { nom: string; code: string }

const COMMUNES_URL = "https://geo.api.gouv.fr/communes";
const REGIONS_URL = "https://geo.api.gouv.fr/regions";

/**
 * Paris, Lyon et Marseille sont subdivisées en arrondissements : France Travail
 * rejette leur code INSEE agrégé (« commune incorrecte », 400). On les cherche
 * donc par département, qui couvre toute la ville. Sans ça, choisir « Paris »
 * renvoie 0 offre.
 */
const CITY_TO_DEPARTEMENT: Record<string, string> = {
  "75056": "75", // Paris → dép. 75
  "13055": "13", // Marseille → dép. 13 (Bouches-du-Rhône)
  "69123": "69", // Lyon → dép. 69 (Rhône)
};

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

  const [communes, regions] = await Promise.all([
    fetchJson<GeoCommune>(`${COMMUNES_URL}?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux&boost=population&limit=8`),
    fetchJson<GeoRegion>(`${REGIONS_URL}?nom=${encodeURIComponent(q)}`),
  ]);

  const results: Result[] = [
    ...communes.map((c) => {
      const label = c.codesPostaux?.[0] ? `${c.nom} (${c.codesPostaux[0]})` : c.nom;
      const dep = CITY_TO_DEPARTEMENT[c.code];
      return dep
        ? { kind: "departement" as const, code: dep, label }
        : { kind: "commune" as const, code: c.code, label };
    }),
    ...regions.map((r) => ({ kind: "region" as const, code: r.code, label: r.nom })),
  ];

  return NextResponse.json({ results });
}

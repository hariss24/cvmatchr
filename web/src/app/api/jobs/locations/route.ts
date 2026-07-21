import { NextResponse } from "next/server";
import { getToken } from "@/lib/jobs/francetravail";

export const runtime = "nodejs";

const API_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/referentiel/communes";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json([]);

  const clientId = process.env.FT_CLIENT_ID;
  const clientSecret = process.env.FT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json([]);

  try {
    const token = await getToken(clientId, clientSecret);
    const res = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) return NextResponse.json([]);
    const data = (await res.json()) as { code: string; libelle: string; codeDepartement: string }[];
    
    // L'API référentiel FT télécharge la liste complète des communes,
    // on doit donc faire le filtrage nous-mêmes.
    const term = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matches = data.filter((c) =>
      c.libelle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term)
    );
    
    const results = matches.slice(0, 20).map((c) => ({
      kind: "commune",
      code: c.code,
      label: `${c.libelle} (${c.codeDepartement})`,
    }));
    return NextResponse.json(results);
  } catch (_err) {
    return NextResponse.json([]);
  }
}

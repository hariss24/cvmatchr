import { NextResponse } from "next/server";
import { scrapeJobText } from "@/lib/scraper/scraper";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.url) {
      return NextResponse.json({ error: "URL manquante." }, { status: 400 });
    }

    const { text, title } = await scrapeJobText(body.url);
    
    return NextResponse.json({ text, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erreur scrapeJobText:", message);
    // On masque les erreurs SSRF internes ("URL non autorisée.") par sécurité,
    // mais on laisse le fallback/blocage explicite pour l'utilisateur.
    if (message === "URL non autorisée.") {
      return NextResponse.json({ error: "L'accès à cette URL est interdit par mesure de sécurité." }, { status: 403 });
    }
    return NextResponse.json(
      { error: message || "Erreur interne lors de l'extraction." },
      { status: 500 }
    );
  }
}

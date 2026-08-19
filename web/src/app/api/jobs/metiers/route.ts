import { NextResponse } from "next/server";
import appellations from "@/lib/jobs/data/rome-appellations.json";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

/**
 * Autocomplétion des postes sur le référentiel officiel des appellations ROME
 * (France Travail, ~11 000 intitulés + code ROME). Jeu de données embarqué côté
 * serveur (Open Licence / Etalab, dérivé de data.gouv.fr) → aucune clé requise.
 */
type Appellation = { l: string; r: string };
const DATA = appellations as Appellation[];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Après le filtre : une frappe trop courte ne coûte rien, elle ne doit donc
  // pas entamer le quota de l'utilisateur qui tape lettre par lettre.
  const limite = await enforceRateLimit(req, "jobs-metiers");
  if (limite) return limite;

  // Recherche par tokens : tous les mots doivent apparaître (pas forcément contigus),
  // car les appellations ROME ont la forme « Chargé / Chargée de … ».
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  const scored: { label: string; rome: string; rank: number; posSum: number }[] = [];
  for (const a of DATA) {
    const n = norm(a.l);
    let ok = true;
    let posSum = 0;
    for (const t of tokens) {
      const i = n.indexOf(t);
      if (i === -1) {
        ok = false;
        break;
      }
      posSum += i;
    }
    if (!ok) continue;
    // Priorité : l'intitulé commence par le premier mot.
    const rank = n.startsWith(tokens[0]) ? 0 : 1;
    scored.push({ label: a.l, rome: a.r, rank, posSum });
  }
  scored.sort((a, b) => a.rank - b.rank || a.posSum - b.posSum || a.label.localeCompare(b.label, "fr"));

  const results = scored.slice(0, 10).map(({ label, rome }) => ({ label, rome }));
  return NextResponse.json({ results });
}

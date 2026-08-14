import { NextResponse } from "next/server";
import { testConnection } from "@/lib/ai/clients";

export const runtime = "nodejs";
export const maxDuration = 20;

type Body = { model?: string; key?: string };

/**
 * Vérifie qu'un modèle + une clé API (typés à l'instant dans ⚙️ Paramètres, pas forcément
 * enregistrés) répondent réellement — bouton "Tester la connexion". Teste toujours la clé
 * fournie par l'appelant : jamais de repli sur la clé serveur (route non authentifiée,
 * un repli permettrait à n'importe quel visiteur de consommer la clé Gemini du serveur
 * sans passer par le quota).
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide." }, { status: 400 });
  }

  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json({ ok: false, error: "Modèle manquant." }, { status: 400 });
  }

  const provider = model.startsWith("claude-") ? "anthropic" : "gemini";

  const key = (body.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "Clé API requise pour ce modèle." }, { status: 400 });
  }

  try {
    await testConnection(provider, model, key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec du test de connexion.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

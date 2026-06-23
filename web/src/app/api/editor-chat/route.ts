import { NextResponse } from "next/server";
import { complete, type ChatMessage } from "@/lib/ai/clients";
import { SYSTEM_EDITOR_CHAT } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages?: ChatMessage[];
  html?: string;
  css?: string;
  doc_type?: string;
  job_desc?: string;
};

type Proposal = { id: string; title: string; summary: string; html: string; css: string };

/** Chat éditeur : réponse {reply, proposals}. Port de `complete_chat` (ai_engine.py). */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "Message manquant." }, { status: 400 });
  }

  const html = body.html ?? "";
  const css = body.css ?? "";
  const docType = body.doc_type ?? "CV";

  let context = `Document actuel (${docType}) :\n\nHTML :\n${html}`;
  if (css) context += `\n\nCSS :\n${css}`;
  if (body.job_desc) context += `\n\nOffre d'emploi cible :\n${body.job_desc}`;

  // Contexte injecté en tête comme premier échange user/assistant (port fidèle).
  const augmented: ChatMessage[] = [
    { role: "user", content: context },
    { role: "assistant", content: "Contexte reçu. Que souhaitez-vous modifier ?" },
    ...messages,
  ];

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete(augmented, SYSTEM_EDITOR_CHAT, userKey);
    const result = parseAiJson(raw);
    if (
      typeof result !== "object" ||
      result === null ||
      !("reply" in result) ||
      !("proposals" in result)
    ) {
      throw new Error("Réponse IA invalide : champs 'reply' et 'proposals' attendus.");
    }
    const r = result as Record<string, unknown>;

    const proposals: Proposal[] = [];
    for (const item of Array.isArray(r.proposals) ? r.proposals : []) {
      if (typeof item !== "object" || item === null) continue;
      const p = item as Record<string, unknown>;
      const pHtml = String(p.html ?? "").trim();
      const pCss = String(p.css ?? "").trim();
      // Ignore les propositions identiques au document courant.
      if (pHtml === html.trim() && pCss === css.trim()) continue;
      proposals.push({
        id: String(p.id ?? `p${proposals.length + 1}`),
        title: String(p.title ?? "Proposition").slice(0, 100),
        summary: String(p.summary ?? "").slice(0, 500),
        html: pHtml,
        css: pCss,
      });
    }

    return NextResponse.json({
      reply: String(r.reply ?? "").slice(0, 1000),
      proposals,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

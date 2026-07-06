import { NextResponse } from "next/server";
import { complete, type ChatMessage } from "@/lib/ai/clients";
import { SYSTEM_EDITOR_CHAT } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";
import { normalizeResume, normalizeLetter, isEmptyResume, isEmptyLetter } from "@/lib/resume/normalize";
import type { DocData } from "@/state/docStore";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages?: ChatMessage[];
  doc_json?: DocData;
  doc_type?: string;
  job_desc?: string;
};

type Proposal = { id: string; title: string; summary: string; json: DocData };

/** Chat éditeur : réponse {reply, proposals}. Port de `complete_chat` adapté au JSON. */
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

  const currentDoc = body.doc_json;
  const docJson = currentDoc ? JSON.stringify(currentDoc, null, 2) : "{}";
  const docType = body.doc_type ?? "CV";
  const isLetter = docType === "Lettre";

  let context = `Document actuel (${docType}) :\n\nJSON :\n${docJson}`;
  if (body.job_desc) context += `\n\nOffre d'emploi cible :\n${body.job_desc}`;

  // Contexte injecté en tête comme premier échange user/assistant.
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

    const currentStr = currentDoc ? JSON.stringify(currentDoc) : null;
    const proposals: Proposal[] = [];
    for (const item of Array.isArray(r.proposals) ? r.proposals : []) {
      if (typeof item !== "object" || item === null) continue;
      const p = item as Record<string, unknown>;
      if (!p.json) continue;

      // Garde anti-vidage : rejette une proposition vide ou strictement identique au doc courant.
      const normalizedLetter = isLetter ? normalizeLetter(p.json) : null;
      const normalizedResume = isLetter ? null : normalizeResume(p.json);
      if (normalizedLetter ? isEmptyLetter(normalizedLetter) : isEmptyResume(normalizedResume!)) continue;
      const normalized: DocData = normalizedLetter ?? normalizedResume!;
      if (currentStr && JSON.stringify(normalized) === currentStr) continue;

      proposals.push({
        id: String(p.id ?? `p${proposals.length + 1}`),
        title: String(p.title ?? "Proposition").slice(0, 100),
        summary: String(p.summary ?? "").slice(0, 500),
        json: normalized,
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

import { NextResponse } from "next/server";
import { mergeHtml } from "@/lib/resume/mergeHtml";
import { applyAtsBoost } from "@/lib/ats/score";
import { htmlToPdf, type PageFormat, type Margin } from "@/lib/pdf/render";

// Chromium a besoin du runtime Node.js (pas Edge).
export const runtime = "nodejs";
export const maxDuration = 60;

// Garde-fou : refuse les documents démesurés (le rendu Chromium est coûteux).
const MAX_HTML_BYTES = 2_000_000; // ~2 Mo

type ConvertBody = {
  html?: string;
  css?: string;
  format?: PageFormat;
  margin?: Margin;
  background?: boolean;
  filename?: string;
  boostKeywords?: string[];
};

/** Nettoie un nom de fichier pour l'en-tête Content-Disposition. */
function safeFilename(name: string | undefined): string {
  const base = (name ?? "document").replace(/[^\w.\- ]+/g, "_").trim() || "document";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export async function POST(req: Request): Promise<Response> {
  let body: ConvertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const html = body.html ?? "";
  if (!html.trim()) {
    return NextResponse.json({ error: "HTML manquant." }, { status: 400 });
  }

  const boostKeywords = Array.isArray(body.boostKeywords) ? body.boostKeywords : [];
  const merged = applyAtsBoost(mergeHtml(html, body.css ?? ""), boostKeywords);
  if (Buffer.byteLength(merged, "utf8") > MAX_HTML_BYTES) {
    return NextResponse.json({ error: "Document trop volumineux." }, { status: 413 });
  }

  try {
    const pdf = await htmlToPdf(merged, {
      format: body.format,
      margin: body.margin,
      background: body.background,
    });
    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename(body.filename)}"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de la conversion PDF.";
    // Format/marge hors whitelist → 400 ; le reste → 500.
    const status = /non support/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

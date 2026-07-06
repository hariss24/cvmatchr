"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocStore, docEngine } from "@/state/docStore";
import { mergeHtml } from "@/lib/resume/mergeHtml";
import { applyAtsBoost } from "@/lib/ats/score";
import { generateResumePdfBlob } from "@/lib/pdfgen/generatePdf";
import type { Resume, Letter } from "@/lib/resume/schema";
import { renderResume, renderLetter } from "@/lib/resume/render";
import PdfPreview from "./PdfPreview";

// A4 à 96 dpi ≈ 1122px (297mm × 96 / 25.4). Port de updatePageCount (app.js, l.712).
const A4_H = 1122;

/**
 * Aperçu live, deux moteurs :
 * - **react-pdf** (`docEngine === "pdf"`, template Graphique) : le JSON est dessiné en vrai
 *   PDF dans le navigateur (debounce + garde d'obsolescence) et affiché via PDF.js
 *   (`PdfPreview`). Compteur de pages **exact** (numPages). Une proposition du chat
 *   (`previewOverride`, HTML) repasse sur l'iframe.
 * - **HTML** (autres templates, Lettre, mode expert) : fusion html+css dans une iframe
 *   sandbox `srcDoc`, pages estimées par la hauteur (comportement historique, inchangé).
 */
export default function PreviewPane() {
  const html = useDocStore((s) => s.html);
  const css = useDocStore((s) => s.css);
  const json = useDocStore((s) => s.json);
  const docType = useDocStore((s) => s.docType);
  const templateId = useDocStore((s) => s.templateId);
  const htmlSource = useDocStore((s) => s.htmlSource);
  const previewOverride = useDocStore((s) => s.previewOverride);
  const atsBoost = useDocStore((s) => s.atsBoost);

  const [srcDoc, setSrcDoc] = useState("");
  const [pages, setPages] = useState(1);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const genRef = useRef(0);

  const isPreview = previewOverride !== null;
  const currentHtmlSource = isPreview ? false : htmlSource;
  const usePdf = docEngine({ docType, templateId, htmlSource: currentHtmlSource }) === "pdf";

  // Sortie du mode pdf : purge du blob pendant le rendu (pattern « derived state reset »,
  // pas de setState dans un effet) — au retour, on repart du loader, jamais d'un blob périmé.
  const [prevUsePdf, setPrevUsePdf] = useState(usePdf);
  if (prevUsePdf !== usePdf) {
    setPrevUsePdf(usePdf);
    if (!usePdf) setPdfBlob(null);
  }

  // Moteur react-pdf : régénère le blob (debounce), un résultat périmé est jeté.
  useEffect(() => {
    if (!usePdf) {
      genRef.current++; // invalide toute génération encore en vol
      return;
    }
    const gen = ++genRef.current;
    const id = setTimeout(async () => {
      try {
        const jsonToRender = isPreview ? previewOverride : json;
        const blob = await generateResumePdfBlob(
          jsonToRender as Resume,
          templateId as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId,
          atsBoost.enabled ? atsBoost.keywords : [],
        );
        if (genRef.current === gen) setPdfBlob(blob);
      } catch {
        // Rendu impossible (données transitoires) : on conserve l'aperçu précédent.
      }
    }, 500);
    return () => clearTimeout(id);
  }, [usePdf, json, previewOverride, isPreview, atsBoost]);

  // Moteur HTML : debounce de la fusion html/css (port de schedulePreview).
  // Une proposition du chat IA (previewOverride) court-circuite l'aperçu live, sans debounce.
  useEffect(() => {
    if (usePdf) return;
    const boostKw = atsBoost.enabled ? atsBoost.keywords : [];
    const htmlToMerge = isPreview
      ? (docType === "Lettre" ? renderLetter(previewOverride as Letter) : renderResume(previewOverride as Resume))
      : html;
    const value = applyAtsBoost(mergeHtml(htmlToMerge, css), boostKw);
    const delay = isPreview ? 0 : 150;
    const id = setTimeout(() => setSrcDoc(value), delay);
    return () => clearTimeout(id);
  }, [usePdf, html, css, previewOverride, isPreview, atsBoost, docType]);

  const measurePages = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.body) return;
      setPages(Math.max(1, Math.ceil(doc.body.scrollHeight / A4_H)));
    } catch {
      // accès cross-origin impossible : on ignore
    }
  };

  const onPdfPages = useCallback((n: number) => setPages(Math.max(1, n)), []);

  const pageLabel =
    pages === 1 ? "1 page ✓" : `${pages} pages ⚠`;

  return (
    <>
      <div className="pane-title">
        <span>Aperçu</span>
        {previewOverride !== null ? (
          <span className="preview-override-badge">Proposition IA — non appliquée</span>
        ) : null}
        <span className="page-badge">{pageLabel}</span>
      </div>
      <div className="pane-body">
        {usePdf ? (
          pdfBlob ? (
            <PdfPreview blob={pdfBlob} onPages={onPdfPages} />
          ) : (
            <div className="pdf-preview-loading">Génération du PDF…</div>
          )
        ) : (
          <iframe
            ref={iframeRef}
            className="preview-frame"
            title="Aperçu du document"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            onLoad={measurePages}
          />
        )}
      </div>
    </>
  );
}

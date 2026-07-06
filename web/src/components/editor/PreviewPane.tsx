"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocStore } from "@/state/docStore";
import { generateResumePdfBlob, generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import type { Resume, Letter } from "@/lib/resume/schema";
import PdfPreview from "./PdfPreview";

/**
 * Aperçu live : le JSON est dessiné en vrai PDF dans le navigateur 
 * (debounce + garde d'obsolescence) et affiché via PDF.js (`PdfPreview`).
 * Compteur de pages exact (numPages). 
 * Une proposition du chat (`previewOverride`) remplace simplement le JSON.
 */
export default function PreviewPane() {
  const json = useDocStore((s) => s.json);
  const docType = useDocStore((s) => s.docType);
  const templateId = useDocStore((s) => s.templateId);
  const previewOverride = useDocStore((s) => s.previewOverride);
  const atsBoost = useDocStore((s) => s.atsBoost);

  const [pages, setPages] = useState(1);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const genRef = useRef(0);

  const isPreview = previewOverride !== null;

  // Régénère le blob (debounce), un résultat périmé est jeté.
  useEffect(() => {
    const gen = ++genRef.current;
    const id = setTimeout(async () => {
      try {
        const jsonToRender = isPreview ? previewOverride : json;
        const boostKeywords = atsBoost.enabled ? atsBoost.keywords : [];
        let blob: Blob;
        
        if (docType === "Lettre") {
          blob = await generateLetterPdfBlob(jsonToRender as Letter, boostKeywords);
        } else {
          blob = await generateResumePdfBlob(
            jsonToRender as Resume,
            templateId as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId,
            boostKeywords
          );
        }
        
        if (genRef.current === gen) setPdfBlob(blob);
      } catch {
        // Rendu impossible (données transitoires) : on conserve l'aperçu précédent.
      }
    }, 500);
    return () => clearTimeout(id);
  }, [json, docType, templateId, previewOverride, isPreview, atsBoost]);

  const onPdfPages = useCallback((n: number) => setPages(Math.max(1, n)), []);

  const pageLabel = pages === 1 ? "1 page ✓" : `${pages} pages ⚠`;

  return (
    <>
      <div className="pane-title">
        <span>Aperçu</span>
        {isPreview ? (
          <span className="preview-override-badge">Proposition IA — non appliquée</span>
        ) : null}
        <span className="page-badge">{pageLabel}</span>
      </div>
      <div className="pane-body">
        {pdfBlob ? (
          <PdfPreview blob={pdfBlob} onPages={onPdfPages} />
        ) : (
          <div className="pdf-preview-loading">Génération du PDF…</div>
        )}
      </div>
    </>
  );
}

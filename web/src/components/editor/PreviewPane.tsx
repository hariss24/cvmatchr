"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocStore } from "@/state/docStore";
import { generateResumePdfBlob, generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import type { Resume, Letter } from "@/lib/resume/schema";
import PdfPreview from "./PdfPreview";

const ZOOM_LEVELS: number[] = [1, 1.25, 1.5, 2, 2.5, 3];

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
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);

  const [pages, setPages] = useState(1);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [zoom, setZoom] = useState(1);
  const genRef = useRef(0);

  // Paliers de zoom. 1 = « Ajuster » (largeur du panneau) ; au-delà, grossissement réel
  // (re-rendu net). Indispensable sur desktop où l'ancien toggle plafonnait trop bas.
  const zoomIndex = ZOOM_LEVELS.indexOf(zoom);
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1;
  const zoomLabel = zoom === 1 ? "Ajuster" : `${Math.round(zoom * 100)} %`;

  const isPreview = previewOverride !== null;

  // Régénère le blob (debounce), un résultat périmé est jeté.
  useEffect(() => {
    const gen = ++genRef.current;
    const isPreview = previewOverride !== null;
    const id = setTimeout(async () => {
      try {
        const jsonToRender = isPreview ? previewOverride : json;

        let blob: Blob;
        
        if (docType === "Lettre") {
          blob = await generateLetterPdfBlob(jsonToRender as Letter);
        } else {
          blob = await generateResumePdfBlob(
            jsonToRender as Resume,
            templateId as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId
          );
        }
        
        if (genRef.current === gen) setPdfBlob(blob);
      } catch {
        // Rendu impossible (données transitoires) : on conserve l'aperçu précédent.
      }
    }, 500);
    return () => clearTimeout(id);
  }, [json, docType, templateId, previewOverride]);

  const onPdfPages = useCallback((n: number) => setPages(Math.max(1, n)), []);

  const pageLabel = pages === 1 ? "1 page ✓" : `${pages} pages ⚠`;

  return (
    <>
      <div className="pane-title">
        <span>Aperçu</span>
        {isPreview ? (
          <div className="preview-override-badge">
            <span>Proposition IA</span>
            <button
              type="button"
              className="preview-override-badge__btn"
              onClick={() => setPreviewOverride(null)}
              title="Réafficher le document original"
            >
              Voir l&apos;original ✕
            </button>
          </div>
        ) : null}
        <span className="zoom-control">
          <button
            type="button"
            className="form-btn-mini form-btn-icon-only"
            onClick={() => setZoom(ZOOM_LEVELS[zoomIndex - 1])}
            disabled={!canZoomOut}
            aria-label="Réduire l'aperçu"
            title="Réduire l'aperçu"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <span className="zoom-control__label" title="Niveau de zoom">{zoomLabel}</span>
          <button
            type="button"
            className="form-btn-mini form-btn-icon-only"
            onClick={() => setZoom(ZOOM_LEVELS[zoomIndex + 1])}
            disabled={!canZoomIn}
            aria-label="Agrandir l'aperçu"
            title="Agrandir l'aperçu"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
        </span>
        <span className="page-badge">{pageLabel}</span>
      </div>
      <div className="pane-body">
        {pdfBlob ? (
          <PdfPreview blob={pdfBlob} zoom={zoom} onPages={onPdfPages} />
        ) : (
          <div className="pdf-preview-loading">Génération du PDF…</div>
        )}
      </div>
    </>
  );
}

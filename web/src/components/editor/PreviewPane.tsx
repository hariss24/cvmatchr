"use client";

import { useEffect, useRef, useState } from "react";
import { useDocStore } from "@/state/docStore";
import { mergeHtml } from "@/lib/resume/mergeHtml";

// A4 à 96 dpi ≈ 1122px (297mm × 96 / 25.4). Port de updatePageCount (app.js, l.712).
const A4_H = 1122;

/**
 * Aperçu live : lit le store (html + css), fusionne en document complet et l'affiche
 * dans une iframe sandbox via `srcDoc`, avec un debounce. Affiche un compteur de pages A4.
 *
 * Sandbox sans `allow-scripts` : le HTML/CSS du CV est rendu mais aucun script ne s'exécute.
 * `allow-same-origin` permet de mesurer la hauteur du document pour le compteur de pages.
 */
export default function PreviewPane() {
  const html = useDocStore((s) => s.html);
  const css = useDocStore((s) => s.css);
  const previewOverride = useDocStore((s) => s.previewOverride);

  const [srcDoc, setSrcDoc] = useState("");
  const [pages, setPages] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Debounce de la fusion HTML/CSS (port de schedulePreview).
  // Une proposition du chat IA (previewOverride) court-circuite l'aperçu live, sans debounce.
  useEffect(() => {
    const value = previewOverride !== null ? previewOverride : mergeHtml(html, css);
    const delay = previewOverride !== null ? 0 : 150;
    const id = setTimeout(() => setSrcDoc(value), delay);
    return () => clearTimeout(id);
  }, [html, css, previewOverride]);

  const measurePages = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.body) return;
      setPages(Math.max(1, Math.ceil(doc.body.scrollHeight / A4_H)));
    } catch {
      // accès cross-origin impossible : on ignore
    }
  };

  const pageLabel =
    pages === 1 ? "1 page ✓" : `${pages} pages ⚠`;

  return (
    <>
      <div className="pane-title">
        <span>Aperçu</span>
        <span className="page-badge">{pageLabel}</span>
      </div>
      <div className="pane-body">
        <iframe
          ref={iframeRef}
          className="preview-frame"
          title="Aperçu du document"
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          onLoad={measurePages}
        />
      </div>
    </>
  );
}

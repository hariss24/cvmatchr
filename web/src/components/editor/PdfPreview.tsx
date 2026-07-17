"use client";

import { useEffect, useRef } from "react";

/**
 * Viewer PDF de l'aperçu (moteur react-pdf) : rend chaque page du blob dans un `<canvas>`
 * via pdf.js (même pattern que `lib/pdf/pdfToImages.ts` : import dynamique, worker servi
 * depuis `public/`). Un nouveau blob annule le rendu en cours (flag `cancelled`), et les
 * canvases ne sont remplacés qu'une fois le nouveau rendu complet (pas de flash blanc).
 */
export default function PdfPreview({
  blob,
  zoom,
  onPages,
}: {
  blob: Blob;
  zoom?: boolean;
  onPages?: (n: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Outil « main » : glisser à la souris pour déplacer l'aperçu (scroll du conteneur).
  // Souris uniquement — au tactile, le défilement natif fait déjà le travail.
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-panning");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const el = containerRef.current;
    if (!pan || !el) return;
    el.scrollLeft = pan.left - (e.clientX - pan.x);
    el.scrollTop = pan.top - (e.clientY - pan.y);
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!panRef.current || !el) return;
    panRef.current = null;
    el.classList.remove("is-panning");
    el.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const data = new Uint8Array(await blob.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data });
      try {
        const doc = await loadingTask.promise;
        if (cancelled) return;
        onPages?.(doc.numPages);

        const frag = document.createDocumentFragment();
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "pdf-preview__page";
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          frag.appendChild(canvas);
        }
        if (!cancelled) containerRef.current?.replaceChildren(frag);
      } finally {
        void loadingTask.destroy();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, onPages]);

  return (
    <div
      ref={containerRef}
      className={`pdf-preview${zoom ? " pdf-preview--zoom" : ""}`}
      data-testid="pdf-preview"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    />
  );
}

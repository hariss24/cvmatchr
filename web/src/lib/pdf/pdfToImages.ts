"use client";

/**
 * Rendu d'un PDF en images PNG (base64), côté navigateur, via pdf.js.
 *
 * L'app Flask faisait ce rendu côté serveur ; ici il est fait dans le navigateur puis les
 * images sont envoyées à `/api/pdf-to-resume`. Le worker pdf.js est servi depuis `public/`
 * (copié de `pdfjs-dist/build/pdf.worker.min.mjs`) pour éviter toute résolution d'asset par
 * le bundler.
 *
 * ⚠️ pdf.js référence des API navigateur (`DOMMatrix`…) dès l'évaluation du module : on l'importe
 * donc **dynamiquement** dans la fonction (jamais au prerender serveur du composant client).
 */

const DEFAULT_MAX_PAGES = 10;
// Échelle de rendu : compromis lisibilité (pour l'OCR de l'IA) / poids des images.
const RENDER_SCALE = 2;

/**
 * Convertit un fichier PDF en liste d'images PNG `data:` (une par page, max `maxPages`).
 * Renvoie les `dataURL` (préfixe `data:image/png;base64,` inclus — la route serveur le retire).
 */
export async function pdfToImages(
  file: File,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  // Le worker est statique dans public/ : URL absolue stable, pas de magie de bundler.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const count = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible.");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/png"));
  }

  await loadingTask.destroy();
  return images;
}

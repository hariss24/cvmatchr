/**
 * Utilitaire de TEST : extrait le texte d'un PDF (une string par page) via pdf.js.
 * Sert aux tests vitest du moteur `pdfgen` à vérifier le contenu réel des PDF générés.
 *
 * Build `legacy` : le build standard de pdf.js exige des API navigateur (DOMMatrix…)
 * absentes de Node. Import dynamique pour ne jamais l'évaluer hors des tests.
 */
export async function extractPdfText(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  await loadingTask.destroy();
  return pages;
}

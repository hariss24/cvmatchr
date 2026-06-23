/**
 * Fusionne le HTML du document et le CSS du template en un document HTML complet
 * pour l'aperçu / la conversion PDF.
 *
 * Port fidèle de `mergedHtml()` (static/js/app.js, l.591-604) — hors boost ATS (Phase 5).
 * Trois cas : pas de CSS → HTML brut ; HTML avec `</head>` ou `<html>` → injection du `<style>` ;
 * sinon → document complet enveloppant. Le CSS est neutralisé contre une fermeture prématurée
 * du bloc `<style>`.
 */
export function mergeHtml(html: string, css: string): string {
  if (!css.trim()) return html;

  // Empêche la fermeture prématurée du bloc <style> par du CSS malformé.
  const safeCss = css.replace(/<\/style\s*>/gi, "<\\/style>");

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `<style>\n${safeCss}\n</style>\n</head>`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(
      /<html([^>]*)>/i,
      `<html$1>\n<head><meta charset="utf-8"><style>\n${safeCss}\n</style></head>`,
    );
  }
  return `<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<style>\n${safeCss}\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
}

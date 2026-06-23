import { chromium, type Browser, type Route } from "playwright-core";

/**
 * Moteur HTML → PDF. Port de `pdf_engine.py`.
 *
 * Deux modes de lancement Chromium :
 * - **Serverless (Vercel/Lambda)** : `@sparticuz/chromium` (binaire Chromium packagé).
 * - **Local (dev)** : le Chromium installé par Playwright (`chromium.launch()` par défaut).
 *
 * Sécurité : whitelist des formats/marges (anti-injection CSS) + route-guard anti-SSRF
 * (les ressources du HTML qui résolvent vers une IP interne sont bloquées au chargement).
 */

// Formats et marges autorisés (whitelist, port de VALID_FORMATS / VALID_MARGINS).
export const VALID_FORMATS = ["A4", "A3", "A5", "Letter", "Legal", "Tabloid"] as const;
export const VALID_MARGINS = ["0", "5mm", "10mm", "15mm", "20mm", "25mm", "30mm"] as const;

export type PageFormat = (typeof VALID_FORMATS)[number];
export type Margin = (typeof VALID_MARGINS)[number];

export type PdfOptions = {
  format?: PageFormat;
  margin?: Margin;
  background?: boolean;
};

/** Détecte un environnement serverless (Vercel/Lambda) → Chromium packagé. */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Lance Chromium selon l'environnement. */
async function launchBrowser(): Promise<Browser> {
  if (isServerless()) {
    const { default: sparticuz } = await import("@sparticuz/chromium");
    return chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }
  return chromium.launch();
}

// ---- anti-SSRF : aucune sous-ressource réseau --------------------------------
// Le HTML d'un CV/Lettre est entièrement inline : photo en base64 (`data:`), CSS
// du template injecté dans le document. Aucune ressource externe légitime n'est
// nécessaire au rendu. On bloque donc TOUT chargement réseau (http/https/file/
// ftp…) et on n'autorise que le contenu inline (`data:`/`blob:`/`about:`).
//
// Conséquence sécurité : il n'y a plus AUCUNE résolution DNS pendant le rendu,
// ce qui élimine entièrement le SSRF — y compris le DNS rebinding / TOCTOU
// (impossible de faire diverger une vérification d'IP de la connexion réelle de
// Chromium, puisqu'aucune connexion réseau n'est permise).

const ALLOWED_SCHEMES = new Set(["data:", "blob:", "about:"]);

/** True si l'URL d'une sous-ressource est du contenu inline autorisé. Exporté pour les tests. */
export function isAllowedResourceUrl(url: string): boolean {
  try {
    return ALLOWED_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false; // URL non parsable → bloquée par prudence
  }
}

/** Handler de route : n'autorise que le contenu inline, bloque tout le réseau (anti-SSRF). */
async function blockExternalResources(route: Route): Promise<void> {
  if (isAllowedResourceUrl(route.request().url())) {
    await route.continue();
  } else {
    await route.abort();
  }
}

// ---- API publique ------------------------------------------------------------

/**
 * Convertit une chaîne HTML en PDF (Uint8Array).
 *
 * @throws {Error} si `format`/`margin` hors whitelist, ou si le rendu échoue.
 */
export async function htmlToPdf(html: string, options: PdfOptions = {}): Promise<Uint8Array> {
  const { format = "A4", margin = "0", background = true } = options;

  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Format non supporté : ${format}. Acceptés : ${VALID_FORMATS.join(", ")}`);
  }
  if (!VALID_MARGINS.includes(margin)) {
    throw new Error(`Marge non supportée : ${margin}. Acceptées : ${VALID_MARGINS.join(", ")}`);
  }

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route("**/*", blockExternalResources); // anti-SSRF : inline only
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30_000 });
    return await page.pdf({
      format,
      printBackground: background,
      preferCSSPageSize: true,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });
  } finally {
    await browser.close();
  }
}

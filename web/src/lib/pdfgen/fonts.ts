import { Font } from "@react-pdf/renderer";

/**
 * Enregistrement des polices du moteur PDF (react-pdf ne lit pas les CSS Google Fonts :
 * il faut des fichiers de polices). Les TTF statiques vivent dans `public/fonts/`
 * (licences : `public/fonts/LICENSES.md`).
 *
 * - `Roboto` : template « Graphique » (substitut libre de Segoe UI).
 * - `Inter` : Lettre (même police que le rendu HTML historique).
 *
 * Le même module sert en Node (tests vitest, rendu serveur) et dans le navigateur
 * (génération client, Phase 2) : seul le chemin des fichiers change.
 */

/** Chemin d'un fichier de police selon l'environnement d'exécution. */
function fontPath(file: string): string {
  return typeof window === "undefined"
    ? `${process.cwd()}/public/fonts/${file}`
    : `/fonts/${file}`;
}

let registered = false;

/** Idempotente : enregistre les familles une seule fois par runtime. */
export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Roboto",
    fonts: [
      { src: fontPath("Roboto-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Roboto-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontPath("Roboto-Medium.ttf"), fontWeight: 500 },
      { src: fontPath("Roboto-Bold.ttf"), fontWeight: 700 },
    ],
  });

  Font.register({
    family: "Inter",
    fonts: [
      { src: fontPath("Inter-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });

  // Jamais de césure : react-pdf coupe les mots par défaut, inacceptable en français.
  Font.registerHyphenationCallback((word) => [word]);
}

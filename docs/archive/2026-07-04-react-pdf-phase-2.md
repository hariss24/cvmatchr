# Migration React PDF — Phase 2 : aperçu PDF.js + génération client + interrupteur — Implementation Plan

> **For agentic workers:** suivre le protocole du loop (`REWRITE_PROGRESS.md`). Steps en
> checkboxes. Cadrage parent : `2026-07-04-migration-react-pdf.md` (Phase 2).
> Phase 1 livrée : `lib/pdfgen/` (fonts, ResumeDocument graphique, LetterDocument, AtsBoost).

**Goal:** sur le template **Graphique**, l'aperçu devient le **vrai PDF** (généré dans le
navigateur, affiché via PDF.js, compteur de pages exact) et « Convertir en PDF » télécharge ce
même blob **sans appel serveur**. Les 4 autres templates et la Lettre restent strictement sur
l'ancien moteur HTML/iframe. Fin de phase = 🛑 **CHECKPOINT UTILISATEUR** (validation visuelle).

**Architecture:** un sélecteur **pur et dérivé** `docEngine(doc): "pdf" | "html"` (pas de champ
stocké → aucune synchro d'état à maintenir). `"pdf"` seulement si : document CV (`docType !==
"Lettre"`), `templateId === "graphique"`, et `htmlSource === false` (une édition Mode Expert
rend `json` périmé → retour automatique et sûr au moteur HTML, la garde C1 continue de jouer).
La Lettre attend la Phase 3 (ses flux IA — pack, chat, import texte — écrivent encore du HTML).
`previewOverride` (proposition chat, HTML) garde l'iframe même en engine pdf.
Génération partagée `generateResumePdfBlob()` (PreviewPane + TopBar), import **dynamique** de
`@react-pdf/renderer` et de `ResumeDocument` (poids hors bundle initial).

**Tech Stack:** existant uniquement (react-pdf + pdfjs-dist déjà en deps ; worker pdfjs déjà
dans `public/pdf.worker.min.mjs`).

## Global Constraints

- Ne PAS casser les templates non migrés : tout le comportement actuel (iframe, `/api/convert`)
  reste inchangé quand `docEngine` ≠ `"pdf"`. Les e2e existants tournent sur le template par
  défaut « sobre » → ils doivent rester verts **sans modification**.
- Pas de nouvelle dépendance. Pas de couleur en dur dans le CSS ajouté (variables de thème).
- Debounce de la génération PDF ≥ 400 ms + garde d'obsolescence (compteur de génération : un
  résultat périmé ne doit jamais écraser un plus récent).
- Après chaque tâche : Journal (`REWRITE_PROGRESS.md`) + commit isolé.
- Vérifs (depuis `web/`) : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `npm run build`, `npx playwright test` (purge `.next` + port 3000 libre avant).

## File Structure

- `web/src/state/docStore.ts` — **modifié** (T1) : export `docEngine` (fonction pure).
- `web/src/state/docStore.test.ts` — **modifié** (T1) : tests de `docEngine`.
- `web/src/lib/pdfgen/generatePdf.ts` — **créé** (T2) : `generateResumePdfBlob()` (client).
- `web/src/components/editor/PdfPreview.tsx` — **créé** (T2) : viewer Blob → canvases pdfjs.
- `web/src/components/editor/PreviewPane.tsx` — **modifié** (T2) : branche sur `docEngine`.
- `web/src/app/globals.css` — **modifié** (T2) : styles `.pdf-preview` (additifs).
- `web/src/components/layout/TopBar.tsx` — **modifié** (T3) : téléchargement client.
- `web/tests/e2e/pdf-preview.spec.ts` — **créé** (T4).

---

## Task 1: Sélecteur de moteur `docEngine` (pur, dérivé)

**Interfaces:**
- Produces (docStore.ts) :
  ```ts
  export type DocEngine = "pdf" | "html";
  /** Moteur de rendu du document : react-pdf pour les templates portés, HTML sinon. */
  export function docEngine(d: Pick<Doc, "docType" | "templateId" | "htmlSource">): DocEngine;
  ```
  Règle : `"pdf"` ssi `docType !== "Lettre" && templateId === "graphique" && !htmlSource`.

- [ ] **Step 1 (test rouge)** — dans `docStore.test.ts` : graphique+CV → `"pdf"` ;
  graphique+Maître → `"pdf"` ; graphique+Lettre → `"html"` ; sobre+CV → `"html"` ;
  graphique+CV+`htmlSource:true` → `"html"`.
- [ ] **Step 2** — implémenter (3 lignes), test vert.
- [ ] **Step 3** — `npx tsc --noEmit` + `npx vitest run` complets, commit :
  `pdfgen: docEngine — sélecteur de moteur dérivé (graphique → pdf, garde htmlSource)`

## Task 2: Génération client + viewer PDF.js + branchement de l'aperçu

**Interfaces:**
- Produces (`generatePdf.ts`, `"use client"`) :
  ```ts
  /** Génère le PDF du CV dans le navigateur (imports dynamiques : rien au chargement initial). */
  export async function generateResumePdfBlob(
    resume: Resume, templateId: "graphique", atsKeywords: string[],
  ): Promise<Blob>;
  ```
  Implémentation : `const [{ pdf }, { ResumeDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./ResumeDocument")])` puis `pdf(<ResumeDocument …/>).toBlob()`.
  ⚠️ Vérifier le typage `json as Resume` à l'appel (le store porte `DocData`).
- Produces (`PdfPreview.tsx`) : composant client `{ blob: Blob; onPages?: (n: number) => void }`
  — rend chaque page dans un `<canvas>` (pattern `pdfToImages.ts` : import dynamique
  `pdfjs-dist`, worker `/pdf.worker.min.mjs`, scale ~1.5), conteneur scrollable
  `.pdf-preview` `data-testid="pdf-preview"`, pages empilées façon feuilles A4. Annulation :
  une nouvelle `blob` interrompt le rendu en cours (flag/génération dans l'effet).
- `PreviewPane` : `engine = docEngine({docType, templateId, htmlSource})` ;
  - `engine === "pdf"` **et** `previewOverride === null` → effet debouncé (~500 ms) qui appelle
    `generateResumePdfBlob(json, "graphique", atsBoost.enabled ? keywords : [])`, garde
    d'obsolescence par compteur, état `{ blob, pages }` ; badge = `numPages` **exact** (même
    libellé `1 page ✓` / `N pages ⚠`) ; pendant la 1re génération : petit texte
    « Génération du PDF… » (classe `.pdf-preview-loading`, variables de thème).
  - sinon → iframe actuelle, inchangée (previewOverride inclus).

- [ ] **Step 1** — écrire `generatePdf.ts` + `PdfPreview.tsx` + brancher `PreviewPane` + styles.
- [ ] **Step 2 (vérif runtime réelle)** — purge `.next`, `next dev`, Playwright MCP :
  passer le template à « Graphique » → l'aperçu affiche le canvas PDF (screenshot lu et jugé),
  badge de pages exact ; taper un nom dans le formulaire → l'aperçu se régénère (~1 s) ;
  repasser à « Sobre » → iframe de retour ; Mode Expert (édition HTML) sur Graphique →
  retour iframe (garde `htmlSource`) ; chat IA mocké non requis (previewOverride couvert par
  la branche iframe, vérifié par les e2e chat).
- [ ] **Step 3** — vérifs complètes + commit :
  `pdfgen: aperçu = vrai PDF sur le template Graphique (génération client + viewer PDF.js)`

## Task 3: « Convertir en PDF » sans serveur quand engine = pdf

- `TopBar.onConvert` : si `docEngine(...) === "pdf"` → `generateResumePdfBlob(json as Resume,
  "graphique", boostKeywords)` puis même téléchargement (`URL.createObjectURL`) + même
  `saveHistoryEntry` (avec `json` non-null, `html/css` du store comme aujourd'hui — compat
  historique conservée) + même toast. Sinon → chemin `/api/convert` inchangé.
- Pas de changement de l'UI (même bouton, même busy).

- [ ] **Step 1** — implémenter (extraire le petit helper de téléchargement/historique commun
  aux deux chemins plutôt que dupliquer).
- [ ] **Step 2 (vérif runtime)** — sur `next dev` (Playwright MCP) : Graphique → « Convertir
  en PDF » télécharge un `.pdf` **sans requête** `/api/convert` (surveiller le réseau), le
  fichier commence par `%PDF` ; sur Sobre → la requête `/api/convert` part comme avant.
- [ ] **Step 3** — vérifs complètes + commit :
  `pdfgen: export PDF client (sans serveur) quand le moteur react-pdf est actif`

## Task 4: E2e du nouveau moteur + suite complète

- [ ] **Step 1** — `tests/e2e/pdf-preview.spec.ts` :
  1. « le template Graphique bascule l'aperçu en PDF » : goto `/`, sélectionner le template
     Graphique (repérer le sélecteur réel — MetaBar), attendre `data-testid="pdf-preview"`
     visible + au moins un canvas + badge `page` ; repasser à Sobre → `.preview-frame` visible.
  2. « l'export Graphique n'appelle pas le serveur » : route `/api/convert` espionnée →
     compteur 0 après clic « Convertir en PDF » (attendre l'event download).
- [ ] **Step 2** — suite complète : `npx playwright test` → **23/23** (21 existants intacts +
  2 nouveaux) ; sinon adapter UNIQUEMENT les nouveaux specs.
- [ ] **Step 3** — vérifs complètes (tsc, lint, vitest, build) + commit :
  `pdfgen: e2e du moteur react-pdf (aperçu canvas + export sans serveur)`

---

## Fin de phase (critères du cadrage)

- Sur Graphique : aperçu = PDF réel, export = même blob que l'aperçu, compteur de pages exact. ✅/❌
- Sobre/Moderne/Classique/Minimal + Lettre : strictement inchangés (e2e 21 existants verts). ✅/❌
- Poids : `@react-pdf/renderer` absent du chunk initial (imports dynamiques — vérifier
  qu'aucun import statique de `@react-pdf/renderer` n'existe hors `lib/pdfgen/`). ✅/❌
- Push + contrôle prod (aperçu Graphique testé sur la prod via Playwright MCP). ✅/❌
- Puis : 🛑 **STOP — CHECKPOINT UTILISATEUR** : présenter des captures aperçu/export du
  Graphique (avec données réelles si un brouillon existe), demander la validation visuelle
  explicite. **Ne PAS entamer la Phase 3 sans son feu vert** (règle du chantier). Mettre à
  jour « Prochaine action » : « en attente du checkpoint utilisateur ».

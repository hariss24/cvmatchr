# Migration React PDF — Phase 1 : moteur de rendu (fondations) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (ou le protocole
> du loop dans `REWRITE_PROGRESS.md`) to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.
> Cadrage parent : `docs/superpowers/plans/2026-07-04-migration-react-pdf.md` (Phase 1).

**Goal:** générer un PDF valide depuis `Resume`/`Letter` (JSON) **en Node, sans Chromium**,
avec le template **Graphique** porté visuellement en React PDF, le booster ATS intégré, et des
tests vitest qui vérifient le contenu du PDF (signature + textes extraits via `pdfjs-dist`).

**Architecture:** nouveau module `web/src/lib/pdfgen/` isolé (rien d'existant n'est modifié —
aucun risque pour l'app en prod). `@react-pdf/renderer` rend le même composant en Node
(`renderToBuffer`, tests + futur usage serveur) et dans le navigateur (`pdf().toBlob()`,
Phase 2). Les polices sont des **fichiers TTF locaux** dans `web/public/fonts/` (react-pdf ne
lit pas les CSS Google Fonts) : `fonts.ts` les enregistre avec un chemin qui marche en Node
(`process.cwd()`) et en navigateur (`/fonts/...`).

**Décision polices (risque n°1 du cadrage) :** le Graphique HTML utilise `Segoe UI` — police
Microsoft **non redistribuable**. Substitut retenu : **Roboto** (Apache 2.0, métriquement
proche, déjà 2e choix de la pile CSS du template). Lettre : **Inter** (OFL, déjà la police du
rendu HTML de la lettre). Écart typographique assumé (décision cadrage).

**Tech Stack:** `@react-pdf/renderer` (nouvelle dépendance), `pdfjs-dist` (déjà présent —
extraction de texte dans les tests), Vitest. Zéro Chromium.

## Global Constraints

- Tout le code vit dans `web/src/lib/pdfgen/` + `web/public/fonts/`. **Ne toucher à AUCUN
  fichier existant** (render.ts, PreviewPane, /api/convert… restent intacts jusqu'à la Phase 2).
- Seule dépendance ajoutée : `@react-pdf/renderer`. Avant de coder, vérifier l'API réelle dans
  `node_modules/@react-pdf/renderer/` (exports `renderToBuffer`, `Font`, `Document`, `Page`,
  `View`, `Text`, `Image`, `StyleSheet`) — ne pas coder de mémoire.
- Tests pdfgen en **environnement node** (`// @vitest-environment node` en tête de fichier si
  la config par défaut est jsdom — vérifier `vitest.config`/`vite.config`).
- Polices : fichiers `.ttf` uniquement (react-pdf ne supporte pas woff2). Licences (Apache/OFL)
  copiées à côté des fichiers.
- Césure française : désactivée (`Font.registerHyphenationCallback((w) => [w])`) — les mots ne
  doivent jamais être coupés arbitrairement.
- Après chaque tâche : entrée au **Journal** de `REWRITE_PROGRESS.md` + commit isolé.
- Vérifications (depuis `web/`) : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `npm run build` (le module ne doit pas casser le build même s'il n'est pas encore importé
  par l'app).

## File Structure

- `web/public/fonts/Roboto-Regular.ttf`, `Roboto-Medium.ttf`, `Roboto-Bold.ttf`,
  `Roboto-Italic.ttf`, `Inter-Regular.ttf`, `Inter-Bold.ttf` + `LICENSES.md` — **créés** (Task 1).
- `web/src/lib/pdfgen/fonts.ts` — **créé** (Task 1) : enregistrement des polices + césure.
- `web/src/lib/pdfgen/fonts.test.ts` — **créé** (Task 1) : smoke test rendu Node.
- `web/src/lib/pdfgen/extractText.ts` — **créé** (Task 1, util de TEST) : PDF buffer → texte
  par page via `pdfjs-dist` (build legacy pour Node).
- `web/src/lib/pdfgen/ResumeDocument.tsx` — **créé** (Task 2) : CV Graphique.
- `web/src/lib/pdfgen/ResumeDocument.test.tsx` — **créé** (Task 2).
- `web/src/lib/pdfgen/LetterDocument.tsx` — **créé** (Task 3) : Lettre.
- `web/src/lib/pdfgen/LetterDocument.test.tsx` — **créé** (Task 3).
- (Task 4 modifie ResumeDocument/LetterDocument : prop `atsKeywords`.)

---

## Task 1: Dépendance, polices TTF locales, smoke test Node

**Files:**
- Create: `web/public/fonts/*` (6 TTF + licences), `web/src/lib/pdfgen/fonts.ts`,
  `web/src/lib/pdfgen/extractText.ts`, `web/src/lib/pdfgen/fonts.test.ts`

**Interfaces:**
- Produces: `registerPdfFonts(): void` (idempotente — flag module) depuis `fonts.ts`.
  Familles enregistrées : `"Roboto"` (400 normal+italic, 500, 700) et `"Inter"` (400, 700).
  Source des fichiers : `fontPath(file)` → en Node `path.join(process.cwd(), "public/fonts", file)`,
  en navigateur `/fonts/${file}` (branche sur `typeof window === "undefined"`).
- Produces: `extractPdfText(buf: Uint8Array): Promise<string[]>` (une string par page) depuis
  `extractText.ts` — import de `pdfjs-dist/legacy/build/pdf.mjs` (le build standard exige des
  API navigateur absentes de Node).

- [ ] **Step 1: Installer la dépendance**

Run (depuis `web/`) : `npm install @react-pdf/renderer`
Expected: install OK ; noter la version. Lire rapidement les exports réels
(`node_modules/@react-pdf/renderer/lib/` ou son `package.json`/types) pour confirmer
`renderToBuffer` + `Font.registerHyphenationCallback`.

- [ ] **Step 2: Télécharger les polices**

Télécharger dans `web/public/fonts/` (URLs raw du repo `google/fonts`, vérifiées) :
- Roboto : `https://github.com/google/fonts/raw/main/ofl/roboto/Roboto%5Bwdth,wght%5D.ttf`
  ⚠️ c'est une **police variable** — react-pdf ne les gère pas bien. Préférer les statiques du
  repo `googlefonts/roboto-classic` (release `Roboto-Regular.ttf` etc.) ou
  `https://github.com/googlefonts/roboto/releases` (Roboto-Regular/Medium/Bold/Italic).
- Inter : release officielle `https://github.com/rsms/inter/releases` (zip → `Inter-Regular.ttf`,
  `Inter-Bold.ttf` — prendre les **statiques** du dossier `extras/ttf` ou équivalent, PAS la variable).

Si une URL est morte : chercher la release actuelle des repos officiels (`googlefonts/roboto`,
`rsms/inter`) — ne JAMAIS prendre un miroir tiers. Vérifier chaque fichier : taille > 100 Ko et
signature TTF (`00 01 00 00` en tête ; PowerShell :
`[System.IO.File]::ReadAllBytes(...)[0..3]`). Ajouter `web/public/fonts/LICENSES.md` (Roboto :
Apache 2.0 ; Inter : SIL OFL 1.1, avec liens).

- [ ] **Step 3: Écrire `fonts.ts` + `extractText.ts` + le smoke test (rouge d'abord)**

`fonts.test.ts` (`// @vitest-environment node` si nécessaire) :

```tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { extractPdfText } from "./extractText";

describe("fondations react-pdf", () => {
  it("rend un PDF valide en Node avec Roboto et accents français", async () => {
    registerPdfFonts();
    const buf = await renderToBuffer(
      <Document>
        <Page size="A4">
          <Text style={{ fontFamily: "Roboto", fontWeight: 700 }}>
            Vérification typographique : é à ç œ — « guillemets »
          </Text>
        </Page>
      </Document>,
    );
    expect(Buffer.from(buf.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const pages = await extractPdfText(new Uint8Array(buf));
    expect(pages[0]).toContain("Vérification typographique");
    expect(pages[0]).toContain("œ"); // la police couvre bien le français
  });
});
```

Run: `npx vitest run src/lib/pdfgen` → FAIL (modules absents), puis implémenter `fonts.ts`
(registre + `registerHyphenationCallback((w) => [w])`) et `extractText.ts`, relancer → PASS.

⚠️ Pièges connus à traiter si le test casse :
- vitest/JSX dans un `.test.tsx` : OK avec la config Next existante ; sinon ajouter le fichier
  en `.tsx` et vérifier `esbuild`/`jsx` de la config vitest.
- `pdfjs-dist` legacy en Node : utiliser `getDocument({ data, useSystemFonts: true })` et
  `disableWorker` si le worker est exigé (`GlobalWorkerOptions.workerSrc` inutile en legacy).

- [ ] **Step 4: Vérifs globales + commit**

Run: `npx tsc --noEmit` ; `npm run lint` ; `npx vitest run` (tout, pas que pdfgen) ; `npm run build`.
Expected: tout vert (186 tests existants + le nouveau).

```bash
git add web/package.json web/package-lock.json web/public/fonts web/src/lib/pdfgen ../REWRITE_PROGRESS.md
git commit -m "pdfgen: fondations react-pdf — polices TTF locales (Roboto/Inter), rendu Node vérifié"
```

---

## Task 2: `ResumeDocument` — port visuel du template Graphique

**Files:**
- Create: `web/src/lib/pdfgen/ResumeDocument.tsx`, `web/src/lib/pdfgen/ResumeDocument.test.tsx`

**Interfaces:**
- Produces: `ResumeDocument({ resume, templateId }: { resume: Resume; templateId: "graphique" }): JSX`
  — composant `<Document>` complet. `templateId` restreint à `"graphique"` pour l'instant
  (l'union s'élargira en Phase 4) ; `switch` interne prêt à accueillir les autres.
- Consumes: `Resume` (`@/lib/resume/schema`), `registerPdfFonts` (Task 1).

**Spécification visuelle (transposée du CSS Graphique, `templates.ts` l.292-346 — écart assumé) :**

- Page A4, padding ~`16 36 12` (pt), `fontFamily: "Roboto"`, `fontSize: 9.5`, couleur `#555`,
  `lineHeight: 1.25`. Accent : `#0078d4`.
- **En-tête** (flex row, centré verticalement) : photo 75×75 arrondie 4 (si `resume.photo`,
  `<Image>` — data URI base64 supporté) ; colonne nom (14pt, 700, MAJUSCULES, `#111`) + titre
  du poste **sous** le nom (12pt, 700, accent) ; contact à droite (~250pt, aligné droite,
  9.5pt, `#444`, lineHeight 1.5) : `location · email · phone · linkedin` (séparateur « · »,
  champs vides filtrés — reprendre la logique de `render.ts` l.29-33).
- **À propos** : paragraphe seul (10pt, justifié), sans titre de section — seulement si
  `summary` non vide.
- **Titres de section** : accent, 10pt, 700, MAJUSCULES, marges ~10 haut/bas.
- **Expériences / Formations / Projets / Bénévolat — timeline** : chaque item avec barre
  verticale gauche (2pt, `#555`), pastille ronde 10×10 (`#555`) en haut à gauche (react-pdf :
  `View` position absolute), padding-left 20, dernier item sans barre. Ligne 1 : titre (10pt,
  700, `#111`) + date à droite (10pt, `#888`). Ligne 2 : entreprise/école (9pt, 700) —
  contrat — lieu (séparés par « — », vides filtrés, mêmes règles que `render.ts`). Puces :
  liste à puces « • » indentée (~15pt).
- **Compétences** : section bordée haut+bas (2pt accent), items en liste à puces pleine
  largeur, `#111` ; si l'item contient « — » (ou « - ») : partie gauche en gras (700) —
  reprendre le split de `render.ts` l.125-133.
- **Langues & Centres d'intérêt côte à côte** (2 colonnes ~48 %) : listes à puces ;
  langue : `Nom : niveau` (niveau `#555`).
- **Certifications** : liste à puces simple.
- **Sections vides filtrées** — mêmes conditions exactement que `render.ts` (expérience :
  title|company|bullets ; éducation : title|school ; etc.).
- **Ordre des sections = celui de `render.ts`** : en-tête, à propos, expériences, formations,
  compétences, projets, certifications, bénévolat, langues+intérêts.

- [ ] **Step 1: Écrire les tests (rouges)**

`ResumeDocument.test.tsx` — via `renderToBuffer` + `extractPdfText` sur `DEFAULT_RESUME` :
présence de `name`, `title`, `summary`, du 1er bullet d'expérience, de « Compétence 1 »,
« Français », « EXPÉRIENCES » (ou la casse rendue — l'uppercase peut être fait dans le code,
pas par style, pour que l'extraction le voie) ; et sur un CV minimal
(`resumeSchema.parse({ name: "X" })`) : PAS de « Expériences »/« Langues » (sections vides
filtrées). Test photo : un data-URI PNG 1×1 ne fait pas planter le rendu.

- [ ] **Step 2: Implémenter, itérer jusqu'au vert**

Run: `npx vitest run src/lib/pdfgen` → PASS.

- [ ] **Step 3: Validation typographique précoce (risque n°1) — inspection visuelle**

Générer un PDF réel : petit script jetable (scratchpad) qui écrit
`renderToBuffer(<ResumeDocument resume={DEFAULT_RESUME} …/>)` dans un fichier, puis
l'ouvrir dans le Chromium de Playwright (déjà installé pour les e2e) et prendre une
capture — la lire (outil Read) et juger : accents corrects, graisse 700 réelle (pas de
faux-gras), timeline alignée, 2 colonnes langues/intérêts. Consigner le verdict au Journal
(+ garder le screenshot en scratchpad). Si la typo est mauvaise → STOP, noter en
« Blocages » du suivi.

- [ ] **Step 4: Vérifs globales + commit**

`npx tsc --noEmit` ; `npm run lint` ; `npx vitest run` ; `npm run build` → verts.

```bash
git add web/src/lib/pdfgen ../REWRITE_PROGRESS.md
git commit -m "pdfgen: ResumeDocument — template Graphique porté en react-pdf (timeline, 2 colonnes, photo)"
```

---

## Task 3: `LetterDocument` — port de `renderLetter`

**Files:**
- Create: `web/src/lib/pdfgen/LetterDocument.tsx`, `web/src/lib/pdfgen/LetterDocument.test.tsx`

**Interfaces:**
- Produces: `LetterDocument({ letter }: { letter: Letter }): JSX`.
- Consumes: `Letter` (`@/lib/resume/schema`).

**Spécification (transposée de `renderLetter`, `render.ts` l.252-295) :** page A4, Inter,
~14px de base (≈10.5pt), lineHeight 1.7, couleur `#222`, contenu max ~680 large centré,
marge haute ~40. Deux blocs en-tête (flex row, espace entre) : destinataire à gauche
(nom en gras, service, adresse), expéditeur à droite aligné droite (nom gras, adresse,
contact, puis date en `#555`). « Objet : … » en gras. `greeting`, puis `body` découpé en
paragraphes sur `\n` (vides filtrés — même logique), `signoff` pareil, signature en bas à
droite en gras.

- [ ] **Step 1: Tests (rouges)** — `DEFAULT_LETTER` : présence de `sender_name`,
  `subject` (précédé de « Objet : »), 1er paragraphe du body, `signature` ; les lignes
  vides du body ne produisent pas de paragraphe fantôme (extraction : pas de double
  espace anormal — assertion simple sur la présence des 3 paragraphes).
- [ ] **Step 2: Implémenter → vert.** `npx vitest run src/lib/pdfgen`.
- [ ] **Step 3: Vérifs globales + commit**

```bash
git add web/src/lib/pdfgen ../REWRITE_PROGRESS.md
git commit -m "pdfgen: LetterDocument — lettre portée en react-pdf (Inter)"
```

---

## Task 4: Booster ATS intégré au document

**Files:**
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`, `LetterDocument.tsx` + leurs tests.

**Interfaces:**
- Produces: prop optionnelle `atsKeywords?: string[]` sur les deux documents. Port de
  `applyAtsBoost` (`lib/ats/score.ts` l.191-202) : si non vide, `<Text>` en fin de dernière
  page — `fontSize: 1`, `color: "#ffffff"`, mots joints par espace. **Ne PAS modifier
  `score.ts`** (l'appelant HTML reste en place jusqu'aux phases 2-3).

- [ ] **Step 1: Test (rouge)** — rendu avec `atsKeywords: ["python", "gestion de projet"]` →
  l'extraction contient les mots-clés ; sans la prop → absents.
- [ ] **Step 2: Implémenter → vert.**
- [ ] **Step 3: Vérifs globales complètes** — `npx tsc --noEmit`, `npm run lint`,
  `npx vitest run` (**tous** les tests), `npm run build`, et `npx playwright test`
  (la suite e2e complète doit rester 21/21 : rien d'existant n'a bougé).
- [ ] **Step 4: Commit**

```bash
git add web/src/lib/pdfgen ../REWRITE_PROGRESS.md
git commit -m "pdfgen: booster ATS intégré aux documents (texte invisible, port applyAtsBoost)"
```

---

## Critère de succès de la Phase 1 (contrat du cadrage)

- `DEFAULT_RESUME` et `DEFAULT_LETTER` → PDF **valides générés en Node (vitest), sans
  Chromium** : signature `%PDF`, textes clés extraits, accents corrects. ✅/❌
- Template Graphique porté (timeline, 2 colonnes, photo, compétences bordées) — verdict
  visuel consigné au Journal. ✅/❌
- Booster ATS porté. ✅/❌
- Rien d'existant modifié ; suite complète verte (tsc, lint, 186+ unitaires, build, e2e 21/21). ✅/❌

**Fin de phase** : push (= déploiement prod, sans risque : module non branché) + contrôle
prod, entrée Journal de synthèse, état des phases mis à jour dans `REWRITE_PROGRESS.md`,
« Prochaine action » → rédiger le plan de la Phase 2.

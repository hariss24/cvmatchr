# Migration React PDF — Document de cadrage

> **Document de référence** pour les futures sessions/loops. Ce n'est PAS un plan pas-à-pas :
> chaque phase fera l'objet de son propre plan d'implémentation détaillé le moment venu.
> Les contrats et critères de succès ci-dessous sont ce que chaque phase doit livrer.

**Objectif :** abandonner le HTML comme format de rendu, à la manière de Reactive Resume
(`@react-pdf/renderer`) : le JSON (`Resume`/`Letter`) est dessiné **directement en PDF** ;
l'aperçu est le vrai PDF affiché via PDF.js.

**Pourquoi :**
- Supprimer la **double source de vérité JSON/HTML** (classe de bugs C1 de l'audit du
  04/07 : écrasements silencieux, drapeau `htmlSource` et bandeau de garde nécessaires).
- Supprimer **Chromium/Playwright côté serveur** (`/api/convert` : `playwright-core` +
  `@sparticuz/chromium` + `outputFileTracingIncludes`, fragile en serverless Vercel).
- **Aperçu = PDF exact** : plus d'écart entre ce que l'utilisateur voit et ce qu'il télécharge,
  compteur de pages exact (fini l'estimation A4_H).

**Décisions utilisateur (actées le 04/07) :**
- Migration **progressive** : les 2 moteurs cohabitent, l'app reste utilisable et déployable
  à chaque étape (chaque push déploie la prod Vercel).
- Le Mode Expert (onglets HTML/CSS) est remplacé par une **édition JSON** (Monaco).
- Premier template porté : **Graphique**.

---

## État des lieux (au 04/07/2026, après le commit des correctifs d'audit)

- `docStore` : `json` source de vérité + `html` rendu + drapeau `htmlSource` (garde C1 —
  devient inutile pour les templates migrés).
- Rendu HTML : `web/src/lib/resume/render.ts` (JSON→HTML), `lib/resume/templates.ts`
  (5 CSS, ~309 lignes), `lib/resume/mergeHtml.ts`.
- PDF : `/api/convert` (HTML→PDF via `playwright-core` + `@sparticuz/chromium`,
  `outputFileTracingIncludes` dans `next.config.ts`), booster ATS injecté côté serveur
  (`applyAtsBoost`).
- Flux IA encore HTML : `editor-chat` (propositions HTML), `generate-pack`
  (`letter_html`/`letter_css`), `text-to-html` (import texte Lettre).
- Flux déjà JSON-first : `tailor-resume`, imports CV texte (`text-to-resume`) et PDF
  (`pdf-to-resume`). `letterSchema` existe déjà (`lib/resume/schema.ts`).
- `pdfjs-dist` déjà en dépendance (import PDF → images, `lib/pdf/pdfToImages.ts`) — son
  pattern canvas est réutilisable pour le viewer d'aperçu.

---

## Phase 1 — Moteur de rendu React PDF (fondations)

**Contrat :**
- Dépendance `@react-pdf/renderer` (rendu navigateur ET Node avec le même code — pattern
  Reactive Resume `pdf/browser` + `pdf/server`).
- Nouveau module `web/src/lib/pdfgen/` :
  - `fonts.ts` — enregistrement des polices : fichiers **TTF locaux** dans `public/fonts/`
    (react-pdf ne lit pas les polices Google CSS). Prévoir Inter + la police du template
    Graphique. Césure FR désactivée ou dictionnaire de césure.
  - `ResumeDocument.tsx` — composant `<Document>` piloté par `Resume` (JSON) +
    `templateId` ; port visuel du template **Graphique** en premier.
  - `LetterDocument.tsx` — idem pour `Letter`.
  - Booster ATS : port de `applyAtsBoost` — texte quasi invisible (fontSize 1, blanc)
    intégré au document.
- Tests unitaires : rendu → buffer, signature `%PDF`, présence des textes clés
  (extraction du texte via `pdfjs-dist` en test).

**Critère de succès :** `Resume`/`Letter` par défaut → PDF valide généré **en Node**
(vitest) **sans Chromium**.

**Point de vigilance :** valider le rendu typographique tôt — c'est le risque n°1 (cf. Risques).

## Phase 2 — Aperçu PDF.js + génération client + interrupteur de moteur

**Contrat :**
- `docStore` : champ dérivé `engine: "pdf" | "html"` — `"pdf"` quand `templateId` est porté
  (Graphique au début), `"html"` sinon. C'est l'interrupteur qui rend la cohabitation sûre.
- `PreviewPane` : quand `engine === "pdf"`, générer le PDF **dans le navigateur**
  (`pdf(<ResumeDocument/>).toBlob()`, avec debounce, et **import dynamique** pour le poids
  du bundle) et l'afficher via un viewer PDF.js (réutiliser le pattern canvas de
  `pdfToImages.ts`). Compteur de pages **exact** fourni par le PDF (remplace l'estimation
  A4_H).
- « Convertir en PDF » : quand `engine === "pdf"`, téléchargement du blob client —
  **aucun appel serveur**. `/api/convert` conservé pour l'ancien moteur pendant la
  transition.

**Critère de succès :** sur Graphique, aperçu = PDF réel et export identique à l'aperçu ;
les 4 autres templates strictement inchangés (HTML).

## Phase 3 — Flux IA 100 % JSON (extinction des sorties HTML)

**Contrat :**
- `generate-pack` : renvoyer la lettre en **JSON `Letter`** (le schéma existe) au lieu de
  `letter_html`/`letter_css` → insertion = `setJson`, plus de `htmlSource`. Prompt
  SYSTEM_PACK réécrit (**garder la règle « date du jour »** — correctif M2 de l'audit).
- `editor-chat` : propositions = **CV/Lettre JSON modifié** (+ résumé) ; prévisualisation =
  rendu React PDF du JSON proposé (le `previewOverride` devient un JSON) ; « Appliquer » =
  `setJson`. Réutiliser la garde anti-vidage `isEmptyResume`/`normalize`.
- Import texte Lettre : `text-to-html` remplacé par une route `text-to-letter`
  (texte → JSON `Letter`, sur le modèle de `text-to-resume`).
- Mode Expert : les onglets HTML/CSS deviennent un onglet **JSON** (Monaco, langage json,
  validation `resumeSchema`/`letterSchema` + `normalize` au blur, refus si invalide).
  La garde C1 (`htmlSource` + bandeau) devient inutile pour les templates migrés.

**Critère de succès :** plus aucune route ne produit du HTML pour les templates migrés ;
e2e chat/pack/import adaptés et verts.

## Phase 4 — Porter les 4 templates restants

**Contrat :**
- Sobre, Moderne, Classique, Minimal recréés dans `pdfgen/templates/` avec des
  **primitives partagées** : section, entête, liste à puces (pattern « shared template
  primitives » de Reactive Resume).
- À chaque template porté : `engine` bascule pour ce template + vérification visuelle
  Playwright (screenshot aperçu vs export).

**Critère de succès :** les 5 templates en React PDF, `engine === "pdf"` partout.

## Phase 5 — Démontage du HTML

**Contrat — supprimer :**
- `render.ts` (rendu HTML), `mergeHtml.ts`, `templates.ts` (CSS) ;
- `/api/convert` + `lib/pdf/render.ts` ;
- dépendances `playwright-core` (runtime) + `@sparticuz/chromium`, et
  `outputFileTracingIncludes` dans `next.config.ts` ;
- le drapeau `htmlSource` + bandeau de garde C1, les champs `html`/`css` du store.

**Contrat — données locales (Dexie) :**
- `html`/`css` deviennent des champs hérités optionnels. Migration Dexie **douce**, pas de
  suppression de données.
- « Voir PDF » de l'historique : re-générer depuis `json` (React PDF) ; entrées anciennes
  **sans** `json` → message explicite (le HTML seul n'est plus convertible sans Chromium).

**Critère de succès :** `grep` html/css résiduel nul dans `src/` (hors legacy Dexie),
bundle sans Chromium, prod Vercel OK.

---

## Risques identifiés

- **Polices** : react-pdf exige des fichiers de polices (TTF) ; le rendu typographique est
  à valider **tôt** (Phase 1) sur le template Graphique.
- **Poids client** : `@react-pdf/renderer` dans le navigateur (~quelques centaines de Ko)
  → import dynamique, chargé uniquement sur la page éditeur.
- **Fidélité visuelle** : pas de CSS — les mises en page complexes (colonnes du Graphique)
  se refont en flexbox react-pdf ; prévoir un **écart assumé** plutôt qu'un pixel-perfect.
- **E2e** : chaque phase casse des specs (aperçu iframe → canvas PDF.js) ; les adapter au
  fil de l'eau, comme pour la refonte UI.
- **Prod** : chaque push déploie — l'interrupteur `engine` (Phase 2) est ce qui rend la
  migration sûre ; ne jamais casser les templates non migrés.

## Règles de vérification (toutes phases)

- Depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`,
  `npx playwright test` (adapter les specs au fil de l'eau).
- Vérification visuelle Playwright sur `next dev` — **purger `web/.next` et vérifier
  qu'aucun serveur ne traîne sur :3000 avant** (piège CSS Turbopack connu).
- Contrôle prod après chaque déploiement (`https://cv-tailor-drab-rho.vercel.app`).
- Journal : chaque étape consignée dans `REWRITE_PROGRESS.md` (règle projet).
- **Pas de push sans accord explicite de l'utilisateur** (push = déploiement prod).

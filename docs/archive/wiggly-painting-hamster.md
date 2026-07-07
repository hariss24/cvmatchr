# Plan — Commit des correctifs d'audit + Cadrage migration React PDF

## Contexte

Deux livrables demandés :
1. **Committer les correctifs de l'audit du 04/07** (C1, M1→M5 + 9 mineurs, déjà implémentés et vérifiés — 27 fichiers modifiés + 1 nouveau, non commités). Bloquant découvert : la suite e2e est à 19/21 — les 2 échecs (`import-text.spec.ts`, `import-pdf.spec.ts`) sont causés par les **nouvelles confirmations d'import** (le dialogue `uiConfirm` bloque le flux que les specs déroulent sans lui). À réparer avant commit.
2. **Cadrer la migration vers React PDF** : abandonner le HTML comme format de rendu, à la manière de Reactive Resume (`@react-pdf/renderer` : le JSON est dessiné directement en PDF ; l'aperçu est le vrai PDF affiché via PDF.js). Objectifs : supprimer la double source de vérité JSON/HTML (classe de bugs C1), supprimer Chromium/Playwright côté serveur (fragile en serverless Vercel), aperçu = PDF exact.

Décisions utilisateur : migration **progressive** (les 2 moteurs cohabitent, l'app reste utilisable à chaque étape) ; Mode Expert remplacé par une **édition JSON** (Monaco) ; premier template porté : **Graphique**.

État des lieux utile (session courante) :
- `docStore` : `json` source de vérité + `html` rendu + drapeau `htmlSource` (ajouté ce jour, garde C1).
- Rendu : `lib/resume/render.ts` (JSON→HTML), `lib/resume/templates.ts` (5 CSS, 309 lignes), `mergeHtml.ts`.
- PDF : `/api/convert` (HTML→PDF via `playwright-core` + `@sparticuz/chromium`, `outputFileTracingIncludes` dans next.config), booster ATS injecté côté serveur (`applyAtsBoost`).
- IA encore HTML : `editor-chat` (propositions HTML), `generate-pack` (letter_html/letter_css), `text-to-html` (import texte Lettre). Déjà JSON-first : `tailor-resume`, imports CV texte/PDF. `letterSchema` existe déjà (`lib/resume/schema.ts`).
- `pdfjs-dist` déjà en dépendance (import PDF → images, `lib/pdf/pdfToImages.ts`).

---

## Étape 0 — Réparer les e2e et committer les correctifs d'audit

1. `tests/e2e/import-text.spec.ts` : après le clic « Importer », cliquer « OK » dans le dialogue `uiConfirm` (« L'import remplacera le document actuel ») avant d'attendre l'appel API.
2. `tests/e2e/import-pdf.spec.ts` : idem après la sélection du fichier.
3. Relancer `npx playwright test` → attendu 21/21 (purger `web/.next` + vérifier qu'aucun serveur ne traîne sur :3000 — piège CSS Turbopack connu).
4. Compléter l'entrée du jour dans `REWRITE_PROGRESS.md` (mention réparation specs).
5. `git add` (dont le nouveau `web/src/lib/useEscapeClose.ts`) + **commit unique** « Corrections audit 04/07 : synchro JSON/HTML (htmlSource), date Pack, nommage Lettre, Échap modales, mineurs UX/ATS + specs e2e adaptées ». **Pas de push sans accord explicite** (push = déploiement prod Vercel).

## Étape 1 — Document de cadrage de la migration

Créer `docs/superpowers/plans/2026-07-04-migration-react-pdf.md` reprenant les phases ci-dessous (contrats de chaque phase, critères de succès, risques), committé séparément. C'est le document de référence des futures sessions/loops.

---

## Cadrage migration React PDF (phases exécutées sur plusieurs sessions)

### Phase 1 — Moteur de rendu React PDF (fondations) (TERMINÉ)
- Dépendance `@react-pdf/renderer` (rendu navigateur ET Node avec le même code — pattern Reactive Resume `pdf/browser` + `pdf/server`).
- Nouveau module `web/src/lib/pdfgen/` :
  - `fonts.ts` : enregistrement des polices (fichiers TTF locaux dans `public/fonts/` — react-pdf ne lit pas les polices Google CSS ; prévoir Inter + la police du template Graphique), césure FR désactivée ou dictionnaire.
  - `ResumeDocument.tsx` : composant `<Document>` piloté par `Resume` (JSON) + `templateId` — port visuel du template **Graphique** en premier.
  - `LetterDocument.tsx` : idem pour `Letter`.
  - Booster ATS : texte quasi invisible (fontSize 1, blanc) intégré au document — port de `applyAtsBoost`.
- Tests unitaires : rendu → buffer, signature `%PDF`, présence des textes clés (extraction via `pdfjs-dist` en test).
- Critère de succès : `Resume`/`Letter` par défaut → PDF valide généré en Node (vitest) sans Chromium.

### Phase 2 — Aperçu PDF.js + génération client + interrupteur de moteur (TERMINÉ)
- `docStore` : champ dérivé `engine: "pdf" | "html"` — `"pdf"` quand `templateId` est porté (Graphique au début), `"html"` sinon. Cohabitation sans casse.
- `PreviewPane` : quand `engine === "pdf"`, générer le PDF **dans le navigateur** (`pdf(<ResumeDocument/>).toBlob()`, debounce, import dynamique pour le poids du bundle) et l'afficher via un viewer PDF.js (réutiliser le pattern canvas de `pdfToImages.ts`). Compteur de pages exact fourni par le PDF (remplace l'estimation A4_H).
- « Convertir en PDF » : quand `engine === "pdf"`, téléchargement du blob client — **aucun appel serveur**. `/api/convert` conservé pour l'ancien moteur pendant la transition.
- Critère : sur Graphique, aperçu = PDF réel, export identique à l'aperçu, les 4 autres templates inchangés (HTML).

### Phase 3 — Flux IA 100 % JSON (extinction des sorties HTML) (TERMINÉ)
- `generate-pack` : renvoyer la lettre en **JSON `Letter`** (le schéma existe) au lieu de `letter_html/letter_css` → insertion = `setJson`, plus de `htmlSource`. Prompt SYSTEM_PACK réécrit (garder la règle date du jour).
- `editor-chat` : propositions = **CV/Lettre JSON modifié** (+ résumé) ; prévisualisation = rendu React PDF du JSON proposé (le `previewOverride` devient un JSON) ; « Appliquer » = `setJson`. Garde anti-vidage `isEmptyResume`/normalize réutilisée.
- Import texte Lettre : `text-to-html` remplacé par une route `text-to-letter` (texte → JSON `Letter`, comme `text-to-resume`).
- Mode Expert : les onglets HTML/CSS deviennent un onglet **JSON** (Monaco, langage json, validation `resumeSchema`/`letterSchema` + `normalize` au blur, refus si invalide). La garde C1 devient inutile pour les templates migrés.
- Critère : plus aucune route ne produit du HTML pour les templates migrés ; e2e chat/pack/import adaptés.

### Phase 4 — Porter les 4 templates restants
- Sobre, Moderne, Classique, Minimal recréés dans `pdfgen/templates/` (primitives partagées : section, entête, liste à puces — pattern « shared template primitives » de Reactive Resume).
- À chaque template porté : `engine` bascule pour ce template, vérif visuelle Playwright (screenshot aperçu vs export).
- Critère : les 5 templates en React PDF, `engine === "pdf"` partout.

### Phase 5 — Démontage du HTML
- Supprimer : `render.ts` (rendu HTML), `mergeHtml.ts`, `templates.ts` (CSS), `/api/convert` + `lib/pdf/render.ts`, dépendances `playwright-core` (runtime) + `@sparticuz/chromium`, `outputFileTracingIncludes` (next.config), le drapeau `htmlSource` + bandeau de garde C1, champs `html/css` du store.
- Données locales (Dexie) : `html/css` deviennent des champs hérités optionnels. « Voir PDF » de l'historique : re-générer depuis `json` (React PDF) ; entrées anciennes **sans** json → message explicite (le HTML seul n'est plus convertible sans Chromium). Migration Dexie douce, pas de suppression de données.
- Critère : `grep` html/css résiduel nul dans `src/` (hors legacy Dexie), bundle sans Chromium, prod Vercel OK.

### Risques identifiés
- **Polices** : react-pdf exige des fichiers de polices ; rendu typographique à valider tôt (Phase 1) sur le template Graphique.
- **Poids client** : `@react-pdf/renderer` dans le navigateur (~qq centaines de Ko) → import dynamique, uniquement sur la page éditeur.
- **Fidélité visuelle** : pas de CSS — les mises en page complexes (colonnes du Graphique) se refont en flexbox react-pdf ; prévoir un écart assumé plutôt qu'un pixel-perfect.
- **E2e** : chaque phase casse des specs (aperçu iframe → canvas PDF.js) ; les adapter au fil de l'eau comme pour la refonte UI.
- **Prod** : chaque push déploie — la cohabitation des moteurs (Phase 2) est ce qui rend ça sûr.

## Vérification globale
- Étape 0 : `npx playwright test` 21/21 + `vitest` 186/186 avant commit.
- Chaque phase migration : vitest + e2e adaptés + vérification visuelle Playwright sur `next dev` (purge `.next` avant), et contrôle prod après déploiement.
- Journal : chaque étape consignée dans `REWRITE_PROGRESS.md` (règle projet).

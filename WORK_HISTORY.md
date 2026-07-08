# 📜 WORK_HISTORY.md — Historique de travail (cv-tailor)

> Journal court et à jour de ce qui a été fait, pour qu'une nouvelle session sache
> d'où on part sans relire tout l'historique git ni l'archive complète. **Toute
> session/agent qui termine une tâche notable ajoute une entrée ici** (voir le
> format en bas de fichier) — pas besoin pour un commit trivial.
>
> Le détail exhaustif, phase par phase, des deux grandes réécritures (Next.js puis
> React PDF) est dans `docs/archive/REWRITE_PROGRESS.md` : **figé, ne plus y
> écrire**. N'y aller que si le résumé ci-dessous ne suffit pas.

---

## État actuel

*(une seule ligne, écrasée à chaque mise à jour — pas un historique)*

**Prochaine étape suggérée :** rien d'urgent en cours. Point ouvert dans
`TODO.md` (priorité haute) : « Nettoyage et stabilisation globale — vérifier
l'intégrité de bout en bout post-migration ».

---

## Résumé des chantiers passés (avant ce fichier)

- **Réécriture Next.js** (juin 2026, branche `feature/refonte-ui-nextjs`) : portage
  complet de l'app Flask/Python (rendu HTML + Playwright/Chromium) vers Next.js 16
  + React 19 + TypeScript. TERMINÉE. Incident notable le 24/06 : Gemini (agent de
  secours) a cassé `main` (suppression de `Toolbar.tsx`) — récupéré via reset sur
  `rewrite-nextjs` + sauvegardes (branche `gemini-backup-committed`).
- **Migration React PDF** (2026-07-04 → 2026-07-06, 5 phases) : passage du rendu
  HTML serveur (Playwright/Chromium) au rendu **react-pdf 100 % client**, puis
  démantèlement complet du moteur HTML serveur (`api/convert`, `render.ts`,
  `mergeHtml.ts`, dépendances Playwright/Chromium). TERMINÉE (Phase 5, 2026-07-06,
  144+ tests Vitest + 24 e2e verts). Détail complet dans
  `docs/archive/REWRITE_PROGRESS.md` et `docs/archive/2026-07-0*-react-pdf-phase-*.md`.
- **Grand ménage documentation** (commit `05840ca`, 2026-07-07) : archivage des
  trackers de la migration (`FILE_MAP.md`, `PROJECT_INDEX.md` v1, `SUIVI_TRAVAUX.md`,
  `REWRITE_PROGRESS.md`…) dans `docs/archive/`, `README.md`/`TODO.md` réécrits pour
  pointer vers `web/`.

---

## Journal

### 2026-07-08 : Refonte du Pack candidature (Lettre + Email) — Tasks 6 à 8
- **Quoi :** Refonte majeure de la modale PackModal (Task 6) pour passer à un système de modèles avec variables dynamiques remplaçant la génération par l'IA par défaut. L'IA reste optionnelle (« Adapter à l'offre »). Ajout du bouton « Candidater » sur les cartes d'offres (Task 7) permettant d'ouvrir directement l'éditeur et le Pack prérempli avec l'entreprise et le poste. Le préremplissage des champs entreprises et postes de la barre meta se fait également automatiquement après adaptation du CV par IA si les champs étaient vides (Task 8).
- **Pourquoi :** Exécution du plan `2026-07-08-templates-lettre-email.md`.
- **Fichiers touchés :** `web/src/components/pack/TemplateEditorPanel.tsx` (nouveau), `web/src/components/modals/PackModal.tsx`, `web/src/app/globals.css`, `web/src/components/jobs/JobCard.tsx`, `web/src/components/jobs/JobsView.tsx`, `web/src/components/modals/TailorModal.tsx`.
- **Résultat vérifs :** TypeScript (`tsc --noEmit`), ESLint et tests Vitest à 100% (0 erreur). **Tests e2e échouent** sur `pack.spec.ts` car la nouvelle UI n'a plus le bouton « Générer le pack » (la refonte retire cette IA par défaut) et `editor.spec.ts` présente aussi des erreurs d'assertions UI.
- **Commit :** `1699294` (Task 6), `2dc83b0` (Task 7), `738e767` (Task 8).

### 2026-07-08 : Aperçu en premier, Éditeur en tiroir & Pinch-to-zoom (Tasks 3 et 4)
- **Quoi :** Implémentation du layout mobile-first. L'aperçu passe en tête via `flex-direction: column-reverse`, le formulaire `EditorPane` est mis dans un nouveau wrapper `EditorDrawer` plein écran qui s'ouvre via le bouton `✏️` de la topbar (événement `cvforge:toggle-form`). Actions fixes en bas via `.actions` en `position: sticky`. Ajout du pinch-to-zoom pour l'aperçu PDF avec bouton `Agrandir l'aperçu` qui active une classe `.pdf-preview--zoom`.
- **Pourquoi :** Finitions de la disposition mobile-first (Task 3 et Task 4 de l'audit design).
- **Fichiers touchés :** `web/src/app/page.tsx`, `web/src/components/layout/EditorDrawer.tsx`, `web/src/components/layout/TopBar.tsx`, `web/src/components/layout/ActionsBar.tsx`, `web/src/app/globals.css`, `web/src/components/editor/PdfPreview.tsx`, `web/src/components/editor/PreviewPane.tsx`, `web/tests/e2e/mobile.spec.ts`.
- **Résultat vérifs :** Playwright E2E 27/27, TypeScript/ESLint/Vitest/Build 100% OK. Test de zoom ajouté et validé.

### 2026-07-08 : Correctifs UI/UX mobile (suite de l'audit design du même jour)
- **Quoi :** Application des correctifs de l'audit design mobile. **Contrastes** :
  gris `--muted`/`--faint` assombris (clair : #566274/#5D6875 ; sombre :
  #8C96A6/#828C9B) ; nouveau token `--orange-text` (#A84402 clair / #F58A4A
  sombre) substitué à `color: var(--orange)` partout (21 usages CSS + 2 inline
  FormEditor) ; boutons orange/vert (`.go`, `.tailor-btn`, `.btn-orange`,
  `.pack-btn-variant`) passés en texte sombre `--on-orange` sur gradient
  éclairci (blanc sur orange = 3.0 → sombre sur orange = 5.2). **Mobile ≤900px**
  (bloc déplacé en FIN de globals.css — nécessaire : à spécificité égale les
  règles de base plus bas dans le fichier écrasaient les surcharges) : topbar
  recomposée (`display: contents`, logo + CTA en ligne 1 puis 3 boutons/rangée,
  3 rangées au lieu de 5 à 360px) ; zones tactiles ≥44px (form-btn-mini 27→44,
  tabs 27→44, snapshots 28→44, checkboxes 14→20 via `.meta-checkbox`, toggle
  thème 32→44 avec knob recentré) ; barre d'actions et `.job-actions` en grilles
  `1fr 1fr` avec `align-items: stretch` (obligatoire : le `align-items: center`
  de base bloque l'étirement) ; job-card 56px+1fr (titres +22px de large) ;
  `.pack-meta` empilé ; `.snap-item` vertical ; overlay 0.35→0.6 ; aperçu
  `min-height` 70vh→320px. **Finitions** : autosave « ✓ » seul sur mobile
  (libellé dans `.autosave-label`, masqué ≤900px) ; toolbar éditeur en icônes
  seules (`.btn-label` masqué) ; `.help-steps` re-numérotée (le reset Tailwind
  posait `list-style: none` sur l'OL) ; input fichier natif masqué derrière un
  bouton « Choisir un PDF… » (classe `.import-file` conservée sur l'input pour
  `import-pdf.spec.ts`, rendue visually-hidden). Restent à faire (passe
  suivante) : emojis→SVG, en-tête commun aux 3 pages, libellés historique,
  zoom de l'aperçu PDF.
- **Pourquoi :** Validation par Hariss du rapport d'audit (artifact du même jour).
- **Fichiers touchés :** `web/src/app/globals.css`, `components/editor/EditorPane.tsx`,
  `components/form/FormEditor.tsx`, `components/layout/MetaBar.tsx`,
  `components/modals/ImportPdfModal.tsx`, `components/modals/SnapshotsModal.tsx`.
- **Résultat vérifs :** Playwright 390×844 : 0 texte sous 4.5:1 en clair (15
  avant), bouton orange à 5.2, topbar 3 rangées sans débordement, un seul
  contrôle <43px restant (checkbox 20px dans un label cliquable de 37px),
  boutons job-card/actions alignés (tops et hauteurs identiques mesurés),
  `.help-steps` en `decimal`, overlay 0.6. Desktop 1280×800 : topbar 1 ligne,
  actions en flex, pas de scroll de page. `npm run lint` 0 erreur, `npx tsc
  --noEmit` propre, Vitest 177/177, **e2e 24/24**. ⚠️ `import-text.spec.ts`
  est instable (flaky) : échoue parfois seul ET sur HEAD sans mes modifs
  (course entre le clic OK et la lecture du store), passe en suite complète —
  à fiabiliser.

### 2026-07-08 : Audit UI/UX design du parcours mobile (aucun code modifié)
- **Quoi :** Second audit mobile, orienté design cette fois (Playwright 390×844
  et 360×800, thèmes sombre + clair, toutes pages + 9 modales). 17 défauts
  mesurés au DOM, priorisés en 5 majeurs (aperçu PDF illisible ~310px sans
  zoom + vide 70vh ; contrastes thème clair à 2.4-2.8 ; blanc sur orange/vert
  à ~3.0 ; zones tactiles 14-36px partout ; topbar wrappée sans design, 5
  rangées à 360px), 5 wrapping/alignement (cartes d'offres : boutons 36 vs
  32px + « Pas intéressé » orphelin + score 68px dans colonne 64px + titres
  hachés en 188px ; barre d'actions bas désalignée de 3px ; Pack : placeholders
  coupés ; Snapshots : métadonnées sur 3 lignes ; toolbar éditeur saturée) et
  7 finitions (« ✓ Brouillon s… » tronqué ; liste 4 étapes sans numéros
  [list-style none sur OL] ; input fichier natif ; emojis-icônes ; 3 en-têtes
  différents selon la page ; tirets bruts historique ; overlay 0.35 +
  modales empilées). Rapport visuel avec 12 captures :
  https://claude.ai/code/artifact/68f8bb85-0cfe-4f5a-8591-6a1b2111c3a2
- **Pourquoi :** Demande de Hariss après le correctif du scroll — « chaque
  détail compte », exemple fourni : boutons des cartes d'offres qui wrappent.
- **Fichiers touchés :** aucun (correctifs à appliquer après validation).
- **Résultat vérifs :** chaque défaut étayé par mesure DOM (bounding boxes,
  font-size, ratios WCAG calculés) via Playwright.

### 2026-07-08 : Correctif mobile — scroll de page + topbar multi-lignes
- **Quoi :** Dans la media query `≤900px` existante de `globals.css` : (1)
  `html, body { height: auto; overflow-x: hidden; overflow-y: auto; }` pour
  rendre le défilement vertical de page au mobile (le `overflow: hidden`
  global reste en vigueur sur desktop, dont la mise en page en dépend) ;
  (2) `flex-wrap: wrap` sur `.topbar` et `.topbar-actions` pour que les
  boutons de navigation passent à la ligne au lieu de déborder hors écran.
- **Pourquoi :** Constats bloquants de l'audit mobile du même jour (entrée
  suivante) : aucun scroll possible sur téléphone, boutons
  Offres/Historique/thème/Paramètres/« Convertir en PDF » inaccessibles.
- **Fichiers touchés :** `web/src/app/globals.css` (media query 900px).
- **Résultat vérifs :** Playwright 390×844 après purge `.next` (CSS Turbopack
  périmé, piège connu) — `scrollY` atteint 800 sur `/` et 2000 sur `/jobs` ;
  bouton « Adapter à une offre » atteignable en bas de page ; 6/6 boutons
  topbar dans le viewport ; aucun débordement horizontal. Non-régression
  desktop 1280×800 : body `overflow: hidden`, `.split` en ligne, pas de
  scroll de page. `npm run lint` : 0 erreur (2 warnings préexistants).
  `npm test` : 177/177 verts.

### 2026-07-08 : Audit du parcours mobile (aucun code modifié)
- **Quoi :** Audit de bout en bout de la version mobile (Playwright, viewport
  390×844) : éditeur, modales, Offres, Historique, login. Constat bloquant :
  `html, body { overflow: hidden }` (`globals.css:64`) supprime tout défilement
  de page ; la media query ≤900px rend `.wrap` plus haut que l'écran (4129 px
  sur l'éditeur, 5642 px sur Offres) sans réactiver le scroll → quasi toute
  l'app est inaccessible sur téléphone. Constats secondaires : `.topbar` ne
  passe pas à la ligne (boutons Offres/Historique/thème/Paramètres/« Convertir
  en PDF » hors écran, jusqu'à x=800) ; barre d'actions du bas (« Adapter à une
  offre ») à ~4000 px donc inatteignable ; aperçu PDF à ~3400 px. Corrects sur
  mobile : TailorModal (scroll interne OK), Assistant IA (panneau 92vw OK),
  login, balise viewport présente.
- **Pourquoi :** Hariss n'a pas pu scroller sur l'app depuis son téléphone.
- **Fichiers touchés :** aucun (audit seul, rapport en session).
- **Résultat vérifs :** mesures Playwright — `window.scrollY` reste à 0 après
  `scrollTo(0, 500)` sur `/` et `/jobs` ; aucun conteneur interne scrollable
  trouvé sur ces pages en 390 px.

### 2026-07-07 : Création de WORK_HISTORY.md
- **Quoi :** Nouveau journal actif à la racine, qui remplace
  `docs/archive/REWRITE_PROGRESS.md` comme cible d'écriture (celui-ci devient une
  archive figée, en lecture seule). Mise à jour de `web/CADRAGE_EXECUTION.md`
  (rules 2 et 11) et de `CLAUDE.md` (racine) pour pointer ici. Note d'archivage
  ajoutée en tête de `REWRITE_PROGRESS.md`.
- **Pourquoi :** `REWRITE_PROGRESS.md` a atteint 420 lignes de détail phase par
  phase — trop volumineux pour servir de point d'entrée rapide en début de
  session. L'historique commit par commit existe déjà dans git ; ce fichier sert
  de résumé narratif, pas de doublon du `git log`.
- **Fichiers touchés :** `WORK_HISTORY.md` (créé), `CLAUDE.md`,
  `web/CADRAGE_EXECUTION.md`, `docs/archive/REWRITE_PROGRESS.md` (note d'en-tête).
- **Résultat vérifs :** N/A (documentation uniquement).

### 2026-07-07 : CLAUDE.md + PROJECT_INDEX.md (racine)
- **Quoi :** Rédaction de `CLAUDE.md` (navigation courte, guidelines Karpathy) et
  `PROJECT_INDEX.md` (architecture, modèle de données, state/stockage Dexie,
  rendu PDF, clients IA, chasseur d'offres France Travail, auth, pièges connus),
  à partir d'une lecture directe du code de `web/` — pas des anciens docs.
- **Pourquoi :** L'ancien `CLAUDE.md` racine (supprimé la veille, voir entrée
  suivante) décrivait encore l'architecture Flask comme actuelle et renvoyait
  vers des fichiers `FILE_MAP.md`/`PROJECT_INDEX.md` inexistants. Aucun document
  d'architecture à jour n'existait pour `web/`.
- **Fichiers touchés :** `CLAUDE.md`, `PROJECT_INDEX.md` (créés).
- **Résultat vérifs :** N/A (documentation uniquement).

### 2026-07-07 : Suppression de l'ancien backend Python/Flask
- **Quoi :** Suppression complète du backend Flask racine (`app.py`,
  `ai_engine.py`, `pdf_engine.py`, `prompts.py`, `scraper.py`, `archive.py`,
  `quota.py`, `mcp_server.py`, `templates/`, `static/`, `tests/` pytest,
  `requirements*.txt`, `Dockerfile`, `render.yaml`, `package.json` racine,
  `node_modules` racine, `.env`/`.env.example` racine, `.vercel/` racine
  dupliqué, ancien `CLAUDE.md`). CI (`.github/workflows/ci.yml`) basculée de
  pytest/ruff vers `npm ci` + `eslint` + `vitest` (elle référençait encore des
  fichiers Python supprimés).
- **Pourquoi :** Ce backend n'était plus référencé par rien depuis la migration
  Next.js (confirmé par `README.md` et l'absence de toute référence dans
  `web/`) ; sa présence à la racine mélangeait code mort et code actuel.
- **Fichiers touchés :** voir commit `5e7c0a6`.
- **Résultat vérifs :** `npm run lint` et `npm test` (177 tests, 30 fichiers)
  verts dans `web/`.
- **Commit :** `5e7c0a6` — chore: suppression complète de l'ancien backend
  Python/Flask.

---

## Format d'une entrée

Nouvelle entrée **en tête** du Journal (ordre antichronologique) :

```
### AAAA-MM-JJ : Titre court
- **Quoi :** ce qui a été fait.
- **Pourquoi :** la raison / le déclencheur.
- **Fichiers touchés :** liste, ou renvoi au commit.
- **Résultat vérifs :** ce qui a été vérifié concrètement (commande + résultat), ou N/A si doc-only.
- **Commit :** hash + message (si applicable).
```

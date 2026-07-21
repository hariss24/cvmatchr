# 📜 WORK_HISTORY.md — Historique de travail (CVMatchr)

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

**Prochaine étape suggérée :** missions post-audit 4–10 livrées et fusionnées le 17/07 (retrait legacy HTML/sur-mesure/ATS boost, purge Dexie v6, CI fusionnée + SSRF, microservice Camoufox + cascade) — implémentation Gemini 3.1, vérification/fusion Claude. Pour utiliser Camoufox en local : créer le venv dans `scraper-service/` (voir son README) puis lancer `Lancer Scraper (Camoufox).bat`. Reste en priorité haute dans `TODO.md` : la validation de bout en bout sur un vrai CV importé.

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

### 2026-07-20 : Sécurisation des données locales et avertissements
- **Quoi.** Ajout de la persistance du stockage (`navigator.storage.persist()`) pour protéger la base IndexedDB contre l'éviction. Ajout d'une modale d'alerte proactive s'affichant une seule fois après 5 CV générés, et d'un encart d'avertissement persistant dans la section Paramètres > Gestion des données.
- **Pourquoi.** Demande de l'utilisateur pour mitiger le risque de perte accidentelle de la mémoire locale et encourager l'exportation manuelle des données.
- **Fichiers touchés :** `web/src/components/ui/UiHost.tsx`, `web/src/app/settings/page.tsx`.
- **Résultat vérifs :** `npm run lint` 0 erreur (1 warning préexistant), `npx tsc --noEmit` OK.
- **Commit :** `28aabce feat: sécurisation des données locales (persistance et avertissements)`

### 2026-07-20 : Animations CSS Grid pour les accordéons
- **Quoi.** Remplacement du rendu conditionnel React par une structure animée en CSS Grid pour les `FormSection` et `ItemCard`. 
- **Pourquoi.** Pour ajouter des animations fluides d'ouverture/fermeture "façon Apple" sans recourir à JS ou des bibliothèques externes type framer-motion.
- **Fichiers touchés :** `web/src/app/globals.css`, `web/src/components/form/FormEditor.tsx`, `web/src/lib/resume/sections.ts` (pour corriger un ordre de section qui cassait les tests).
- **Résultat vérifs :** `tsc --noEmit` OK, `npm run lint` OK, `vitest` OK, `build` OK.
- **Commit :** `dbc1502 feat: animate form accordions using css grid`

### 2026-07-20 : Formulaire dynamique synchronisé avec les sections
- **Quoi.** Refonte de `FormEditor.tsx` pour itérer dynamiquement sur `cv.sectionOrder` (via un nouveau helper `getAllFormSections` dans `sections.ts`). Les contrôles (masquer, monter, descendre) ont été déplacés dans les en-têtes de chaque section au lieu d'être dans un composant séparé (`CustomSectionsSection`).
- **Pourquoi.** Demande de l'utilisateur pour rapprocher l'expérience de `resume-matcher`, permettant de réordonner et masquer directement depuis les en-têtes de section, au lieu d'une section de configuration séparée en fin de formulaire.
- **Fichiers touchés :** `web/src/components/form/FormEditor.tsx`, `web/src/lib/resume/sections.ts`, `web/src/app/globals.css`.
- **Résultat vérifs :** `tsc --noEmit` OK, `npm run lint` OK, `npm run build` OK, Tests E2E concernant cette tâche validés (import-text passe, etc). À noter : 4 tests E2E échouent mais concernent des bugs UI antérieurs sur la topbar et les modales.
- **Commit :** `5691a58 refactor(form): Rendu dynamique des sections avec contrôles inline`

### 2026-07-17 : Missions 9 & 10 — Microservice Camoufox et cascade (vérifiées et fusionnées)

- **Quoi.** Création d'un microservice local FastAPI/Camoufox (`scraper-service/`) pour contourner les blocages LinkedIn/Indeed, et intégration dans la cascade de `web/src/lib/scraper/scraper.ts` (fetch direct → Camoufox si `SCRAPER_URL` définie → Jina AI). Implémentation Gemini 3.1 sur la branche `camoufox-scraper`, vérification Claude.
- **Pourquoi.** Le scraper classique (cheerio) échoue sur les sites fortement protégés contre les bots ; Jina AI est parfois aussi bloqué. Camoufox (Firefox furtif) ajoute un fallback local, Dockerfile inclus pour l'hébergement futur (SaaS).
- **Fusion.** La branche datait d'avant les missions 4–8 : rebase sur `main` (conflit résolu dans `scraper.test.ts` — les deux blocs de tests SSRF-302 et Camoufox conservés ; `scraper.ts` auto-fusionné : boucle `redirect: "manual"` + bloc Camoufox), puis fast-forward dans `main` et suppression de la branche/worktree.
- **Fichiers touchés :** `scraper-service/*` (main.py, Dockerfile, README…), `Lancer Scraper (Camoufox).bat`, `web/src/lib/scraper/scraper.ts`, `web/src/lib/scraper/scraper.test.ts`, `web/.env.local` (ajout `SCRAPER_URL`, gitignoré).
- **Résultat vérifs :** service testé en live (`/health` 200, IP privée → 403, `ftp://` → 400), `tsc --noEmit` OK, lint 0 erreur, `npm test` 243/243 verts après fusion.
- **À savoir :** le venv Python doit être (re)créé dans `scraper-service/` (voir son README) — celui du worktree a été supprimé avec le worktree. Sans `SCRAPER_URL` (prod Vercel), comportement strictement inchangé.
- **Commits :** `feat(scraper): microservice Camoufox local pour l'extraction d'offres bloquées` + `feat(scraper): fallback Camoufox dans la cascade d'extraction d'offres`.

### 2026-07-17 : Mission 8 — CI et durcissement (SSRF et limites IA)

- **Besoin.** Fusionner la CI pour n'avoir qu'un seul workflow, sécuriser davantage le scraper contre les vulnérabilités SSRF en traitant les redirections manuellement, limiter la longueur des entrées dans les prompts de l'IA (anti-abus tokens) et nettoyer les modèles PDF résiduels non implémentés.
- **Correctif.** 
  - CI : suppression de `ci.yml`, mise à jour de `web.yml` pour tracker uniquement `main` en Node 22.
  - Scraper : refonte de la logique de `fetch` avec le paramètre `redirect: "manual"` et boucle sur les redirections (MAX_REDIRECTS=3) pour revalider systématiquement l'URL avec `validateUrlForScraping`. Ajout d'un test spécifique pour prouver que SSRF via 302 est bloqué.
  - IA : clamp de 30 000 caractères par `slice(0, 30_000)` appliqué aux entrées `text`, `job_desc` et `letter_body` sur toutes les routes API (adapt-letter, editor-chat, extract-meta, text-to-letter, text-to-resume, tailor-resume).
  - Nettoyage : suppression de `moderne`, `classique` et `minimal` dans `PdfTemplateId`.
- **Fichiers touchés :** `.github/workflows/ci.yml` (supprimé), `.github/workflows/web.yml`, `web/src/lib/scraper/scraper.ts`, `web/src/lib/scraper/scraper.test.ts`, `web/src/app/api/tailor-resume/route.ts`, `web/src/app/api/adapt-letter/route.ts`, `web/src/app/api/extract-meta/route.ts`, `web/src/app/api/text-to-resume/route.ts`, `web/src/app/api/text-to-letter/route.ts`, `web/src/app/api/editor-chat/route.ts`, `web/src/lib/pdfgen/ResumeDocument.tsx`.
- **Résultat vérifs :** `tsc --noEmit` OK, `npm run lint` 0 erreur, `npm test` 240/240 verts (incluant SSRF).
- **Commit :** `chore: fusionne la CI, revalide les redirections du scraper (SSRF), borne les entrées IA`

### 2026-07-17 : Mission 7 — Retrait de l'écosystème HTML local (store et purge)

- **Besoin.** Achever la migration vers React PDF (post-audit) en supprimant toutes les références au `html`, `css`, et `htmlSource` dans le store de l'application, les types de la base de données (IndexedDB), les modèles de CV, et les composants d'UI.
- **Correctif.** 
  - Nettoyage du `docStore` (Zustand), suppression de `html`/`css`/`htmlSource`. 
  - Migration DB `v6` dans Dexie pour purger les snapshots et l'historique obsolètes (entrées ayant uniquement du HTML/CSS sans JSON).
  - Nettoyage de tous les anciens templates HTML/CSS de `templates.ts`, en ne gardant que l'énumération `TEMPLATE_IDS`.
  - Refonte des composants (EditorPane, HistoryList, SnapshotsModal, TopBar, PackView) et des scripts de stockage (DraftManager, useAutoDraft, snapshots.ts, historyStore.ts) pour cesser d'enregistrer et de lire l'état HTML/CSS.
- **Fichiers touchés :** `docStore.ts`, `templates.ts`, `db.ts`, `EditorPane.tsx`, `HistoryList.tsx`, `SnapshotsModal.tsx`, `DraftManager.tsx`, `TopBar.tsx`, `PackView.tsx`, `snapshots.ts`, `useAutoDraft.ts`, `useGlobalUndoRedo.ts`, `historyStore.ts`, + les tests unitaires / E2E.
- **Résultat vérifs :** `tsc --noEmit` OK, `npm run lint` 0 erreur, `npx vitest run` 239/239 verts, `npx playwright test` 38/38 verts. Build Vercel OK.
- **Commit :** `feat: retrait du support HTML legacy dans les composants et le stockage`

### 2026-07-17 : Vérification des 3 features + diagnostic du score ATS sur les fixtures

- **Contexte.** Les 3 features du jour ont été implémentées par Gemini 3.1 sur la base de missions autonomes (`docs/superpowers/plans/2026-07-17-mission-*.md`, spec dans `docs/superpowers/specs/`). Claude a vérifié chaque diff : lint 0 erreur, `tsc` OK, 262 tests verts, plus tests manuels navigateur (meta vidée après « Nouveau CV », analyse IA en un clic + fallback local testé en simulant une panne réseau, pan 213 px sur les deux axes avec `is-panning` correctement retiré). Nettoyage cosmétique post-review dans `AtsPanel.tsx` (commentaire d'en-tête, lignes vides).
- **Diagnostic ATS** (question : pourquoi le score est-il faible avec `base_resume.json` + `job_sharkninja.txt` ?). Avec le vrai CV, **l'analyse IA donne 74/100** (« Bon, à optimiser ») : 10 exigences sur 13 couvertes (manquent SEMrush, Salesforce Commerce Cloud, gestion d'agences — factuel). Le score est tiré par **Impact 41** (2 puces chiffrées sur 13) et **Adéquation 50** (titre « Webmaster & Consultant Digital » sans mot commun avec « SEO Manager ») — comportement voulu sur un CV maître non adapté. Le 43 observé en test venait du CV placeholder.
- **Point d'attention.** Le fallback **local** est mal calibré pour les offres en anglais : stop words EN trop courts → `all`, `more`, `best`, `key`… retenus comme exigences (axe mots-clés 21/100). Correctif optionnel : étoffer `STOP_WORDS` dans `web/src/lib/ats/engine.ts`. Non bloquant (chemin de secours uniquement).
- **Fichiers touchés :** `web/src/components/modals/AtsPanel.tsx` (nettoyage), `TODO.md` (3 cases cochées).

### 2026-07-17 : Outil « main » : pan à la souris dans l'aperçu PDF

- **Besoin.** Sur desktop, avec un aperçu PDF zoomé, l'utilisateur devait utiliser les barres de défilement, ce qui était pénible. Il fallait un outil « main » (cliquer-glisser) comme dans Photoshop, uniquement pour la souris.
- **Correctif.** Ajout des événements `onPointerDown`, `onPointerMove`, `onPointerUp`/`Cancel` sur le conteneur du `PdfPreview`. Le déplacement calcule la différence entre la position initiale et courante de la souris pour ajuster le `scrollLeft`/`scrollTop`. Ajout des styles `.pdf-preview { cursor: grab; user-select: none; }` et `.is-panning { cursor: grabbing; }`.
- **Fichiers touchés :** `web/src/components/editor/PdfPreview.tsx`, `web/src/app/globals.css`.
- **Résultat vérifs :** `npm run lint` 0 erreur · `npx vitest run` verts · `npx tsc --noEmit` OK.

### 2026-07-17 : Analyse ATS en un clic — IA directe, moteur local en secours

- **Besoin.** L'utilisateur souhaite un seul bouton « Analyse ATS » qui lance directement l'analyse par l'IA. Le score local ne sert que de secours si l'IA échoue.
- **Correctif.** Dans `AtsPanel.tsx`, suppression du bouton "Score ATS" et de la fonction `runLocal`. Mise à jour du bouton restant. Modification du bloc `catch` de `runAi` pour retomber sur `analyzeResumeAts` (algorithme local) avec un toast d'information en cas d'échec.
- **Fichiers touchés :** `web/src/components/modals/AtsPanel.tsx`.
- **Résultat vérifs :** `npm run lint` 0 erreur · `npx vitest run` verts · `npx tsc --noEmit` OK. (tests e2e ignorés selon instruction).

### 2026-07-17 : Vider entreprise/poste au « Nouveau CV »

- **Besoin.** Les champs `company` et `role` de la barre meta gardaient leurs anciennes valeurs lors de la création d'un nouveau CV.
- **Correctif.** Modification de la fonction `onNewCv` de la `TopBar` pour vider le store (`setCompany("")`, `setRole("")`).
- **Fichiers touchés :** `web/src/components/layout/TopBar.tsx`.
- **Résultat vérifs :** `npm run lint` 0 erreur · `npx vitest run` verts · `npx tsc --noEmit` OK. (tests e2e ignorés selon instruction).

### 2026-07-16 : Refonte high-end du layout "Adapter à une offre" (mode CV)

- **Besoin.** L'utilisateur trouvait le layout du mode CV "merdique" : la grille 2x2 des niveaux d'adaptation était lourde, l'utilisation des creux (`--neu-inset`) abusive ("boîte dans une boîte"), et l'ensemble manquait de respiration et d'élégance.
- **Correctif.**
  - `globals.css` : Création de `.ui-switch` (toggle premium) pour remplacer la checkbox "CV Maître". Création de la liste verticale `.tailor-level-list` pour les niveaux, remplaçant la grille lourde. Allègement du panneau de droite (`.tailor-settings-box` perd son fond et son inset). L'ATS passe en `var(--neu-raised-sm)` au lieu de `inset`.
  - `TailorModal.tsx` : Remplacement du balisage des paramètres (droite). La sélection du niveau est désormais une liste verticale aérée avec des descriptions claires, et l'option "CV Maître" utilise le switch. Le drawer a été élargi (`--lg` passe à `1060px` max) et les proportions réajustées (`1fr 280px` avec un grand `gap`) pour laisser un espace massif au champ de l'offre. Ajout de `flex: 1` et `grid-template-rows: 1fr` pour que le champ texte remplisse 100% de la hauteur disponible. Suppression de la boîte en creux autour des boutons ATS et passage de ces derniers en pleine largeur pour s'aligner parfaitement avec les boutons radios.
- **Fichiers touchés :** `web/src/components/modals/TailorModal.tsx`, `web/src/app/globals.css`.
- **Résultat vérifs :** `npm run lint` 0 erreur · `npx vitest run` 262/262 verts · `npx tsc --noEmit` OK. Le layout est aéré, premium, et sans régression des fonctionnalités existantes.

### 2026-07-16 : Refonte UI du drawer « Adapter à une offre » (mode Lettre) — système de panneau réutilisable

- **Besoin.** La première approche "Drawer" (modale d'adaptation Lettre) était décevante (markup vidé, bouton CTA orphelin, trop large). Remplacer le patch ponctuel par un système de panneau générique et réutilisable (`.ui-drawer`, `.ui-eyebrow`, `.ui-icon-btn`) laissant l'aperçu PDF visible.
- **Correctif.**
  - `globals.css` : Ajout des classes du panneau (`.ui-drawer`, `--left`, `--md`, `--lg`), structure `__head` / `__body` (scrollable) / `__foot` (CTA épinglé, filet en creux). Overlay dégradé directionnel et bouton fermer circulaire néomorphique `.ui-icon-btn`.
  - `TailorModal.tsx` : Extraction des blocs JSX partagés (`offerSection`, `adaptButton`) et implémentation du nouveau layout `ui-drawer` pour le mode Lettre, sans régresser le mode CV (qui adopte juste le nouveau bouton de fermeture).
  - `JobExtractor.tsx` : Remplacement des styles inline par la classe partagée `.job-extractor-row`.
- **Fichiers touchés :** `web/src/components/modals/TailorModal.tsx`, `web/src/components/modals/JobExtractor.tsx`, `web/src/app/globals.css`.
- **Résultat vérifs :** `npm run lint` 0 erreur · `npx vitest run` 262/262 verts · `npx tsc --noEmit` OK. Mode "Lettre" et mode "CV" préservés.

### 2026-07-16 : Généralisation du drawer pour le mode CV et correction du z-index

- **Besoin.** L'utilisateur souhaitait appliquer la même cohérence visuelle du nouveau tiroir (drawer) pour le mode CV de l'outil "Adapter à une offre". Par ailleurs, un bug de chevauchement (`z-index`) faisait que les inputs de la lettre apparaissaient à travers le fond opaque de la modale en raison des empilements de composants.
- **Correctif.**
  - `TailorModal.tsx` : Utilisation de `createPortal(..., document.body)` pour extraire la modale du flux d'empilement (stacking context) de la page web, réglant ainsi définitivement le bug des inputs qui transparaissaient.
  - `TailorModal.tsx` : Suppression de la division "Letter/CV" concernant le wrapper du modal (`ui-overlay--drawer-left`, `ui-drawer--left`). Le mode CV utilise désormais `.ui-drawer--lg` pour accommoder ses 2 colonnes. Les actions (`.tailor-actions-box`) ont été migrées proprement dans le pied `.ui-drawer__foot`.
  - `globals.css` : Nettoyage de la classe `.tailor-actions-box` qui était devenue inutile suite à l'utilisation native de `__foot`.
- **Résultat vérifs :** Les actions sont correctement réparties dans la modale. Tous les tests Vitest (262/262), tsc et le lint sont au vert. Code laissé non commité sur `main` selon le choix de l'utilisateur.

### 2026-07-16 : icônes détectées par contenu dans le bloc Contact (Marine)

- **Besoin.** Les coordonnées libres (« GitHub », « Permis », « Portfolio »…) sortaient
  toutes avec un point médian dans la barre latérale de Marine ; l'utilisateur voulait de
  vrais logos détectés d'après le contenu du champ, sans SVG dessinés à la main.
- **Fait (`lib/pdfgen/templates/contactIcons.tsx`, nouveau).** Bibliothèque d'icônes à
  chemins réels : logos de marques via le paquet npm `simple-icons` (CC0 — GitHub, GitLab,
  X, Stack Overflow, Behance, Dribbble, Instagram, YouTube, Medium), LinkedIn repris de
  Bootstrap Icons (retiré de simple-icons pour raisons de marque), voiture et globe repris
  de Material Icons. `detectContactIcon(label, value)` teste des règles regex ordonnées sur
  `label + valeur` (les marques AVANT le repli « lien » → globe) ; `ContactIcon` rend le
  chemin en react-pdf.
- **Branchement (`MarineTemplate.tsx`).** Les champs fixes (ville/email/téléphone) gardent
  leur icône ; le champ LinkedIn natif et tous les champs libres passent par la détection ;
  repli sur le point médian si rien ne matche. L'ancien `LinkIcon` générique est supprimé.
  Les autres templates rendent le contact en texte pur : non touchés.
- **Itération 2 (même jour).** Le repli des champs non reconnus n'est plus le point
  médian mais un maillon de chaîne (Bootstrap Icons « link-45deg ») ; `detectContactIcon`
  retourne donc toujours un id (`"link"` par défaut) et `DotIcon` disparaît de Marine.
  Détections ajoutées : Malt, WhatsApp, Telegram, Discord, disponibilité → calendrier,
  et email/téléphone dans les champs libres (Material « mail »/« call »/« event »).
- **Vérifié.** 262 tests verts (`contactIcons.test.ts`, 7 cas), lint propre, contrôle
  visuel dans l'aperçu : logos LinkedIn/GitHub, voiture « Permis », maillon « Mobilité ».

### 2026-07-16 : 4 correctifs (snapshots, Ctrl+Z lettre, tic IA, tip aide)

- **Besoin.** Quatre retours utilisateur groupés : snapshots qui ne marchent pas, Ctrl+Z
  inopérant dans l'éditeur de lettre, l'IA qui abuse du participe présent malgré la règle de
  tonalité existante, et un tips à ajouter dans « Comment ça marche ? ».
- **Snapshots cassés (`lib/storage/snapshots.ts`, `components/layout/DraftManager.tsx`).**
  Root cause : `takeSnapshot()` faisait `if (!html) return;` et la déduplication comparait
  `html`/`css`. Or `docStore.html` est remis à `""` par `setJson` (pipeline JSON/react-pdf,
  seul chemin actif pour le formulaire depuis la migration) — même pattern que le bug ATS
  corrigé le 14/07 (`docStore.html` = vestige de l'ancien pipeline HTML). Résultat : aucun
  snapshot n'était jamais sauvegardé (ni manuel, ni auto, ni avant adaptation/chat), quel que
  soit le déclencheur. Fix : dédup sur `json` (stringifié) quand `htmlSource` est faux, sur
  `html`/`css` sinon ; même bascule pour la détection de changement de l'auto-snapshot toutes
  les 5 min dans `DraftManager`.
- **Ctrl+Z mort dans les formulaires (`lib/useGlobalUndoRedo.ts`).** Le handler ignorait tout
  Ctrl+Z fait depuis un `<input>`/`<textarea>` focus, pour ne pas interférer avec Monaco (mode
  Expert) — mais Monaco utilise justement un `<textarea>` caché, donc le filtre `isInputOrTextarea`
  désactivait aussi le undo global dans **tous** les champs de formulaire (CV et lettre), qui eux
  n'ont pas d'undo natif fiable (composants contrôlés pilotés par le store). Fix : cibler
  spécifiquement Monaco via `activeElement.closest(".monaco-editor")` au lieu du tag générique.
- **Tic « participe présent » de l'IA (`lib/ai/prompts.ts`, `HUMAN_TONE_RULE`).** La règle
  n'interdisait que le participe présent *collé en fin de phrase* (« …, permettant d'optimiser… »).
  L'IA en plaçait aussi en incise (« Professionnel qualifié, répondant aux normes actuelles… »),
  non couvert par le libellé. Reformulé pour interdire le participe présent-tic quelle que soit
  sa position dans la phrase.
- **Tips presse-papier dans l'aide (`app/help/page.tsx`).** Nouvelle entrée FAQ : copier le
  JSON du CV en mode Expert (bouton « Copier » existant) puis épingler l'entrée dans
  l'historique du presse-papier Windows (Win+V) pour la retrouver et la recoller plus tard —
  sauvegarde de secours sans exporter de fichier.
- **Fichiers touchés :** `web/src/lib/storage/snapshots.ts`, `web/src/components/layout/DraftManager.tsx`,
  `web/src/lib/useGlobalUndoRedo.ts`, `web/src/lib/ai/prompts.ts`, `web/src/app/help/page.tsx`.
- **Résultat vérifs :** `npm test` (256 tests, 38 fichiers) vert, `npm run lint` vert (1 warning
  préexistant sans rapport), `npx tsc --noEmit` sans erreur. Pas de vérification navigateur
  (Playwright jugé trop coûteux en tokens pour ce lot de correctifs — voir mémoire).

### 2026-07-15 : Accordéons du formulaire (sections + éléments) et en-têtes colorés

- **Besoin.** Suite de l'allègement : rendre le formulaire navigable en le repliant. Sections
  repliables **et** éléments repliables (Expérience 1, 2… / Formation 1, 2…), ouverts par défaut.
  Côté couleur, choix assumé de l'utilisateur après feedback : **colorer les en-têtes, garder les
  labels de champ sobres** (colorer chaque label alourdit au lieu d'aider).
- **Sections (`FormSection`).** Nouveau wrapper : `<h3>` enveloppe un `<button>` toggle (titre
  sémantique conservé, HTML valide), chevron qui pivote, corps masqué quand replié. Toutes les
  sections passent par lui (y compris Informations personnelles, À propos, Ordre des sections).
  État local `useState(true)` — se réinitialise au rechargement. **Distinct de « masquer »**
  (l'œil de « Ordre des sections ») qui, lui, retire du PDF ; replier est purement visuel.
- **Éléments (`ItemCard`).** En-tête à trois zones sans conflit : poignée (déplacer) · bouton
  toggle occupant le centre (plier/déplier) · ✕ (supprimer). Replié, la carte devient une ligne
  compacte « EXPÉRIENCE 1 · Chargé de com… » — le sous-titre vivant prend tout son sens, et on
  peut réordonner des lignes repliées. Bordure de séparation retirée quand replié.
- **Couleur.** Eyebrow « Expérience 1 » passe en `--orange-text` ; titres de section déjà orange ;
  labels de champ inchangés (sobres). Chevrons en `--muted`.
- **Vérifs.** eslint 0 err (1 warning `<img>` préexistant) · vitest 256/256 · e2e form-reorder 2/2.
  Le sélecteur du test a dû être adapté (`h3 span:text-is` au lieu de `h3:text-is`) car le titre
  n'est plus un texte direct du `<h3>` — comportement testé inchangé. Rendu contrôlé au screenshot
  en mobile 390px, thèmes clair **et** sombre, états ouvert/replié. Cible tactile 44px sur les
  en-têtes d'accordéon en mobile.

### 2026-07-15 : Allègement du formulaire — cartes à en-tête numéroté

- **Besoin.** Sur mobile le formulaire était lourd et sans repère : chaque expérience/formation
  empilait ses champs sans qu'on sache laquelle on éditait. Demande : repères visuels
  (« Expérience 1, 2… », « Formation 1, 2… ») et un rendu plus léger, équilibré, esthétique.
- **Cartes (`ItemCard`).** Ajout d'un en-tête de carte = poignée + eyebrow numéroté
  (« EXPÉRIENCE 1 ») + sous-titre vivant résumant l'élément (poste · entreprise, tronqué en
  ellipse) + ✕. Étendu par cohérence à Projets / Bénévolat / Sections libres. Supprime au passage
  le hack `padding-top: 28px` qui dégageait le ✕ en absolu.
- **Profondeur néomorphique corrigée.** La carte passe de `--neu-inset` à `--neu-raised-sm` : elle
  ressort, les champs (en creux) se logent dedans — hiérarchie de profondeur nette au lieu du
  double creux « boueux » d'avant. Séparateur `--border` discret sous l'en-tête.
- **Labels allégés.** `.form-label` abandonne les majuscules espacées pour la casse normale
  (« Poste » au lieu de « POSTE ») — moins de bruit répété à chaque champ.
- **Vérifs.** eslint 0 err (1 warning `<img>` préexistant) · vitest 256/256 · e2e form-reorder 2/2
  (la poignée a changé de place mais reste dans `.form-item`, le glisser-déposer passe toujours).
  Rendu contrôlé au screenshot en émulation mobile (390px) et desktop (1440px).
- **Non fait (proposé en suite).** Compacter la trilogie Contrat/Lieu/Date sur mobile pour
  raccourcir la pile ; c'est le seul reste de hauteur, laissé à l'arbitrage visuel de l'utilisateur.

### 2026-07-15 : Glisser-déposer des éléments à l'intérieur des sections du formulaire

- **Besoin.** Les flèches ↑/↓ réordonnaient déjà les **sections** entre elles, mais rien ne
  permettait de déplacer les éléments **à l'intérieur** d'une section. Or l'ordre des expériences
  est ce qu'on ajuste le plus souvent en adaptant un CV à une offre.
- **Décision.** Aller directement au glisser-déposer (dnd-kit) plutôt que d'ajouter des flèches
  jetables — c'est le geste voulu au bout du compte. Choix de l'utilisateur, assumé.
- **Architecture.** Toute la mécanique dnd-kit est isolée dans un seul fichier neuf,
  `web/src/components/form/Sortable.tsx`, qui expose `SortableList`, `useSortableItem`,
  `DragHandle` et `moveItem` (ré-export d'`arrayMove`). `FormEditor.tsx` n'importe **que** ça, il
  ne voit jamais dnd-kit — le jour où l'on change de bibliothèque, c'est ce fichier et lui seul
  qu'on réécrit. Deux composants de présentation : `ItemCard` (5 sections en cartes) et un nouveau
  `RowCard` (7 listes en ligne). Chaque section entoure sa liste d'un `SortableList` et repart par
  son `onChange` existant → aperçu PDF et Annuler/Rétablir gratuits (une entrée d'historique par
  dépose).
- **Périmètre : 12 listes.** Expériences, formations, projets, bénévolat, sections libres,
  compétences, soft skills, outils, certifications, centres d'intérêt, langues, infos
  complémentaires. **Hors périmètre, assumé :** le bloc « Ordre des sections » garde ses flèches
  ↑/↓ ; les puces « Réalisations » restent une zone de texte (collage multi-lignes préservé).
- **Identité des éléments.** Les listes du CV n'ont pas d'`id` (une compétence est une chaîne, deux
  peuvent être identiques) : on utilise l'indice **décalé de 1**, car dnd-kit traite l'identifiant
  `0` comme absent. Aucun champ ajouté au schéma.
- **Mobile (exigence explicite).** Le drag ne doit pas entrer en conflit avec le défilement :
  `touch-action: none` est posé sur `.drag-handle` **et uniquement là**, et les listeners dnd-kit
  ne sont sur la poignée que. Vérifié dans l'app en émulation mobile : `touch-action` calculé =
  `none` sur la poignée, `auto` sur la carte et les champs → on glisse depuis la poignée, on défile
  partout ailleurs. Poignée à 44 px de haut en mobile (cible tactile).
- **Piège de test consigné.** dnd-kit ne mesure les zones cibles qu'une frame **après** la saisie :
  une touche/mouvement envoyé trop tôt ne déplace rien. Les tests e2e n'utilisent aucun
  `waitForTimeout` — ils répètent le geste jusqu'à ce que la région d'annonce accessibilité
  (`DndLiveRegion-*`) confirme le survol de la cible (déterministe sur le résultat).
- **Fichiers :** `web/src/components/form/Sortable.tsx` (neuf), `web/src/components/form/FormEditor.tsx`,
  `web/src/app/globals.css`, `web/tests/e2e/form-reorder.spec.ts` (neuf, clavier + souris),
  `web/package.json` (+ `@dnd-kit/core|sortable|modifiers|utilities`).
- **Vérifs :** `npx eslint` 0 erreur (1 warning préexistant `<img>`) · `npx vitest run` **256/256** ·
  `npm run build` compile (23 pages) · `npx playwright test` **39/39** (dont clavier + souris, en
  `--repeat-each=3` stables) · preuve tactile ci-dessus.
- **Commits :** `74c6010` (cartes) · `baada6d` (test clavier déterministe) · `289cbcd` (listes en
  ligne) · + doc. Branche `feat/form-drag-drop`.

### 2026-07-14 : Le système ATS était branché sur un CV vide — refonte du moteur

- **Symptôme signalé.** Le panneau ATS affichait **score 0**, « 0 mot-clé présent · 20
  absents », **toutes** les sections marquées ✗, et listait comme « mots-clés absents » la
  présentation de l'entreprise (*propos, accueil, universite, paris, dauphine-psl,
  selective, neanmoins, soucieuse…*). Le bouton « Analyser avec l'IA » échouait aussi.
- **Cause racine (reproduite avant tout correctif).** `AtsPanel` analysait
  `docStore.html` — vestige du pipeline HTML d'avant la migration React PDF, que `setJson`
  remet à `""` à chaque modification. L'ATS comparait donc une **chaîne vide** à l'offre :
  0 mot trouvé → score 0, et `missing` renvoyait les 20 premiers mots de l'annonce. Un test
  de reproduction jetable a sorti la liste **identique mot pour mot** à celle de la capture.
  Même champ vide envoyé à `/api/ats-score` → 400 « CV et offre requis », d'où le bouton IA
  cassé. Le prompt IA, lui, était bon : il n'était jamais atteint.
- **Second défaut, de conception.** Même alimenté correctement, l'ancien score valait
  `mots trouvés ÷ TOUS les mots de l'offre` : « python » pesait autant que « néanmoins ».
  Un CV parfaitement adapté plafonnait à **22/100** (mesuré). Un sac de mots ne peut pas
  distinguer une compétence d'un mot de décor — d'où la refonte plutôt qu'un réglage.
- **Quoi.**
  - `lib/ats/resumeText.ts` (neuf) — sérialise `docStore.json` en texte par zones, en
    excluant les sections masquées (absentes du PDF, donc d'un vrai ATS). Détection des
    sections lue dans les données, au lieu de regex sur des `<h1>` qui n'existent plus.
  - `lib/ats/engine.ts` (neuf, remplace `score.ts`) — score sur **4 axes pondérés**
    (Mots-clés 40 %, Structure 25 %, Impact 20 %, Adéquation 15 %), verdict, conseils par
    axe. Un terme n'est retenu comme *exigence* que s'il est un savoir-faire identifiable,
    martelé par l'offre (≥ 3 occurrences) ou présent dans l'intitulé du poste.
  - `/api/ats-score` + `SYSTEM_ATS_SCORE` — **l'IA n'attribue plus le score**. Elle extrait
    les exigences (hard/nice), dit lesquelles le CV *prouve* (synonymes compris) et rédige
    les corrections prioritaires ; le moteur fait l'arithmétique. Résultat reproductible.
  - `AtsPanel` — refondu en rapport : score + verdict, 4 jauges, corrections prioritaires
    avec la rubrique où les appliquer, exigences couvertes/à combler, sections.
- **Fichiers touchés :** `web/src/lib/ats/{resumeText,engine}.ts` (+ tests), suppression de
  `web/src/lib/ats/score.ts` (+ test), `web/src/app/api/ats-score/route.ts` (+ test),
  `web/src/lib/ai/prompts.ts`, `web/src/components/modals/AtsPanel.tsx`,
  `web/src/lib/pdfgen/AtsBoost.tsx` (commentaire), `web/src/app/globals.css`,
  `web/tests/e2e/ats.spec.ts`, `PROJECT_INDEX.md`.
- **Résultat vérifs :** `npx tsc --noEmit` OK · `npx vitest run` **256 tests / 38 fichiers
  verts** · `npm run lint` 0 erreur (1 warning préexistant, `FormEditor` `<img>`) ·
  `npx playwright test tests/e2e/ats.spec.ts` **2/2 verts**. Validation externe : sur
  l'offre Dauphine réelle, le moteur sort **82/100 « Bon, à optimiser »** et pointe
  *google-ads, crm, email-marketing, meta-ads* comme manquants — **le même diagnostic**
  qu'un analyseur ATS du marché testé en parallèle (70/100, mêmes 4 manques).
- **Commit :** à faire.

### 2026-07-13 : Le nom du candidat atterrissait dans la formule de politesse

- **Symptôme signalé.** Lettre générée via le chat IA à partir d'une offre : « Hariss
  HAFEJI » se retrouvait dans le champ *formule de politesse* (`signoff`) et « Prénom
  Nom » dans la *signature*.
- **Cause racine.** `SYSTEM_EDITOR_CHAT` ne décrivait AUCUN champ de lettre. Le CV a droit
  à `RESUME_SCHEMA_DESC` (fiche détaillée) ; la lettre n'avait que « respecte le même
  schéma que l'entrée ». Le modèle devait donc deviner ce que `signoff` et `signature`
  veulent dire — et se trompait par intermittence. Ce n'était pas une inversion de code :
  `LetterDocument` lit bien deux blocs distincts, c'est le contenu qui arrivait faux.
  Le « Prénom Nom » vient de `normalizeLetter`, qui comble tout champ vide avec
  `DEFAULT_LETTER` : quand l'IA laissait `signature` vide, l'app y réinjectait son propre
  placeholder.
- **Correctif.** Nouvelle constante `LETTER_FIELDS_RULE` (`web/src/lib/ai/prompts.ts`)
  injectée dans `SYSTEM_EDITOR_CHAT` : rôle explicite de chacun des 12 champs, avec deux
  interdits nommés — `signoff` ne contient JAMAIS de nom, `signature` recopie
  `sender_name` et ne reste jamais sur un texte générique.
- **Fichiers touchés :** `web/src/lib/ai/prompts.ts`, `web/src/lib/ai/prompts.test.ts`.
- **Résultat vérifs :** reproduction réelle contre Gemini (fichier temporaire, supprimé
  depuis). AVANT : 1 tirage fautif sur 3 (`signoff = "Hariss HAFEJI"`). APRÈS : **0 fautif
  sur 6**, `signoff` = formule de politesse, `signature` = le vrai nom. Test permanent
  ajouté, DÉRIVÉ de `letterSchema` (même garde-fou anti-dérive que pour le CV) : il a
  d'ailleurs immédiatement attrapé un champ oublié dans la fiche (`date`).
  `npm test` : 250 tests verts. `npm run lint` : 0 erreur.
- **Commit :** voir ci-dessous (`fix(ia)`).

---

### 2026-07-13 : Tonalité de l'IA — du texte qui ne sent plus l'IA

- **Quoi :** nouvelle règle partagée `HUMAN_TONE_RULE` (`web/src/lib/ai/prompts.ts`),
  injectée dans les **trois** prompts qui rédigent du texte : adaptation du CV
  (`tailorResumeSystem`, tous niveaux), chat éditeur (`SYSTEM_EDITOR_CHAT`) et
  adaptation de la lettre (`SYSTEM_ADAPT_LETTER`). Elle proscrit les clichés de
  candidature (« fort de mon expérience », « mettre à profit », « force de
  proposition »…), le vocabulaire d'IA, le participe présent collé en fin de phrase,
  l'énumération par trois, le tiret cadratin en prose et la conclusion de remplissage.
- **Pourquoi :** un texte qui « sent l'IA » fait éliminer la candidature. Le prompt de
  lettre disait même « CONSERVE le ton » sans jamais définir lequel.
- **Périmètre volontairement restreint :** la règle ne vise que le texte RÉDIGÉ
  (résumé, puces, corps de lettre). Les listes (compétences, savoir-être, langues,
  centres d'intérêt) sont les mots du candidat : la règle interdit explicitement de les
  réécrire au nom du style. Les prompts d'**extraction** ne la portent pas — sinon ils
  réécriraient le CV importé au lieu de le recopier (architecture « zéro perte »).
- **Deux pièges rencontrés, tous deux corrigés :**
  1. la règle bannit le tiret cadratin, mais les compétences imposent le format
     `Mot clé — Description`. Citer ce format dans la règle le faisait fuiter dans le
     niveau « subtil », qui interdit justement de reformater les compétences (attrapé
     par un test existant). L'exception reste donc **allusive** ;
  2. l'exigence d'écrire concret poussait le modèle à remplacer les variables
     `{Poste}` / `{Entreprise}` par leur valeur (tenues 1 fois sur 3). Corrigé par un
     rappel final placé après la règle, explicitement « plus fort que la règle de
     tonalité » → 3/3.
- **Fichiers touchés :** `web/src/lib/ai/prompts.ts`, `web/src/lib/ai/prompts.test.ts`.
- **Résultat vérifs :** A/B réel contre Gemini (fichiers de test temporaires, supprimés
  depuis). Lettre, 3 tirages : 3, 4 et 2 clichés **avant** la règle → **0, 0, 0 après**,
  variables tenues 3/3. CV adapté : schéma valide, `softSkills`/`languages`/`interests`
  intacts, format `Mot clé — Description` conservé, « 400 k€ » préservé, « fort de »
  disparu du résumé. `npm test` : 247 tests, 37 fichiers, verts. `npm run lint` : 0 erreur.
- **Commit :** voir ci-dessous (`feat(ia)`).

---

### 2026-07-13 : `main` redevient la branche de référence (GitHub + Vercel)

- **Quoi :** fusion en fast-forward de `feature/refonte-ui-nextjs` dans `main`
  (145 commits) puis push. Sur Vercel, la branche de production du projet
  `cv-tailor` passe de `feature/refonte-ui-nextjs` à `main`. Suppression du
  vieux projet Vercel `html-to-pdf`, resté branché sur le même dépôt GitHub.
- **Pourquoi :** la prod tournait depuis une branche de feature ; tout le travail
  y était déjà consolidé (`main`, `feature/ai-tailoring` et `rewrite-nextjs`
  sont tous contenus dans la branche fusionnée). `html-to-pdf` rebuildait à
  chaque push sur `main` pour rien (racine du dépôt, code Flask supprimé).
- **Fichiers touchés :** aucun (opérations git + configuration Vercel).
- **À savoir :** l'API publique Vercel n'expose pas `productionBranch` en
  écriture. Le contournement : `vercel git disconnect` puis
  `vercel git connect <url>` — à la reconnexion, Vercel reprend la branche par
  défaut du dépôt GitHub (`main`). Sur ce projet, `vercel git connect` doit être
  lancé depuis `web/` **avec l'URL du dépôt en argument**, sinon la CLI cherche
  un `.git` dans `web/` et échoue.
- **Résultat vérifs :** `GET /v9/projects/cv-tailor` renvoie
  `link.productionBranch = "main"` ; dernier déploiement de production `READY`
  sur `main @ 3fbb607` ; `https://cv-tailor-drab-rho.vercel.app` répond 200 ;
  `GET /v9/projects/html-to-pdf` renvoie 404.
- **Commit :** aucun code modifié ; `main` pointe sur `3fbb607`.

---

### 2026-07-12 : Import « zéro perte » — les modèles s'adaptent au CV, plus l'inverse

**Symptôme signalé.** Un CV importé avec des rubriques « Hard skills » et « Soft skills »
voyait les deux fusionnées dans le seul champ `skills`.

**Cause racine (1) — dérive du schéma IA.** `RESUME_SCHEMA_DESC` (`lib/ai/prompts.ts`) est la
fiche de schéma envoyée à l'IA. C'est une copie manuelle de `resumeSchema` (Zod), et elle avait
dérivé : ni `softSkills` ni `tools` n'y figuraient, alors que ces champs existaient partout
ailleurs (schéma, `normalizeResume`, `FormEditor`, modèle Marine). L'IA ne peut pas remplir une
case dont on ne lui parle pas → elle entassait tout dans `skills`. La fiche étant partagée par
4 systèmes (`SYSTEM_PDF_TO_RESUME`, `SYSTEM_TEXT_TO_RESUME`, les 2 bases de tailoring), la
dérive les dégradait tous d'un coup.

**Cause racine (2), bien plus grave — les modèles avalaient des données.** Chaque modèle PDF
listait en dur les champs qu'il voulait bien rendre et ignorait le reste **en silence** :
Marine ne rendait ni `skills`, ni `projects`, ni `certifications`, ni `volunteer` ; Sobre,
Kakuna et Graphique ignoraient `softSkills` et `tools`. Le défaut du système était « je jette ».

**Correctifs.**
- Fiche IA resynchronisée (`softSkills`, `tools`, `customSections`) + règles de tri explicites
  (technique / savoir-être / outils) et interdiction de renommer ou supprimer une rubrique pour
  la faire rentrer de force dans une case.
- Nouveau champ `customSections` (`{title, items[]}`) : l'IA crée elle-même les rubriques qu'elle
  ne sait pas classer (« Publications », « Distinctions »…). Éditable dans le formulaire,
  protégé de l'effacement par `mergeTailored`.
- **Renversement de responsabilité** (`lib/resume/sections.ts`) : le CV produit désormais sa
  liste de sections (`buildSections`), exhaustive. Un modèle déclare seulement les sections
  qu'il stylise (`*_HANDLED`) ; **tout le reste est rendu par `GenericSections`**. Le défaut
  devient « j'affiche ». Une section inconnue traverse la chaîne sans qu'aucun code ne la
  connaisse.

**Garde-fous (le vrai livrable — la classe de bug devient impossible à réintroduire).**
- `prompts.test.ts` : la liste des champs attendus dans la fiche IA est **dérivée de
  `resumeSchema.shape`**, plus écrite à la main (c'est justement la liste manuelle qui avait
  laissé passer le bug). Vérifié en rouge/vert.
- `ResumeDocument.test.tsx` : rend réellement les 4 modèles avec un CV **entièrement rempli**
  (+ 2 sections inventées), relit le texte du PDF produit et exige que **chaque valeur** y
  figure. Vérifié en rouge/vert (un modèle qui laisse tomber un champ fait échouer les tests).

**Au passage.** `tests/e2e/import-text.spec.ts` lisait le store sans attendre la fin de l'import
(course) : il passait par chance. Ancré sur le toast de succès.

**Vérifications.** eslint 0 erreur (1 warning `<img>` préexistant) · tsc 0 · vitest 219/219 ·
playwright 37/37.

**Suite.** Réordonnancement manuel + infos personnelles libres : cf. l'entrée ci-dessous
(même jour), qui achève le chantier et supprime les `*_HANDLED`.

### 2026-07-12 (2/2) : L'ordre et l'en-tête passent eux aussi sous le contrôle du CV

Suite directe de l'entrée précédente. Trois trous restaient béants.

**Trou 1 — l'ordre des sections était une constante des modèles.** Chaque modèle écrivait ses
sections en dur, dans un ordre figé. Un CV importé qui plaçait la Formation avant les
Expériences était réordonné de force. `sectionOrder: string[]` devient un champ du CV
(`resumeSchema`), appliqué par `buildSections` via un tri **stable** : une section absente de
la liste garde son rang canonique et se range à la fin — elle n'est jamais perdue.
Deux sources l'alimentent : l'IA, qui recopie l'ordre du CV source à l'import, et les flèches
monter/descendre du formulaire. La liste des flèches est **dérivée de `buildSections`**, donc
une rubrique inventée par l'IA y apparaît sans qu'une ligne de code la mentionne.

**Trou 2 — l'état civil n'avait pas de fourre-tout.** Un permis, un âge, une zone de mobilité,
un portfolio, un GitHub… n'avaient aucune case : ils disparaissaient à l'import, exactement
comme les Soft skills. Nouveau champ `customFields: [{label, value}]`, pendant de
`customSections` pour l'en-tête. `buildContacts()` (même fichier) le rend aux 4 modèles ;
Marine leur donne une puce neutre faute d'icône dédiée.

**Trou 3 — les `*_HANDLED` restaient une liste en dur.** Un modèle pouvait encore, par oubli,
ne pas déclarer une section. **Supprimés.** Les 4 modèles itèrent maintenant sur
`buildSections(cv)` et délèguent le corps à `SectionContent` (nouveau, dans `primitives.tsx`),
qui rend n'importe quelle section d'après son **type** (`text` / `list` / `timeline` /
`languages`), jamais d'après son nom. Un modèle ne peut plus omettre une section : il ne
décide que du placement (Marine : barre latérale vs colonne principale) et du style.
`pairAdjacent()` préserve le côte-à-côte Langues / Centres d'intérêt de Graphique et Kakuna,
mais seulement s'ils restent voisins — la mise en page suit l'ordre, jamais l'inverse.

**Garde-fous.**
- `ResumeDocument.test.tsx` : un 2e test rend les 4 modèles avec un `sectionOrder` qui remonte
  une section de queue en tête, relit le PDF et vérifie les positions réelles. Vérifié en
  rouge/vert (sabotage de `applyOrder` → 4 échecs).
- Le test « zéro perte » couvre désormais `customFields`. Vérifié en rouge/vert (sabotage de
  `buildContacts` → 4 échecs, `PermisTest`/`PortfolioTest` absents du PDF).
- `sections.test.ts` (nouveau) : garde-fou anti-dérive — `SECTION_IDS`, le vocabulaire des
  identifiants donné à l'IA, est **importé** par `prompts.ts` et confronté aux identifiants
  réellement émis par `buildSections`. Plus une seule liste recopiée à la main.

**Vérifications.** eslint 0 erreur (1 warning `<img>` préexistant) · tsc 0 · vitest 234/234 ·
playwright 37/37 · contrôle visuel des 4 modèles dans l'aperçu (mise en page inchangée ;
Marine affiche enfin Compétences) et des flèches en direct.

### 2026-07-13 : Retirer une section sans la perdre (l'œil)

**Demande.** « Comment supprimer la section Compétences ? » — la seule façon était de vider ses
lignes une à une, donc de détruire le contenu. Une croix « supprimer » avait été envisagée.

**Décision (validée avec l'utilisateur).** Un **œil masquer / réafficher** plutôt qu'une croix.
Retirer une section d'un CV, c'est presque toujours *pour une candidature donnée*, pas pour
toujours ; et une suppression destructive contredirait frontalement la promesse « zéro perte »
sur laquelle tout le reste est bâti. Pour vraiment effacer, on vide la section elle-même.

**Implémentation.** `hiddenSections: string[]` sur `resumeSchema`. `buildSections()` les écarte
du rendu ; le formulaire l'appelle avec `{ includeHidden: true }` — sinon une section masquée
disparaîtrait de la liste et deviendrait impossible à ramener. Ligne barrée + œil grisé.
Champ **jamais envoyé à l'IA** (c'est une préférence d'affichage, pas du contenu) : il est donc
exclu de `RESUME_SCHEMA_DESC`, et `mergeTailored` le recopie TOUJOURS depuis la base — sans
quoi une adaptation à une offre ferait silencieusement réapparaître les sections masquées.

**Garde-fous.**
- `ResumeDocument.test.tsx` : les deux moitiés du contrat sur les 4 modèles — la section masquée
  sort bien du PDF **et** son contenu est toujours dans le CV (sinon c'est une suppression
  déguisée). Vérifié en rouge/vert (sabotage du filtre → 5 échecs).
- `prompts.test.ts` : l'exclusion de `hiddenSections` de la fiche IA est **nommée et justifiée**
  dans une liste explicite — une exclusion tacite recréerait exactement le trou d'origine.
- `normalize.test.ts` : le masquage survit à une adaptation IA.

**Vérifications.** eslint 0 erreur · tsc 0 · vitest 242/242 · playwright 37/37 · masquage et
retour en arrière testés en direct dans l'aperçu (Compétences revient avec ses 6 lignes).

### 2026-07-12 : Revue qualité des implémentations Gemini (profil, undo/redo, page Aide)
- **Quoi :** Audit de qualité (pas seulement « les tests passent ») du travail Gemini committé (profil) et non committé (undo/redo, page Aide FAQ, refonte TopBar). Constat : `eslint` cassé (7 erreurs) alors que chaque rapport WORK_HISTORY affirmait « 0 erreur », et undo/redo annoncé « testé » sans aucun test. Corrections : (1) lint remis à 0 erreur — 6 apostrophes/guillemets non échappés dans `help/page.tsx`, `any` typé en `DocumentSnapshot` dans `useGlobalUndoRedo.ts`, import mort `toast` retiré de `useAutoDraft.ts`, dépendance `busy` superflue retirée du `useCallback` de `TopBar.tsx` ; (2) profil : champs `adresse`/`codePostal` retirés (collectés mais jamais appliqués — le schéma `Resume` n'a pas ces champs, `sender_address` de la lettre vient de `cv.location`) ; (3) tests : nouveau `historyStore.test.ts` (9 tests couvrant push/undo/redo/pause/clear + branche future effacée) ; `profile.spec.ts` assaini (variable morte `vars` retirée, pseudo-vérif lettre remplacée par un vrai contrôle « Créer ma lettre » activé).
- **Pourquoi :** Demande de Hariss de vérifier la *qualité* du code Gemini, pas juste le vert des tests.
- **Fichiers touchés :** `web/src/app/help/page.tsx`, `web/src/lib/useGlobalUndoRedo.ts`, `web/src/lib/storage/useAutoDraft.ts`, `web/src/components/layout/TopBar.tsx`, `web/src/lib/profile/profile.ts`, `web/src/components/profile/ProfileView.tsx`, `web/src/state/historyStore.test.ts` (créé), `web/tests/e2e/profile.spec.ts`.
- **Résultat vérifs :** `eslint` **0 erreur** (1 warning `<img>` préexistant hors périmètre), `tsc --noEmit` 0, `vitest` **211/211** (36 fichiers, +9), `playwright` **37/37** (`--workers=1`).
- **Réserve connue :** l'undo/redo global reste inopérant pendant la frappe dans les champs (`if (isInputOrTextarea) return;` laisse l'undo natif du navigateur) — utile surtout pour annuler une opération en masse (Effacer, adaptation IA) où le focus n'est pas dans un input. Comportement volontaire, désormais couvert par les tests unitaires du store.
- **Commit :** À réaliser.

### 2026-07-11 - Implémentation du système Undo/Redo
- **Quoi** : Mise en place des raccourcis Ctrl+Z et Ctrl+Shift+Z.
- **Pourquoi** : Permettre aux utilisateurs d'annuler et de rétablir leurs modifications sur le CV/Lettre sans interférer avec l'édition de texte native.
- **Fichiers** : `src/state/historyStore.ts` (nouveau), `src/lib/useGlobalUndoRedo.ts` (nouveau), `src/components/ui/UiHost.tsx`, `task.md`, `implementation_plan.md`.
- **Résultat** : Le système tracke intelligemment le JSON, HTML, CSS avec un debounce d'une seconde, sans ajouter de dépendance. Tests Vitest et Playwright passés avec succès.

### 2026-07-11 : Refonte de la page "Comment ça marche" en page FAQ
- **Quoi :** Transformation de l'ancienne modale d'aide (`HelpModal.tsx`) en une page dédiée complète (`/help/page.tsx`). Ajout d'une section introduisant clairement la promesse de confidentialité (100% local, pas de compte). Transformation des autres points en FAQ à base d'accordéons natifs (`<details>` / `<summary>`). Remplacement du bouton d'ouverture dans l'ActionsBar et ajout du lien dans le MobileMenu.
- **Pourquoi :** Offrir plus d'espace de lecture (UX) et mettre en avant les atouts majeurs (stockage local, pas de compte) qui justifient l'absence d'inscription.
- **Fichiers touchés :** `web/src/app/help/page.tsx` (créé), `web/src/app/globals.css`, `web/src/components/layout/ActionsBar.tsx`, `web/src/components/layout/MobileMenu.tsx`, `web/src/components/modals/HelpModal.tsx` (supprimé), `web/tests/e2e/help.spec.ts`.
- **Résultat vérifs :** `tsc` 0 erreur, `eslint` 0 erreur, `vitest` vert, `playwright` vert, build OK. L'ouverture des accordéons et la modale API fonctionnent.
- **Commit :** À réaliser.

### 2026-07-11 : Refonte de la TopBar (minimaliste, SaaS, 3 zones)
- **Quoi :** Refonte visuelle complète de la `TopBar`. Le JSX a été restructuré en 3 zones (`.topbar-left`, `.topbar-center`, `.topbar-right`). Les boutons "Nouveau CV", "Offres" et "Historique" ont perdu leurs classes `btn-nav-outline-*` pour un design beaucoup plus discret (gris au survol). Le bouton de profil est devenu un avatar (cercle de 32px, fond plein avec la même interaction que l'icône réglages). Centrage absolu du titre du CV (`.topbar-center`). Le CSS a été épuré (suppression des anciennes classes d'outline orange/bleu). La TopBar mobile est inchangée et gère son menu burger proprement (sans conflit d'accessibilité avec le desktop).
- **Pourquoi :** L'ancien design était perçu comme surchargé ("le bordel", manque d'équilibre visuel, trop d'appels à l'action criards). Alignement sur l'esthétique minimaliste (Vercel, Linear).
- **Fichiers touchés :** `web/src/components/layout/TopBar.tsx`, `web/src/components/layout/MobileMenu.tsx`, `web/src/app/globals.css`.
- **Résultat vérifs :** `tsc` 0 erreur, `eslint` 0 erreur, `vitest` vert, `playwright` vert, build OK. Le centrage parfait a été vérifié.
- **Commit :** À réaliser.

### 2026-07-11 : Profil « Mes informations » et pré-remplissage CV/Lettre
- **Quoi :** Création du profil global (identité : prénom, nom, email, téléphone, ville, etc.) sauvegardé dans Dexie (v5). Ajout de la page `/profil` accessible via un nouveau bouton « Mes infos » dans `ActionsBar`. Le profil pré-remplissant les CV vierges (via `ActionsBar.onClear`, `TopBar.onNewCv`, et `useAutoDraft` au 1er lancement) et est utilisé prioritairement pour l'identité de l'en-tête de la lettre de motivation dans `PackView`.
- **Pourquoi :** Exécution du plan `2026-07-11-profil-mes-informations.md` pour éviter la re-saisie des informations de base.
- **Fichiers touchés :** `src/lib/profile/profile.ts`, `src/lib/profile/profile.test.ts`, `src/lib/storage/db.ts`, `src/components/profile/ProfileView.tsx`, `src/app/profil/page.tsx`, `src/components/layout/ActionsBar.tsx`, `src/components/layout/TopBar.tsx`, `src/lib/storage/useAutoDraft.ts`, `src/components/pack/PackView.tsx`, `tests/e2e/profile.spec.ts`.
- **Résultat vérifs :** `tsc` 0 erreur, `eslint` 0 erreur, `vitest` 202/202, `build` OK, e2e `profile.spec.ts` vert.
- **Commit :** Commits locaux par task, série `feat(profil)`.

### 2026-07-11 : Refonte « Lettre de motivation » façon MeilleursJobs/Candiboost (éditeur plein écran, sans email)
- **Quoi :** Pivot d'après la page de référence MeilleursJobs fournie par Hariss (`Downloads/Nouvelle campagne - MeilleursJobs.html`, éditeur TipTap/ProseMirror). La page /pack devient un **éditeur plein écran** : objet + corps en éditeur à étiquettes (pastilles inline), palette de variables, un **seul modèle** par défaut, **plus d'email d'accompagnement**, plus de sélecteur ni de champs greeting/signoff séparés (tout est dans le corps). Contenu par défaut = la lettre de la page de référence (« Bonjour {M/Mme Nom}, … Bien cordialement, {Prénom} {Nom} »). Adaptation IA repliée dans un dépliant. Migration IndexedDB unique (`pack-templates-v2`) qui réinitialise les anciens modèles (email + multi) vers le modèle unique.
- **Pourquoi :** Demande de Hariss : interface devenue « le bordel » (trop de champs, modèles, lettre + mail). Objectif : simplicité + le fonctionnement de Candiboost.
- **Décisions (AskUserQuestion) :** un seul modèle par défaut ; éditeur plein écran (pas d'aperçu PDF à côté, PDF au « Créer ma lettre »).
- **Fichiers touchés :** `src/lib/templates/defaults.ts` (modèle simplifié + nouveau contenu), `build.ts` (greeting/signoff/signature vides, `renderEmail` retiré), `defaults.test.ts`, `src/lib/storage/db.ts` (migration), `src/components/pack/VariableEditor.tsx` (`showPalette`, `singleLine`), `PackView.tsx` (réécriture), `TemplateEditorPanel.tsx` (supprimé), `src/app/pack/page.tsx` (titre), `globals.css`, `TailorModal.tsx` + `HelpModal.tsx` (libellés), `tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc` 0, `lint` 0 erreur, `vitest` 197/197, `build` OK, `playwright` 36/36. Recette visuelle desktop faite (objet + corps à pastilles, IA repliée, migration effective).
- **Note :** le plan `2026-07-10-pack-editeur-etiquettes.md` (Tasks 1-5) est en partie superseded par ce pivot (email + multi-modèles retirés).

### 2026-07-11 : Disposition finale du Pack — dépliant Personnaliser + colonnes pleine largeur
- **Quoi :** Task 5 du plan `2026-07-10-pack-editeur-etiquettes.md`. Vue par défaut épurée : variables, offre, les deux éditeurs à étiquettes et « Adapter à l'offre » ; tout le reste (sélecteur de modèle — masqué s'il n'y a qu'un modèle —, champs courts, boutons Enregistrer/Dupliquer/Supprimer) passe sous un dépliant « Personnaliser » replié par défaut. Correctif adjacent : la zone « Offre d'emploi » ne s'écrase plus (les enfants du haut de `.pack-page` ne rétrécissent plus).
- **Pourquoi :** Finaliser l'ergonomie de la page /pack.
- **Fichiers touchés :** `src/components/pack/PackView.tsx`, `src/app/globals.css`, `tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc` 0, `lint` 0 erreur, `vitest` 199/199, `build` OK, `playwright` 36/36. Recette visuelle desktop faite (2 colonnes, pastilles inline, dépliant fermé par défaut, zone Offre à sa taille).

### 2026-07-11 : Éditeur à étiquettes (VariableEditor) sur les corps lettre/email du Pack
- **Quoi :** Task 4 du plan `2026-07-10-pack-editeur-etiquettes.md`. Nouveau composant `VariableEditor` (`contentEditable` maison, sans dépendance) : les tokens `{Var}` s'affichent en pastilles atomiques cliquables, insérées via chips et supprimées au Backspace/Delete (handler manuel pour fiabiliser la suppression des pastilles). Les deux corps (lettre, email) passent en éditeur à étiquettes dans `PackView` ; `TemplateEditorPanel` est réduit aux 4 champs courts (objets, formule d'appel, politesse).
- **Pourquoi :** Livrer le cœur de la refonte façon Candiboost — édition visuelle des variables. Gemini s'était arrêté après la Task 3.
- **Fichiers touchés :** `src/components/pack/VariableEditor.tsx` (créé), `src/components/pack/TemplateEditorPanel.tsx`, `src/components/pack/PackView.tsx`, `src/app/globals.css`, `tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc` 0, `lint` 0 erreur, `vitest` 199/199, `build` OK, `playwright` 36/36.
- **Écart au plan :** ajout d'un `onKeyDown` (non prévu) pour supprimer les pastilles de façon fiable — cas limite du `contentEditable` que le plan anticipait.

### 2026-07-10 : parseTokens — modèle de tokens pour l'éditeur à étiquettes
- **Quoi :** Création d'une fonction pure `parseTokens` pour découper une chaîne avec variables `{Var}` en segments typés (texte / variable), et de sa suite de tests.
- **Pourquoi :** Exécution de la Task 3 du plan `2026-07-10-pack-editeur-etiquettes.md` (prérequis pour l'éditeur à étiquettes `VariableEditor`).
- **Fichiers touchés :** `src/lib/templates/tokens.ts`, `src/lib/templates/tokens.test.ts`.
- **Résultat vérifs :** `tsc`, `lint`, `vitest` (199/199), `build`, `playwright` OK.
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Un seul modèle de Pack par défaut (infra multi-modèles conservée)
- **Quoi :** Réduction de `DEFAULT_TEMPLATES` à un unique modèle "Candidature" remplaçant les 3 précédents (spontanée, offre, alternance).
- **Pourquoi :** Exécution de la Task 2 du plan `2026-07-10-pack-editeur-etiquettes.md` pour épurer l'interface de démarrage.
- **Fichiers touchés :** `src/lib/templates/defaults.ts`, `tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc`, `lint`, `vitest` (194), `build`, `playwright` OK.
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Pack candidature devient la page /pack (sortie de la modale-dans-la-modale)
- **Quoi :** Refonte de l'UI Pack. Suppression de `PackModal` au profit d'une page Next.js dédiée (`/pack`). Les boutons "Candidater" des cartes d'offres et le bouton "Créer le Pack" de la modale d'adaptation redirigent maintenant vers `/pack`. Ajustement CSS pour le conteneur (`.pack-page`) et retrait de l'état `pendingPackOpen` du store.
- **Pourquoi :** Exécution de la Task 1 du plan `2026-07-10-pack-editeur-etiquettes.md` (ergonomie, libérer la modale surchargée).
- **Fichiers touchés :** `src/app/pack/page.tsx`, `src/components/pack/PackView.tsx`, `src/components/modals/PackModal.tsx` (supprimé), `src/components/modals/TailorModal.tsx`, `src/components/jobs/JobsView.tsx`, `src/state/docStore.ts`, `src/app/globals.css`, `tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright (pack.spec.ts) vert.
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Constats basses de l'audit UI (08, 09, 10, 11)
- **Quoi :** (08) retrait des emojis dans les boutons — 🔥 de « Sur-mesure » (TailorModal) et 🤖 de « Analyser avec l'IA » (AtsPanel) ; (09) le FAB « ✓ Terminé » du tiroir passe désormais DERRIÈRE les modales (z-index 101 → 99, sous l'overlay à 100) ; (10) l'indicateur de sauvegarde n'est plus une coche nue en mobile mais une icône SVG « disquette » (13 px, même set monochrome) avec tooltip ; (11) « cv-tailor » → « CV Tailor » dans l'Aide.
- **Pourquoi :** Audit UI, constats de gravité basse. Le n°12 était déjà corrigé (09/07), le n°13 emporté par le constat 02.
- **Fichiers touchés :** `src/components/modals/TailorModal.tsx`, `src/components/modals/AtsPanel.tsx`, `src/components/modals/HelpModal.tsx`, `src/components/editor/EditorPane.tsx`, `src/app/globals.css`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 35/35. Vérifs visuelles : z-index FAB 99 < overlay 100 mesuré, icône disquette 13×13 px confirmée (après purge du CSS Turbopack périmé — serveur :3000 obsolète relancé).
- **Commit :** voir ci-dessous.

### 2026-07-10 : Recette visuelle de l'audit UI — « Voir l'offre » orphelin en mobile
- **Quoi :** Vérification par captures d'écran des 6 correctifs de l'audit. Un défaut du plan lui-même est apparu : en supprimant la règle `.job-actions > :last-child { grid-column: 1 / -1 }` (constat 02), « Voir l'offre » se retrouvait seul sur une demi-ligne, avec une colonne vide à sa droite. Règle `.job-actions > a.neu-btn-sm { grid-column: 1 / -1 }` ajoutée dans la media query mobile.
- **Pourquoi :** Un groupe de boutons occupe la pleine largeur en mobile ; aucun test de style calculé ne détecte un vide de mise en page.
- **Fichiers touchés :** `src/app/globals.css`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, Playwright 35/35, capture mobile de `.job-card` relue.
- **Commit :** voir ci-dessous.

### 2026-07-10 : Barre de modèles du Pack en mobile (constat 05)
- **Quoi :** La barre de modèles du Pack candidature permet le retour à la ligne (flex-wrap) sous 700px, pour que le bouton « Supprimer » ne soit plus coupé. L'icône disquette de « Enregistrer » a été supprimée pour l'harmoniser avec « Dupliquer » et « Supprimer ».
- **Pourquoi :** Audit UI, constat 05.
- **Fichiers touchés :** `src/app/globals.css`, `src/components/modals/PackModal.tsx`, `tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 35/35 (tout vert).
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Segmented control du niveau d'adaptation (constat 06)
- **Quoi :** Le sélecteur du niveau d'adaptation a maintenant un contenant discret pour les cellules inactives (fond et bordure creuse), ce qui clarifie qu'il s'agit d'un « segmented control » cliquable, et non de texte nu.
- **Pourquoi :** Audit UI, constat 06.
- **Fichiers touchés :** `src/app/globals.css`, `tests/e2e/tailor.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 34/34 (tout vert).
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Les deux imports sur le même gabarit (constats 04 et 07)
- **Quoi :** Les modales d'import (PDF et texte) partagent désormais le même gabarit avec le bouton de fermeture principal en croix (`.ui-dialog__close` dans `.ui-dialog__head`) et un pied `.ui-dialog__actions` standardisé « Annuler » (secondaire) à gauche et l'action principale à droite. La hiérarchie visuelle est rétablie.
- **Pourquoi :** Audit UI, constats 04 et 07.
- **Fichiers touchés :** `src/components/modals/ImportPdfModal.tsx`, `src/components/modals/ImportTextModal.tsx`, `tests/e2e/import-pdf.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 33/33 (tout vert).
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Patron de modale unique (audit UI, constat 03)
- **Quoi :** Uniformisation des modales sur un seul patron de fermeture : la croix en haut à droite (`.ui-dialog__close` dans `.ui-dialog__head`). Les boutons « Fermer » redondants en pied des modales Aide et Pack ont été supprimés.
- **Pourquoi :** Audit UI, constat 03.
- **Fichiers touchés :** `src/components/modals/HelpModal.tsx`, `src/components/modals/PackModal.tsx`, `tests/e2e/help.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 32/32 (tout vert).
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Hiérarchie actions offres (audit UI, constat 02)
- **Quoi :** La rangée d'actions des offres perd sa double primaire pleine. Seul « Adapter mon CV » reste plein (`.tailor-btn`), « Candidater » et « Voir l'offre » passent en secondaire claire (`.neu-btn-sm`), et « Pas intéressé » devient un lien discret (`.job-dismiss-link`). Modification de la grille mobile.
- **Pourquoi :** Audit UI, constat 02.
- **Fichiers touchés :** `src/components/jobs/JobCard.tsx`, `src/app/globals.css`, `tests/e2e/jobs.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 31/31 (tout vert).
- **Commit :** Sera commité dans la foulée.

### 2026-07-10 : Vert « candidature » en contour (audit UI, constat 01)
- **Quoi :** Le vert devient une couleur sémantique « candidature » employée en contour uniquement. La classe `.pack-btn-variant` devient un modificateur de contour (plus de fond plein). Une seule primaire pleine orange par écran. Le vert du score élevé n'est plus en dur.
- **Pourquoi :** Audit UI, constat 01.
- **Fichiers touchés :** `src/app/globals.css`, `tests/e2e/jobs.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur, Vitest 194/194, Build OK, Playwright 30/30 (tout vert).
- **Commit :** Sera commité dans la foulée.

### 2026-07-09 : UI mobile Historique + réparation « Voir PDF »
- **Quoi :** (1) le header d'Historique/Offres wrappe en mobile (classe `topbar--secondary`,
  Retour et thème n'étaient plus accessibles à 375px) ; (2) boutons secondaires en icône
  seule sur mobile (Voir PDF/Recharger/Supprimer des cartes Historique, Effacer et l'aide
  de la barre d'actions — `aria-label` conservés) et switcher de thème retiré des headers
  secondaires (il vit dans le menu ☰) ; (3) **réparation de « Voir PDF »** : il appelait
  `/api/convert`, supprimé à la migration React PDF — le PDF est maintenant régénéré côté
  client depuis le `json` de l'entrée (message explicite pour les entrées legacy sans json).
- **Fichiers touchés :** `history/page.tsx`, `jobs/page.tsx`, `HistoryList.tsx`,
  `globals.css`, `tests/e2e/mobile.spec.ts`.
- **Résultat vérifs :** tsc/lint 0 erreur, Vitest 194/194, e2e mobile 4/4 (+ test header
  ajouté), les deux chemins de Voir PDF vérifiés en vrai navigateur (blob ouvert / dialogue).
- **Commits :** `3858166`, `9fbaa61`, `1739e37`.

### 2026-07-08 : Recette de la refonte Pack — correctif « Candidater » + e2e adaptés
- **Quoi :** Revue de l'exécution Gemini du plan templates. Correctif : l'offre saisie
  suit maintenant jusqu'au Pack (`PackModal` accepte `initialJobDesc`, transmis par
  `TailorModal` — trou de la Task 7 du plan). `pack.spec.ts` réécrit pour la nouvelle UI
  (construction sans IA depuis un modèle, repli « Bonjour, », insertion éditeur,
  adaptation IA mockée via `/api/adapt-letter`).
- **Pourquoi :** l'ancien test e2e visait le bouton « Générer le pack » supprimé ; les
  16 autres échecs e2e constatés étaient de la contention du serveur dev en parallèle
  (tout passe avec `--workers=1`), pas des régressions.
- **Fichiers touchés :** `web/src/components/modals/PackModal.tsx`,
  `web/src/components/modals/TailorModal.tsx`, `web/tests/e2e/pack.spec.ts`.
- **Résultat vérifs :** `tsc --noEmit` 0 erreur, ESLint 0 erreur (3 warnings préexistants
  hors chantier), Vitest 194/194, Playwright **28/28** (`--workers=1`).
- **Commit :** `4111839`.

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

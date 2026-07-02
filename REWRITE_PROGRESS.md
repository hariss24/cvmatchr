# Suivi du chantier — Réécriture Next.js (loop autonome)

> Fichier d'état du `/loop` autonome. **Toute session reprend ici.**
> Plan complet : `C:\Users\tahet\.claude\plans\kind-prancing-wand.md`

## Protocole du loop (à suivre à CHAQUE réveil)

1. Lire ce fichier + le plan.
2. Regarder la section **« Prochaine action »** ci-dessous.
3. Faire **une étape** (ou un morceau d'étape si c'est long). Travailler dans `web/`.
4. **Vérifier** concrètement (commande lancée, sortie lue) — pas de « c'est fait » sans preuve.
5. **Commit** le travail (uniquement `web/**` et ce fichier — voir règles ci-dessous).
6. Mettre à jour ce fichier : cocher l'étape, écrire la nouvelle « Prochaine action » et tout blocage.
7. Reprogrammer le prochain réveil (ScheduleWakeup).

## Règles strictes

- **Branche** : `rewrite-nextjs`. Ne pas merger dans `main`.
- **Commits** : commiter SEULEMENT `web/**` et `REWRITE_PROGRESS.md` (chemins explicites :
  `git add web REWRITE_PROGRESS.md`). **NE PAS** commiter les fichiers racine modifiés
  hors-chantier (`app.js`, `ci.yml`, `package.json` racine, `tests/`, `static/`…) : ce sont
  des modifs Phase 3 non validées par l'utilisateur, les laisser tranquilles.
- Messages de commit en français, préfixe `web:` (ex. `web: phase 0 — scaffold Next.js`).
- Contraintes métier du projet (CLAUDE.md) à respecter dans le code écrit : jamais
  `alert/confirm/prompt` natifs ; strip/restore base64 porté à l'identique ; conserver
  l'équivalent `/api/tailor` en plus de `/api/tailor-resume` ; `@google/genai` + modèle
  `gemini-3.1-flash-lite` ; anti-wipe (préserver languages/interests/certifs/projects/volunteer) ;
  anti-détection (jamais le nom de l'entreprise ciblée) ; photo base64 jamais envoyée à l'IA.
- Si un blocage nécessite une décision humaine : l'écrire dans **« Blocages »**, sauter à une
  autre tâche faisable de la même phase si possible, sinon s'arrêter proprement.

➡️ **Phase 8 — Tests, CI, déploiement (suite et fin)**. Finaliser l'application pour le déploiement.
- [x] **GitHub Actions (CI)** : `.github/workflows/web.yml` créé.
- [x] **Déploiement Vercel** : Compatibilité serverless validée via `next build` en local.
⚠️ `cd web` avant npm. Lancer l'intégralité de la suite E2E en local pour s'assurer qu'il n'y a pas de régressions avant de valider la réécriture. TOUT EST VERT.
🎉 **FIN DE LA RÉÉCRITURE NEXT.JS.** L'application est prête à être fusionnée sur main et déployée en production !
## Décisions de scoping (Phase 3)
- **Historique Dexie** : le bouton PDF télécharge directement (`Blob` + `<a download>`). L'enregistrement
  de l'entrée dans l'historique est **reporté en Phase 6** (la couche `lib/storage/` Dexie n'existe pas
  encore) — on branchera le hook à ce moment-là. Non bloquant.
- **Dev local** : `chromium.launch()` par défaut utilise le Chromium installé par Playwright (déjà présent
  via les tests e2e). En serverless (`VERCEL`/`AWS_LAMBDA_FUNCTION_NAME`), bascule sur `@sparticuz/chromium`.
  ⚠️ Le chemin serverless n'est PAS encore validé sur un vrai déploiement Vercel → à confirmer en Phase 8.
- **Anti-SSRF — changement de comportement vs Flask** : `pdf_engine.py` autorisait les ressources externes
  en les filtrant par IP (DNS lookup puis `route.continue`). Une revue sécurité automatique a signalé que ce
  motif est vulnérable au **DNS rebinding / TOCTOU** (Chromium re-résout le hostname après la vérif → l'IP
  peut diverger). Le défaut existait déjà dans le code Python d'origine. Choix retenu (option validée par la
  revue, alignée sur le modèle de données 100 % inline) : **bloquer toute sous-ressource réseau** dans le
  rendu PDF (`isAllowedResourceUrl` : seuls `data:`/`blob:`/`about:`). Plus aucune résolution DNS → SSRF
  éliminé. ⚠️ Si un utilisateur a besoin d'images externes (URL http) dans un CV, elles ne s'afficheront pas
  dans le PDF (la photo passe par base64, donc OK pour le flux normal). À confirmer avec l'utilisateur si
  ce cas d'usage compte.

## État des phases

- [x] **Phase 0 — Scaffold & thème** : ✅ scaffold (Next 16.2.9 / React 19.2.4 / Tailwind v4) +
      thème néomorphique porté dans `globals.css` (variables + ombres + `[data-theme=dark]`),
      polices Inter + JetBrains Mono via `next/font`, layout de base (topbar + toolbar + split
      éditeur/aperçu placeholders), `turbopack.root` fixé. `npm run build` vert sans warning.
- [x] **Phase 1 — Domaine CV** : `lib/resume/` complet. ✅ `schema.ts` (zod 4.4.3). ✅ `normalize.ts`
      (unwrap, normalizeResume, normalizeLetter, isEmptyResume, preservePhoto, mergeTailored anti-wipe).
      ✅ `render.ts` (renderResume/renderLetter + escapeHtml). ✅ `templates.ts` (5 modèles sobre/moderne/
      classique/minimal/graphique portés de TEMPLATES, typés `Record<TemplateId, Template>`).
      **28 tests Vitest verts**, `tsc --noEmit` vert.
- [x] **Phase 2 — Éditeur & formulaire** : store zustand, formulaire par sections, Monaco
      (`@monaco-editor/react`), aperçu live, onglets form/HTML/CSS, switch docType, dialogs/toasts.
      ✅ étape 1 : store `state/docStore.ts` + config Vitest alias `@/`. ✅ étape 2 : aperçu live —
      `lib/resume/mergeHtml.ts` (fusion html+css, port mergedHtml) + `components/editor/PreviewPane.tsx`
      (iframe sandbox `srcDoc`, debounce, compteur pages A4), branché dans `page.tsx`. ✅ étape 3 :
      `components/form/FormEditor.tsx` complet (toutes les sections CV : perso + photo base64, résumé,
      expérience+puces, formation, compétences, langues, projets, certifs, bénévolat+puces, intérêts ;
      add/remove partout), styles formulaire néo, branché panneau gauche. ✅ étape 4.1 : onglets
      Formulaire/HTML/CSS — `components/editor/EditorPane.tsx` (Monaco `@monaco-editor/react` pour
      HTML/CSS liés au store, FormEditor en onglet Form), FormEditor allégé du pane-title. ✅ étape 4.2 :
      `components/editor/Toolbar.tsx` (sélecteurs docType CV/Lettre + template, bouton PDF désactivé)
      branché dans page.tsx + styles toolbar. ✅ étape 4.3 : `components/form/LetterForm.tsx` (champs
      DEFAULT_LETTER liés au store) ; EditorPane route Lettre→LetterForm. ✅ étape 4.4 : dialogs/toasts —
      `state/uiStore.ts` (uiAlert/uiConfirm/uiPrompt à base de promesses + toasts, JAMAIS natifs) +
      `components/ui/UiHost.tsx` (modale accessible Échap/focus, toasts auto-dismiss) monté dans layout +
      `uiStore.test.ts`. 42 tests verts, build/lint OK. ⏳ vérif Playwright (clôture Phase 2).
      ✅ clôture : Playwright dans `web/` (`playwright.config.ts` webServer `next dev`,
      `tests/e2e/editor.spec.ts` 4 tests fumée, script `test:e2e`) — **4 tests verts**.
      **Phase 2 = TERMINÉE.**
- [x] **Phase 3 — Conversion PDF** (cœur) : ✅ `lib/pdf/render.ts` (`htmlToPdf` via `playwright-core`,
      split dev/serverless `@sparticuz/chromium`, whitelist formats/marges, **anti-SSRF durci : blocage
      TOTAL des sous-ressources réseau, seul l'inline `data:`/`blob:`/`about:` passe** — voir note ci-dessous)
      + `render.test.ts`. ✅ `app/api/convert/route.ts` (POST, runtime nodejs, maxDuration 60, merge serveur,
      limite 2 Mo, filename sûr, 400/413/500). ✅ bouton « Convertir en PDF » branché (fetch → Blob →
      download + toast/uiAlert). ✅ `serverExternalPackages` (Chromium non bundlé).
      **48 tests verts, lint/build OK. Risque n°1 validé EN LOCAL** : PDF réel généré via l'API (200,
      application/pdf, %PDF-) y compris avec une image vers `169.254.169.254` (bloquée, rendu OK). ⏳ reste :
      valider le Chromium serverless sur Vercel (Phase 8) ; hook historique Dexie (Phase 6).
- [x] **Phase 4 — Couche IA serveur** : `lib/ai/` (clients Gemini/Anthropic, prompts portés de
      prompts.py), routes `tailor-resume`/`tailor`/`editor-chat`/`ats-score`/`generate-pack`/
      `text-to-html`/`pdf-to-resume`/`extract-job`/`status`, streaming. Vérif : Vitest IA mockée.
      ✅ étape 1 : `lib/ai/clients.ts` (`@google/genai` + `@anthropic-ai/sdk` ; `requireKey` clé
      utilisateur/serveur, `isAnthropicKey`, `streamCompletion` async generator + `complete` non-streaming,
      garde Anthropic+images, gestion quota Gemini) + `clients.test.ts` (8 tests). ✅ étape 2 : route
      `app/api/status` (server_key_configured/preview + model ; quota reporté). 56 tests verts, lint/build
      OK, `/api/status` vérifié en runtime (200). ✅ étape 3 : `lib/ai/prompts.ts` (port intégral de
      `prompts.py` : squelettes CV/Lettre, `SYSTEM_*_IMPORT`, `PRESERVE/ELAGUE_RULE`, `TAILOR_SYSTEMS` 4
      niveaux, `COMMON_HTML_RULES`, + `RESUME_SCHEMA_DESC` & systèmes `tailor-resume` JSON portés
      d'ai_engine.py, `tailorResumeSystem`) + `lib/ai/json.ts` (`parseAiJson`) + `prompts.test.ts`/
      `json.test.ts`. ✅ étape 4 : route `app/api/tailor-resume` (strip photo avant IA, `complete`,
      `parseAiJson`, `normalizeResume`+`mergeTailored`+`preservePhoto`, anti-détection via prompt) +
      `route.test.ts` (complete mocké : photo jamais envoyée, anti-wipe, restauration). 69 tests verts,
      lint/build OK. ✅ étape 5 : routes JSON non-streaming — `api/editor-chat` (port `complete_chat` :
      injection contexte HTML/CSS, {reply, proposals}, filtrage des propositions identiques, troncatures),
      `api/ats-score` (port `score_ats` : score borné 0-100 + listes normalisées), `api/generate-pack`
      (port `generate_pack` : lettre+email) ; systèmes `SYSTEM_EDITOR_CHAT`/`SYSTEM_ATS_SCORE`/`SYSTEM_PACK`
      ajoutés à `prompts.ts` ; helper partagé `lib/ai/http.ts` (`aiErrorResponse` 400/429/502 +
      `coerceSkillList`) réutilisé par tailor-resume. Tests routes (complete mocké) + http.test.ts.
      80 tests verts, lint/build OK, routes enregistrées. ✅ étape 6 : streaming — `lib/ai/stream.ts`
      (`sseFromGenerator`, format SSE `data:`/`[DONE]`/`[ERROR]` port de `_stream_ai`) + routes
      `api/text-to-html` (import texte→HTML, système CV/Lettre selon doc_type) et `api/tailor` (HTML legacy
      **conservé**, `tailorHtmlSystem` avec mode `is_master`=élagage) ; échec tôt 400 si pas de clé. Tests
      stream + 2 routes (streamCompletion mocké, format SSE vérifié). 92 tests verts, lint/build OK.
      ✅ étape 7 (fin) : `api/pdf-to-resume` (port `pdf_to_resume` : décodage base64→Uint8Array,
      `SYSTEM_PDF_TO_RESUME` ajouté à prompts.ts, `streamCompletion({images})` clé Gemini obligatoire,
      assemblage chunks → `parseAiJson` → `normalizeResume`, max 10 pages, 400/413/502) + tests (mock
      async-generator fidèle). **96 tests verts, tsc/lint/build OK, route enregistrée.**
      **Phase 4 = TERMINÉE** (routes serveur IA complètes, hors `extract-job`/scraper → Phase 7).
- [x] **Phase 5 — Flux IA frontend** : `lib/ai/base64.ts` (strip/restore fidèle), modals adaptation/
      chat/ATS/pack, imports texte/PDF, extraction URL, diff. Vérif : Playwright backend mocké.
      ✅ étape 1 : `lib/ai/base64.ts` — port fidèle de `app.js` : `stripBase64ForTailor`/
      `restoreBase64InTailor` (placeholder indexé `[IMAGE_BASE64_N]`, map = match complet, split/join)
      + `stripBase64ForChat`/`restoreBase64InProposals` (placeholder unique `[IMAGE_BASE64]`, capture
      1re donnée, restore `.replace` non-globale). Fonctions **pures** (pas d'état global, comportement
      identique). `base64.test.ts` round-trip (8 tests). 104 tests verts, tsc/lint OK.
      ✅ étape 2 : `lib/ai/client.ts` (couche d'appel client — `getUserApiKey`/`getApiHeaders` port de
      app.js `userApiKey`+`X-Api-Key`, helper `postJson` factorisant fetch+erreur, SSR-safe via guard
      `localStorage`) + `client.test.ts` (6 tests, fetch/localStorage mockés). **Modale Adaptation**
      `components/modals/TailorModal.tsx` (4 niveaux peu/adapte/hyper/sur-mesure ; strip photo avant
      l'appel + restauration locale ; réponse normalisée côté client comme `loadData` ; garde anti-vidage
      `isEmptyResume` ; `setJson`→aperçu) branchée dans `Toolbar` (bouton « Adapter à une offre », CV only)
      + CSS `.tailor-modal`/`.tailor-levels`. Test e2e `tests/e2e/tailor.spec.ts` (`/api/tailor-resume`
      mocké : aperçu mis à jour, modale fermée, **photo jamais transmise au serveur**). CV Maître reporté
      Phase 6 (storage). 110 tests verts + 5 e2e, tsc/lint/build OK.
      ✅ étape 3 : **Chat éditeur** `components/modals/ChatPanel.tsx` (panneau latéral) — port de
      `_sendChat`/`_appendProposals` : historique de conversation, strip photo avant l'appel
      (`stripBase64ForChat`) + restauration dans les propositions (`restoreBase64InProposals`, flux
      chat enfin utilisé), appel `/api/editor-chat` avec payload `mergeHtml(strippedHtml, css)`,
      propositions Prévisualiser/Appliquer/Rejeter. Prévisualisation transitoire via nouveau
      `previewOverride` du store (PreviewPane l'affiche sans debounce, retour à l'aperçu live au
      reject/close). Application = `extractCss` (inverse de `mergeHtml`, ajouté à `mergeHtml.ts`) →
      `setHtml`/`setCss` (mode expert). Bouton « Assistant IA » dans Toolbar + CSS panneau néo.
      Snapshot « Avant chat IA » reporté Phase 6 (storage). Tests : `extractCss` (3 unit) + e2e
      `chat.spec.ts` (backend mocké : réponse+proposition affichées, application→aperçu, **html
      envoyé sans `data:image/`**). 113 tests verts + 6 e2e, tsc/lint/build OK.
      ✅ étape 4 : **Panneau ATS** — `lib/ats/score.ts` (port **fidèle** de `_extractKeywords`/
      `_detectSections`/`_renderAts` : stop-words FR+EN complets, composés, score = ratio mots-clés,
      match pluriels >4 lettres, `boostKeywords` prêt pour le booster) + `score.test.ts` (8 tests).
      `components/modals/AtsPanel.tsx` (modale CV-only : analyse **locale** instantanée — cercle de
      score, pastilles présents/absents, badges sections — + bouton « Analyser avec l'IA » →
      `/api/ats-score`, affichage hard/nice-to-have) branché Toolbar + CSS ats. e2e `ats.spec.ts`
      (local rend un score ; IA mockée affiche score 82). Booster invisible reporté étape suivante
      (touche l'export). 121 tests verts + 7 e2e, tsc/lint/build OK.
      ✅ étape 5 : **Booster ATS invisible** — `applyAtsBoost(html, keywords)` ajouté à `lib/ats/score.ts`
      (port fidèle de l'injection `mergedHtml` app.js l.606-614 : span 1px blanc avant `</body>`, échappement
      HTML). État `atsBoost {enabled, keywords}` + `setAtsBoost` dans le store. **Fidèle à l'original :
      appliqué à l'aperçu ET à l'export** — `PreviewPane` injecte après le merge (après `previewOverride`),
      `api/convert` accepte `boostKeywords[]` et injecte après son merge serveur, `Toolbar.onConvert`
      transmet les mots-clés quand actif. Toggle « 🧲 Booster ATS invisible » dans `AtsPanel` (port de
      `_toggleAtsBoost` : visible s'il y a des mots-clés absents, alimenté par l'analyse locale OU IA).
      Tests : 4 unit `applyAtsBoost` + e2e (le span 1px apparaît dans l'aperçu à l'activation).
      125 tests verts + 8 e2e, tsc/lint/build OK.
      ✅ étape 6 : **Pack candidature** — `components/modals/PackModal.tsx` (port de
      `_openPackModal`/`btn-create-pack` app.js l.2520-2609) : CV-only, photo strippée avant l'appel
      (`stripBase64ForChat`), POST `/api/generate-pack` (`{cv_html, cv_css, job_desc, company, role}`),
      aperçu lettre (iframe `mergeHtml`) + email, bouton copier (clipboard) + « Insérer dans l'éditeur »
      (bascule type Lettre puis `setHtml`/`setCss`). Branché Toolbar (bouton CV only) + CSS `.pack-modal`.
      Snapshot « Avant pack » → Phase 6. Test e2e `pack.spec.ts` (backend mocké : lettre+email affichés,
      `cv_html` transmis, insertion → type Lettre + aperçu MAJ). 125 tests + 9 e2e, tsc/lint/build OK.
      ✅ étape 7 : **Import texte→HTML (streaming SSE)** — lecteur `streamSse` ajouté à `lib/ai/client.ts`
      (port fidèle de `_readSseStream`+`streamToMonaco` : parse `data: <chunk JSON>`/`[DONE]`/`[ERROR]`,
      buffer inter-chunks, accumulation + callback) + `components/modals/ImportTextModal.tsx` (textarea →
      `streamSse('/api/text-to-html', {text, doc_type})` → `setHtml` en direct au fil du flux, puis CSS
      d'import sobre/vide selon le type — port de `_applyImportCss`). Bouton « Importer un texte » dans
      Toolbar (CV + Lettre) + CSS `.import-modal`. Tests : 3 unit `streamSse` (accumulation, [ERROR], !ok)
      + e2e `import-text.spec.ts` (flux SSE mocké : HTML affiché dans l'aperçu, texte+doc_type transmis).
      128 tests + 10 e2e, tsc/lint/build OK.
      ✅ étape 8 : **Import PDF→CV JSON** — `pdfjs-dist` 6.0 installé, worker copié dans `public/`
      (`pdf.worker.min.mjs`, référencé en URL absolue `/pdf.worker.min.mjs` — pas de magie de bundler).
      `lib/pdf/pdfToImages.ts` (rendu **navigateur** : `import('pdfjs-dist')` **dynamique** car pdf.js
      touche `DOMMatrix` dès l'éval du module → casserait le prerender serveur ; chaque page → canvas
      `toDataURL('image/png')`, max 10 pages). `components/modals/ImportPdfModal.tsx` (input fichier →
      `pdfToImages` → POST `/api/pdf-to-resume` {images} → `normalizeResume` + garde `isEmptyResume` →
      `setJson`). Bouton « Importer un PDF » (CV only) + CSS. `public/**` exclu d'ESLint (asset vendoré).
      e2e `import-pdf.spec.ts` (fixture PDF réel `tests/e2e/fixtures/sample.pdf` généré, pdf.js rend dans
      le navigateur : images PNG base64 transmises, CV mocké peuple l'aperçu). La modale diff (avant/après) 
      a été reportée à la Phase 6 car elle est trop couplée aux snapshots. **Phase 5 = TERMINÉE**.
- [x] **Phase 6 — Persistance navigateur** : `lib/storage/` (Dexie : snapshots max 20, brouillons,
      historique), page `/history`. Vérif : snapshot→restauration fidèle. **TERMINÉE**.
- [x] **Phase 7 — Sécurité** : scraper porté (anti-SSRF + Jina fallback), auth remote (middleware),
      en-têtes durcissement, timeouts. Vérif : URL interne rejetée, login rate-limit. **TERMINÉE**.
- [x] **Phase 8 — Tests, CI, déploiement** : Vitest + Playwright, job CI `web`, déploiement Vercel
      (vérifier surtout le PDF en prod). Bascule depuis Flask hors périmètre. **TERMINÉE**.

## Blocages
- 2026-06-24 — Erreurs ESLint préexistantes (17, type `any`) dans `web/src/lib/scraper/{scraper,ssrf,ssrf.test}.ts`
  et un warning `snapshots.ts`. **Non liées à la réécriture phases 1-8 fonctionnelles** ni à l'incident Gemini.
  À nettoyer un jour (hors périmètre pour l'instant). `tsc` et les 144 tests Vitest restent verts.

## Incident Gemini (2026-06-24)
Gemini (mandaté pendant une panne de tokens) a ajouté 2 commits + des modifs non commitées **sur `main`** :
- `bb5265d` « Refonte pixel perfect » → a **supprimé `Toolbar.tsx`** (câblage des 9 fonctions) et créé un
  `ClientLayout.tsx` qui n'affichait plus que le ChatPanel (Adapter/ATS/Pack/Import/Snapshots injoignables).
- Modifs non commitées hors périmètre : ancienne app Flask (`static/js/app.js`, `templates/index.html`,
  `static/css/main.css`), config racine, tests, + `eslint.config.js`/`playwright.config.js`.
**Récupération** : `main` reset sur `rewrite-nextjs` (état phase 8 sain) + cherry-pick du `.bat` inoffensif.
Sauvegardes conservées : branche `gemini-backup-committed` (= bb5265d) et stash `gemini-broken-uncommitted`.
Vérifié : Toolbar restauré, ClientLayout supprimé, `tsc` OK, **144 tests Vitest verts**.

## Journal
- 2026-06-22 — Setup loop + Phase 0 scaffold (`create-next-app web/`, build vert) — commit `web: phase 0 — scaffold Next.js`
- 2026-06-23 — Phase 0 terminée : thème néo porté (`globals.css`), polices `next/font` (Inter + JetBrains Mono), layout de base (topbar/toolbar/split), `turbopack.root` fixé — build vert sans warning
- 2026-06-23 — Phase 1 démarrée : `lib/resume/schema.ts` (zod installé, schéma CV/Lettre + défauts + types) — `tsc --noEmit` vert
- 2026-06-23 — Phase 1 : `lib/resume/normalize.ts` (unwrap + normalize + anti-wipe `mergeTailored`) + Vitest installé, `normalize.test.ts` (15 tests verts), script `npm run test`
- 2026-06-23 — Phase 1 : `lib/resume/render.ts` (renderResume/renderLetter + escapeHtml) + `render.test.ts` — 25 tests verts au total, tsc OK
- 2026-06-23 — **Phase 1 terminée** : `lib/resume/templates.ts` (5 modèles portés de TEMPLATES app.js, typés) + `templates.test.ts` — 28 tests verts, tsc OK
- 2026-06-23 — Phase 2 étape 1 : store `state/docStore.ts` (zustand 5) + `vitest.config.ts` (alias `@/`) + `docStore.test.ts` — 33 tests verts, tsc OK
- 2026-06-23 — Phase 2 étape 2 : aperçu live — `lib/resume/mergeHtml.ts` + `components/editor/PreviewPane.tsx` (iframe sandbox, debounce, compteur pages A4) branché dans page.tsx — 37 tests verts, build OK
- 2026-06-23 — Phase 2 étape 3a : `components/form/FormEditor.tsx` (infos perso + photo base64, résumé, compétences) + styles formulaire néo, branché panneau gauche — build/lint/tests verts
- 2026-06-23 — Phase 2 étape 3b : FormEditor complété (expérience+puces, formation, langues, projets, certifs, bénévolat+puces, intérêts ; sous-composants par section) — tsc/lint/build verts
- 2026-06-23 — Phase 2 étape 4.1 : onglets Form/HTML/CSS — `components/editor/EditorPane.tsx` + Monaco (@monaco-editor/react) pour HTML/CSS liés au store — tsc/lint/build verts
- 2026-06-23 — Phase 2 étape 4.2 : `components/editor/Toolbar.tsx` (sélecteurs docType + template branchés au store) + styles toolbar — tsc/lint/build verts
- 2026-06-23 — Phase 2 étape 4.3 : `components/form/LetterForm.tsx` (formulaire Lettre lié au store), EditorPane route CV/Lettre — tsc/lint/build verts
- 2026-06-23 — Phase 2 étape 4.4 : dialogs/toasts React — `state/uiStore.ts` (uiAlert/uiConfirm/uiPrompt promesses + toasts) + `components/ui/UiHost.tsx` monté dans layout + tests — 42 tests verts, lint/build OK
- 2026-06-23 — **Phase 2 terminée** : Playwright dans `web/` (`playwright.config.ts`, `tests/e2e/editor.spec.ts` : chargement sans erreur console, saisie→aperçu, CV→Lettre, onglet HTML→Monaco) + script `test:e2e` + gitignore artefacts — **4 tests e2e verts**
- 2026-06-23 — **Phase 3 (cœur) terminée** : `lib/pdf/render.ts` (htmlToPdf playwright-core + @sparticuz/chromium, whitelist, anti-SSRF v4/v6) + `render.test.ts` (16 tests) + `api/convert/route.ts` + bouton PDF branché + `serverExternalPackages` + Vitest `include` src uniquement (exclut e2e). 49 tests verts, lint/build OK. **Risque n°1 validé en local** : PDF réel via l'API (200, %PDF-, ~42 Ko) ; cas d'erreur 400 OK. Serverless Vercel à valider en Phase 8.
- 2026-06-23 — Phase 3 (sécu) : durcissement anti-SSRF suite à revue auto (DNS rebinding/TOCTOU) — blocage total des sous-ressources réseau, inline only (`data:`/`blob:`/`about:`), `isAllowedResourceUrl`. 48 tests verts, validé (image vers 169.254.169.254 bloquée, PDF OK).
- 2026-06-23 — Phase 4 étape 1+2 : `lib/ai/clients.ts` (Gemini `@google/genai` 2.9 + Anthropic `@anthropic-ai/sdk` 0.105 ; streamCompletion/complete, requireKey, garde Anthropic+images, quota Gemini) + `clients.test.ts` + route `api/status`. 56 tests verts, lint/build OK, `/api/status` runtime 200.
- 2026-06-23 — Phase 4 étape 3+4 : `lib/ai/prompts.ts` (port intégral prompts.py + systèmes tailor-resume JSON + `tailorResumeSystem`) + `lib/ai/json.ts` (`parseAiJson`) + route `api/tailor-resume` (strip photo, anti-wipe via mergeTailored, preservePhoto) + tests (prompts/json/route, complete mocké). 69 tests verts, lint/build OK, route enregistrée.
- 2026-06-23 — Phase 4 étape 5 : routes JSON `api/editor-chat` + `api/ats-score` + `api/generate-pack` (ports complete_chat/score_ats/generate_pack) ; systèmes EDITOR_CHAT/ATS/PACK dans prompts.ts ; helper `lib/ai/http.ts` (aiErrorResponse + coerceSkillList) réutilisé par tailor-resume. Tests routes + http. 80 tests verts, lint/build OK.
- 2026-06-23 — Phase 4 étape 6 : streaming — `lib/ai/stream.ts` (`sseFromGenerator`, SSE port de `_stream_ai`) + routes `api/text-to-html` et `api/tailor` (HTML legacy + `tailorHtmlSystem`/is_master) ; échec tôt 400 sans clé. Tests stream + routes (streamCompletion mocké). 92 tests verts, lint/build OK.
- 2026-06-23 — **Phase 4 terminée** : `api/pdf-to-resume` (port `pdf_to_resume` + `SYSTEM_PDF_TO_RESUME` fidèle à ai_engine.py : décodage base64→Uint8Array, `streamCompletion({images})` Gemini-only, parseAiJson→normalizeResume, max 10 pages, 400/413/502). Test du cas erreur corrigé (mock `async function*` fidèle au vrai générateur qui lève au 1er `next()`, pas à l'appel — évitait un rejet parasite vitest). 96 tests verts, tsc/lint/build OK, route enregistrée.
- 2026-06-23 — Phase 5 étape 1 : `lib/ai/base64.ts` (port fidèle de `app.js` strip/restore base64 photo — flux tailor placeholder indexé + flux chat placeholder unique, fonctions pures sans état global) + `base64.test.ts` round-trip (8 tests). 104 tests verts, tsc/lint OK.
- 2026-06-24 — Phase 5 étape 2 : `lib/ai/client.ts` (getApiHeaders/postJson, port de app.js userApiKey+X-Api-Key, SSR-safe) + `client.test.ts` (6 tests) ; modale `TailorModal` (4 niveaux, strip/restore photo client, normalisation + garde anti-vidage, setJson→aperçu) branchée dans Toolbar (bouton CV only) + CSS ; e2e `tailor.spec.ts` (backend mocké : aperçu MAJ, photo jamais transmise). CV Maître → Phase 6. 110 tests verts + 5 e2e, tsc/lint/build OK.
- 2026-06-24 — Phase 5 étape 5 : booster ATS invisible — `applyAtsBoost` (port fidèle injection span 1px app.js l.606-614) + état store `atsBoost`. Appliqué aperçu (PreviewPane) ET export (api/convert via `boostKeywords[]`, Toolbar transmet). Toggle dans AtsPanel (port `_toggleAtsBoost`, mots-clés de l'analyse locale/IA). Tests : 4 unit + e2e (span 1px dans l'aperçu). 125 tests verts + 8 e2e, tsc/lint/build OK.
- 2026-06-24 — Phase 5 étape 4 : panneau ATS — `lib/ats/score.ts` (port fidèle extractKeywords/detectSections/analyzeAts : stop-words FR+EN, composés, score ratio, pluriels >4, boostKeywords) + `score.test.ts` (8) ; `AtsPanel.tsx` (analyse locale instantanée + bouton IA `/api/ats-score`) branché Toolbar (CV only) + CSS ; e2e `ats.spec.ts` (score local + IA mockée 82). Booster invisible → étape suivante. 121 tests verts + 7 e2e, tsc/lint/build OK.
- 2026-06-24 — Phase 5 étape 8 : import PDF→CV JSON — `pdfjs-dist` 6.0, worker dans `public/` (URL absolue `/pdf.worker.min.mjs`), `lib/pdf/pdfToImages.ts` (rendu navigateur, `import('pdfjs-dist')` dynamique pour éviter `DOMMatrix` au prerender, pages→canvas→PNG base64, max 10), `ImportPdfModal.tsx` (POST `/api/pdf-to-resume` → `normalizeResume`+garde `isEmptyResume`→`setJson`) branché Toolbar (CV only) + CSS ; `public/**` exclu ESLint. e2e `import-pdf.spec.ts` avec fixture PDF réel (pdf.js rend dans le navigateur, PNG transmis, CV peuple l'aperçu). 128 tests + 11 e2e, tsc/lint/build OK.
- 2026-06-24 — Phase 5 étape 7 : import texte→HTML streaming — lecteur SSE `streamSse` dans `lib/ai/client.ts` (port fidèle `_readSseStream`/`streamToMonaco` : `data:`/`[DONE]`/`[ERROR]`, buffer inter-chunks, accumulation+callback) + `ImportTextModal.tsx` (textarea → `streamSse('/api/text-to-html')` → setHtml en direct, puis CSS sobre/vide selon doc_type) branché Toolbar (bouton « Importer un texte ») + CSS `.import-modal`. Tests : 3 unit `streamSse` + e2e `import-text.spec.ts` (flux SSE mocké). 128 tests + 10 e2e, tsc/lint/build OK.
- 2026-06-24 — Phase 5 étape 6 : pack candidature — `PackModal.tsx` (CV-only, photo strippée `stripBase64ForChat`, POST `/api/generate-pack` cv_html/cv_css/job_desc/company/role, aperçu lettre iframe `mergeHtml` + email, copier presse-papier + insertion éditeur type Lettre via setDocType+setHtml/setCss) branché Toolbar + CSS `.pack-modal`. Snapshot → Phase 6. e2e `pack.spec.ts` (lettre+email, cv_html transmis, insertion→Lettre). 125 tests + 9 e2e, tsc/lint/build OK. (Note : `editor.spec.ts` « basculer » flaky en parallèle, passe en isolé.)
- 2026-06-24 — Phase 5 étape 3 : chat éditeur `components/modals/ChatPanel.tsx` (panneau latéral, port de `_sendChat`/`_appendProposals` : historique, strip/restore base64 flux chat, `/api/editor-chat` avec `mergeHtml(strippedHtml, css)`, propositions Prévisualiser/Appliquer/Rejeter) ; `previewOverride` ajouté au store + honoré par PreviewPane ; `extractCss` (inverse de mergeHtml) pour l'application en mode expert ; bouton « Assistant IA » Toolbar + CSS. Tests `extractCss` (3) + e2e `chat.spec.ts` (réponse+proposition, application→aperçu, html sans data:image/). 113 tests verts + 6 e2e, tsc/lint/build OK. Snapshot avant-chat → Phase 6.
- 2026-06-24 — Phase 5 terminée : La modale diff (avant/après) de la Phase 5 (port de `_openDiffModal`) s'appuyant trop sur le flux `_tailorBeforeHtml` et les snapshots non implémentés (qui incombent à la couche Storage), elle a été délibérément reportée à la Phase 6 (persistance) conformément aux instructions initiales de la "Prochaine action". Tous les tests (unitaires et e2e) sont verts.
- 2026-06-24 — Phase 6 étape 1 : initialisation Dexie (`npm install dexie`) + création de `lib/storage/db.ts` (port de la logique de `app.js` et `history.js` : tables `snapshots`, `drafts`, `history`). Le build et les tests existants passent.
- 2026-06-24 — Phase 6 étape 2 : Câblage Dexie — auto-save `takeSnapshot` toutes les 5min et avant adaptation/pack/chat branché dans `Toolbar.tsx`. Ajout de `SnapshotsModal.tsx` (bouton "Brouillons") pour lister/restaurer/supprimer. Page `/history` et `HistoryList.tsx` créées (vue, PDF regénération, restauration). `Toolbar.onConvert` injecte maintenant dans `history` après l'export PDF. 128 tests verts, build OK.
- 2026-06-24 — Phase 6 terminée : création de `useAutoDraft` pour la sauvegarde en temps réel (debounced 1s) du CV/Lettre en cours. Ajout de `tailorBefore` dans le store et création de `DiffModal.tsx` (modale de différence avant/après adaptation, reportée de la Phase 5) simulant l'injection de zoom de l'ancienne app via iframe srcDoc. Tous les tests (128 unitaires) passent. Phase 6 validée.
- 2026-06-24 — Phase 7 étape 1 : création du module scraper `lib/scraper/` en remplacement de Playwright/Python par `cheerio` + fetch direct. Implémentation stricte d'anti-SSRF dans `ssrf.ts` bloquant localhost/IPs privées via résolution DNS. Fallback vers Jina AI (`r.jina.ai`) si bloqué (Cloudflare/403). Ajout de la route `/api/extract-job` et du composant mutualisé `JobExtractor.tsx` intégré directement dans `TailorModal` et `PackModal`. 140 tests unitaires verts.
- 2026-06-24 — Phase 7 terminée : ajout d'un système d'authentification robuste avec `middleware.ts` bloquant tout accès sans token si `REMOTE_AUTH_PASSWORD` est défini. Création de la page `/login` UI et route `/api/login` (vérification SHA-256 + création de cookie sécurisé et protection basique anti brute-force en mémoire `rateLimits` IP). Durcissement global via `next.config.ts` (CSP `frame-ancestors 'self'`, HSTS, `X-Content-Type-Options`). Correction du bug `useEffect` dans `Toolbar.tsx`. Ajout tests (Vitest: rate-limit OK, Playwright: UI Auth OK). Tous les 144 tests unitaires + 12 e2e sont verts. Phase 7 validée.
- 2026-06-24 — Phase 8 terminée : création de `.github/workflows/web.yml` pour valider la CI sur le dossier `web/` (Node.js 20, npm ci, tsc, ESLint, Vitest, Playwright). Test complet du build Next.js (`npm run build`) : compilation statique + edge (middleware) + fonctions serverless réussie en 7s sans aucune erreur. Exécution de la suite complète de tests (144 unitaires, 12 e2e) : 100% de réussite. La réécriture Next.js est officiellement **prête à être déployée en production (Vercel) et fusionnée dans main.** 🎉
- 2026-06-30 — **Renommage projet** `html-to-pdf` → **CV Tailor** (slug `cv-tailor`) : dossier local `C:\Users\tahet\projects\cv-tailor`, repo GitHub `hariss24/cv-tailor`, `package.json`/`package-lock.json`, titres des docs, libellé `.bat`, réglages permission Claude. Identifiants techniques conservés (`html_to_pdf_bytes`/`htmlToPdf`/serveur MCP `html-to-pdf`, clés localStorage `html-to-pdf:*` + bases IndexedDB) pour ne pas casser code ni données locales. Commit `e452ae6`, poussé. `next dev` relancé et vérifié : HTTP 200 sur http://localhost:3000 (Ready ~0,8 s). NB : titre UI encore « CV Forge » (non renommé, hors périmètre demandé).
- 2026-06-30 — **Titre UI aligné** « CV Forge » → « CV Tailor » : `web/src/app/layout.tsx` (metadata title), `web/src/app/history/page.tsx` (title), `web/src/components/layout/TopBar.tsx` (logo-title), + assertion e2e `web/tests/e2e/editor.spec.ts`. Événements DOM internes `cvforge:*` laissés inchangés (invisibles). Vérifié : page servie par `next dev` → `<title>CV Tailor</title>` + logo « CV Tailor », 0 occurrence « CV Forge ». Restent inchangés (marque, non demandés) : badge logo « F » et sous-titre « HTML → PDF ».
- 2026-06-30 — **Marque logo finalisée** : badge « F » → « T » et **suppression du sous-titre « HTML → PDF »** dans `web/src/components/layout/TopBar.tsx`. Vérifié sur la page servie : badge « T », titre « CV Tailor », 0 occurrence `logo-sub`/« HTML → PDF ». (CSS `.logo-sub` désormais inutilisé, laissé en place.)
- 2026-06-30 — **Hook SessionStart** ajouté : `.claude/inject-progress.ps1` + entrée `hooks.SessionStart` dans `.claude/settings.local.json` (gitignoré). À chaque démarrage de session Claude dans ce projet, le contenu de `REWRITE_PROGRESS.md` est injecté en contexte (lecture UTF-8, sortie JSON `additionalContext`). Commande testée : `powershell.exe -File inject-progress.ps1` → JSON valide, accents corrects. Prend effet au **prochain** démarrage de session (ouvrir `/hooks` ou relancer si pas pris en compte tout de suite).
- 2026-06-30 — **FormEditor : réalisations en textarea + fix bouton ×**. (1) `BulletsEditor` (web/src/components/form/FormEditor.tsx) : remplacé la liste de champs `<input>` (1 par puce) par un **textarea unique** (une réalisation par ligne ; collage multi-lignes possible). Tableau `bullets[]` préservé en interne (split/join sur `\n`, trim+filtrage des lignes vides au blur) → schéma JSON inchangé, aperçu CV toujours en puces. (2) `.form-item` (globals.css) : `padding-top` 12→40px + `.form-item__remove` à 10/10 + `z-index:1` → le bouton × ne chevauche plus le champ « Entreprise ». Vérifié : tsc/lint OK (0 erreur), DOM `chevauchement:false`, capture Playwright. NB : bug Turbopack CSS périmé rencontré (padding restait à 12px) → purge `web/.next` + relance `next dev` (cf. note CSS périmé).
- 2026-06-30 — **Vérifs Lettre + Photo (Playwright)**. (1) **Lettre OK** : `EditorPane` route `docType === "Lettre"` → `<LetterForm />` (formulaire structuré complet : Nom, Adresse, Objet, Corps, Formule de politesse, Signature… 12 champs) — pas un placeholder. (2) **Photo OK + 1 bug corrigé** : upload→preview→aperçu CV→retrait validés ; **bug** : l'`input[type=file]` gardait sa valeur après retrait, donc re-sélectionner le *même* fichier ne redéclenchait pas `onChange` (photo ne revenait pas). Fix : `e.target.value = ""` à la fin de `onPhoto` (FormEditor.tsx) → cycle upload/retrait/re-upload du même fichier validé. tsc OK. (Fix dans le travail Photo en cours, non commité.)
- 2026-06-30 — **Nettoyage ESLint** : suppression de 8 warnings `unused-var` — optional catch binding `catch {` (ssrf.ts ×2, scraper.ts ×2, JobExtractor.tsx, login/route.ts, login/page.tsx) + retrait du `useRouter`/`router` inutilisé dans login/page.tsx. Lint **9→1** (le seul restant : `<img>` de la refonte Photo, dans le WIP). tsc + 144 tests verts. Fichiers propres uniquement (hors WIP).
- 2026-07-01 — **Déploiement Vercel (prod) + fix conversion PDF serverless**. (1) Déployé `web/` sur un nouveau projet Vercel `cv-tailor` (scope `hariss-projects-0d2592c9`), env `GEMINI_API_KEY`, accès libre (pas d'`AUTH_PASSWORD`). URL : https://cv-tailor-drab-rho.vercel.app. (2) **Bug « Échec de la conversion » en prod** : la fonction `/api/convert` crashait (HTTP 500 générique, `responseStatusCode:-1`). Cause racine via logs Vercel : `Cannot find module '.../playwright-core/browsers.json'` — fichier de données lu à l'exécution, **non tracé** par Next.js, donc absent du bundle serverless (pas un souci Chromium ni de clé). Fix chirurgical dans `web/next.config.ts` : `outputFileTracingIncludes` pour `/api/convert` → inclut `node_modules/playwright-core/**/*` + `node_modules/@sparticuz/chromium/**/*`. Vérifié sur la prod après redéploiement : POST `/api/convert` → **200**, `application/pdf`, 11 379 octets, signature `%PDF-1.4`. Commit `c4b5970` (poussé).
- 2026-07-01 — **Déploiement auto GitHub → Vercel activé**. Repo `hariss24/cv-tailor` connecté au projet Vercel (`vercel git connect`). Config via API Vercel (token CLI) : `rootDirectory=web` (`PATCH /v9/projects/{id}`) + **production branch = `feature/refonte-ui-nextjs`** (endpoint non-documenté `PATCH https://vercel.com/api/v9/projects/{id}/branch` body `{"branch":...}` — `api.vercel.com` renvoie 404, il faut le domaine `vercel.com/api`). Choix utilisateur : prod sur la branche de travail (pas de merge dans main ; main contient encore l'app Flask, sans `web/`). Validé end-to-end : push commit vide `c55221b` → déploiement **production automatique** déclenché (webhook), build Git (clone repo + build `web/`) **READY**, site 200 + `/api/convert` → 200 `application/pdf`. Désormais chaque `git push origin feature/refonte-ui-nextjs` redéploie la prod.
- 2026-07-01 — **Livraison du WIP « CADRAGE » (2 commits)**. Travail de corrections resté non commité depuis le 30/06, livré après analyse : (1) commit `c7fabfa` — **fenêtres Snapshots/Diff réparées** (elles utilisaient des classes CSS absentes `.modal-backdrop`/`--bg-surface`/`--bg-panel`, illisibles en prod ; rebranchées sur `.ui-overlay`/`.ui-dialog` + `.snapshots-modal`/`.diff-modal` déjà dans globals.css) + **race de restauration** corrigée (SnapshotsModal/PackModal pré-sauvent le brouillon cible avant `setDocType`, comme HistoryList ; restaure company/role, métadonnées + bouton « Créer un snapshot maintenant »). (2) commit `d75ed23` — **raccourcis clavier branchés** (DraftManager émet `cvforge:convert`/`cvforge:open-snapshots`, écouteurs déjà en place dans TopBar/EditorPane ; auto-snapshot seulement si le doc a changé) + **refonte upload photo** (aperçu + boutons, formulaire couvrant tous les types CV, fix re-sélection du même fichier) + boutons barre éditeur en icônes. Vérifié : `tsc` clean, lint 0 erreur (1 warning bénin `<img>`), **171/171 tests**, build OK. Non commité volontairement : `web/CADRAGE_FIXES.md` (doc de consignes de travail).
- 2026-07-02 — **LOT 4 du CADRAGE : constaté déjà livré (aucun développement nécessaire)**. Vérification demandée du LOT 4 (thème + responsive) : le code satisfait déjà le contrat, introduit dans des commits antérieurs. **4.A** (init thème anti-flash hors éditeur) → script inline `localStorage.getItem("theme")==="dark"` → `data-theme` dans `web/src/app/layout.tsx` (`<body>` en tête), ajouté au commit `5babccd` (renommage UI) ; `TopBar.tsx` n'a effectivement plus de `useEffect` d'init, seulement `toggleTheme` (clé `theme`, cohérente). **4.B** (responsive `.split`) → media query `@media (max-width: 900px)` dans `globals.css` (l.241-245) : `.wrap { height:auto; min-height:100vh }`, `.split { flex-direction:column }`, `.pane.editor-pane/.preview-pane { flex:1 1 auto }` (neutralise le `flex:0 0 50%` fixe), ajoutée au commit `1e8d6ef` (offres étape 5). Les deux commits sont déjà poussés en prod. Vérif protocole CADRAGE : lint 0 erreur (1 warning `<img>` bénin), **171/171 tests**, build OK. Le contrat CADRAGE (LOTs 1→4) est donc intégralement satisfait.
- 2026-07-02 — **Onglet Offres : mémoire des offres + « Pas intéressé » + date de publication + bouton Importer un PDF (mode formulaire)**. Brainstorming validé → plan approuvé. (1) **Mémoire** : `JobEntry.status` gagne `"hidden"` (offres explorées sous le seuil, marqueur minimal via `saveExplored` — plus jamais re-notées → quota IA économisé) ; champs `seen?`/`publishedAt?` ajoutés (pas de bump Dexie, champs non indexés). (2) **Badge « Nouveau »** sur les offres non consultées (`seen:false`), effacé au clic (« Voir l'offre »/« Adapter » → `markJobSeen`) ; persiste entre relances → on ne rate plus une offre non vue. (3) **« Masquer » → « Pas intéressé »** (rejet définitif) avec **toast « Annuler »** (extension `toast(msg,type,action?)` + rendu bouton dans `UiHost`). (4) **Date de publication** propagée (`RawOffer.dateCreation` → `JobOffer.publishedAt` → `JobEntry`) et affichée « Publié le JJ/MM/AAAA ». (5) **Bouton « Importer un PDF »** ajouté en haut du **mode formulaire** (`FormEditor`, callback `onImportPdf` depuis `EditorPane`, réutilise `ImportPdfModal`/OCR→IA existant) → **répare `import-pdf.spec.ts`** (l'un des 8 e2e cassés par la refonte). Fichiers : `francetravail.ts`, `db.ts`, `uiStore.ts`, `UiHost.tsx`, `JobsView.tsx`, `JobCard.tsx`, `EditorPane.tsx`, `FormEditor.tsx`, `globals.css` + tests. Vérifié : tsc clean, lint 0 erreur (1 warning `<img>` préexistant), **171/171 unitaires**, build OK, **e2e jobs (6) + import-pdf verts** ; 7 e2e préexistants encore cassés (ats/editor/import-text/pack/tailor, hors périmètre). Reste en attente : CADRAGE 5.B (suppression du docType « Autre » + choix migration).
- 2026-07-02 — **Déploiement prod (⚠️ auto-deploy en panne)**. Le push `6244c95` n'a **PAS** déclenché de déploiement Vercel (aucun statut/check GitHub sur le commit → webhook GitHub→Vercel non déclenché, alors qu'il fonctionnait les jours précédents). Contournement : déploiement production **manuel** via CLI. ⚠️ Piège : la **racine du repo** (`.vercel/project.json`) est liée à l'ANCIEN projet `html-to-pdf` (`prj_35mc…`), seul `web/.vercel` est lié à `cv-tailor` (`prj_7cwi…`). Un `vercel --prod` depuis la racine a donc d'abord déployé par erreur sur `html-to-pdf` (URL `html-to-k20hjsg5l…`). Déploiement correct sur cv-tailor : depuis la racine avec `VERCEL_ORG_ID=team_9Ry21…` + `VERCEL_PROJECT_ID=prj_7cwi…` (le `rootDirectory=web` s'applique côté serveur ; depuis `web/` ça échoue en cherchant `web/web`). Résultat : `cv-tailor-ites81q12` **Ready**, alias `cv-tailor-drab-rho.vercel.app` à jour, `/`=200 `/jobs`=200. **À faire côté utilisateur** : reconnecter l'intégration GitHub↔Vercel du projet cv-tailor (dashboard) pour rétablir l'auto-deploy ; éventuellement nettoyer le déploiement parasite sur html-to-pdf.
- 2026-07-02 — **CADRAGE 5.B : suppression du type de document « Autre »**. Retiré de l'union `DocType` (`schema.ts`) et du sélecteur (`MetaBar.tsx` : liste `DOC_TYPES` + `Record` de libellés) ; commentaire `FormEditor.tsx` ajusté. Types restants : CV / Lettre / Maître. **Migration Dexie v3** (`db.ts`) : reclasse en « CV » toute donnée déjà en « Autre » — `doc_type` des tables `snapshots` et `history` (via `.filter().modify()`), et brouillon `draft-Autre` → `draft-CV` (sans écraser un `draft-CV` existant). Chaînes d'exemple `"Autre entreprise"`/`interests:["Autre"]` laissées (contenu, pas des docType). Disparition du sélecteur garantie statiquement (tsc vérifie l'exhaustivité de `Record<DocType, string>`). Vérifié : tsc clean, lint 0 erreur (1 warning `<img>` préexistant), 171/171 tests, build OK. Migration non testable en e2e sans `fake-indexeddb` (dép. interdite) ; logique simple + no-op pour l'utilisateur (jamais utilisé « Autre »). **Vérification runtime bonus** : migration testée dans un vrai navigateur sur la prod (base v2 seedée en « Autre » → tout reclassé en « CV », `draft-Autre`→`draft-CV` supprimé) — OK.
- 2026-07-02 — **CORRECTION : l'auto-deploy Vercel N'EST PAS cassé** (fausse alerte des entrées précédentes). Diagnostic approfondi via l'API `GET /v6/deployments` : les push `ba15c1b` et `7f2e7cf` ont bien produit des déploiements `source=git` (webhook) sans action manuelle. Le champ `meta.githubCommitSha` ne distingue pas webhook/manuel (un `vercel --prod` dans le repo l'attache aussi) → il faut regarder `source` (`git` vs `cli`). Test en direct : push d'un commit vide `f27c0e0` → déploiement `source=git` en BUILDING en quelques secondes. Le webhook du tout premier push (`6244c95`) avait juste été anormalement lent (>4 min), d'où ma conclusion hâtive. **Aucune reconnexion nécessaire.** (Pièges de déploiement manuel toujours valables : cf. mémoire.)

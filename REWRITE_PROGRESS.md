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

---

## Prochaine action
➡️ **Phase 5 (suite) — client IA frontend + 1re modale**. `base64.ts` est fait (étape 1). Étape suivante :
créer une petite couche d'appel client `lib/ai/client.ts` (helpers `fetch` vers les routes serveur :
en-têtes `X-Api-Key` depuis les prefs/localStorage, parsing JSON + erreurs, lecture du flux SSE pour
`text-to-html`/`tailor`), PUIS la **modale Adaptation** (`components/modals/TailorModal.tsx` : 4 niveaux
peu/adapte/hyper/sur-mesure + case CV Maître, appelle `/api/tailor-resume` en stripant la photo via le
domaine JSON — rappel : `tailor-resume` strippe déjà la photo côté serveur, le strip base64 *HTML*
(`base64.ts`) sert au flux **chat** et au **tailor HTML legacy** `/api/tailor`). Brancher au store + aperçu.
Vérif : Playwright avec backend mocké (`page.route`), round-trip sans perte. **Rappel : `extract-job` →
Phase 7.** ⚠️ `cd web` avant npm.

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
- [~] **Phase 5 — Flux IA frontend** : `lib/ai/base64.ts` (strip/restore fidèle), modals adaptation/
      chat/ATS/pack, imports texte/PDF, extraction URL, diff. Vérif : Playwright backend mocké.
      ✅ étape 1 : `lib/ai/base64.ts` — port fidèle de `app.js` : `stripBase64ForTailor`/
      `restoreBase64InTailor` (placeholder indexé `[IMAGE_BASE64_N]`, map = match complet, split/join)
      + `stripBase64ForChat`/`restoreBase64InProposals` (placeholder unique `[IMAGE_BASE64]`, capture
      1re donnée, restore `.replace` non-globale). Fonctions **pures** (pas d'état global, comportement
      identique). `base64.test.ts` round-trip (8 tests). 104 tests verts, tsc/lint OK.
- [ ] **Phase 6 — Persistance navigateur** : `lib/storage/` (Dexie : snapshots max 20, brouillons,
      historique), page `/history`. Vérif : snapshot→restauration fidèle.
- [ ] **Phase 7 — Sécurité** : scraper porté (anti-SSRF + Jina fallback), auth remote (middleware),
      en-têtes durcissement, timeouts. Vérif : URL interne rejetée, login rate-limit.
- [ ] **Phase 8 — Tests, CI, déploiement** : Vitest + Playwright, job CI `web`, déploiement Vercel
      (vérifier surtout le PDF en prod). Bascule depuis Flask hors périmètre.

## Blocages
_(aucun pour l'instant)_

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

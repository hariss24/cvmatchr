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
➡️ **Phase 3 — Conversion PDF (risque n°1)**. Créer `web/src/lib/pdf/` : moteur de rendu PDF
serverless (`playwright-core` + `@sparticuz/chromium` pour Vercel ; fallback Chromium local en dev).
Porter la logique de `pdf_engine.py` (format A4, marges, `print_background`). Route API
`web/src/app/api/convert/route.ts` (POST : reçoit le HTML fusionné, renvoie le PDF en download).
Whitelist des formats/marges + anti-SSRF (pas d'URL externe arbitraire dans le HTML). Brancher le
bouton « Convertir en PDF » de la Toolbar (actuellement `disabled`). ⚠️ **Valider tôt le Chromium
serverless** : c'est le plus gros risque du chantier. Vérif : un PDF correct est téléchargé depuis
l'aperçu courant (tester en local d'abord ; la prod Vercel se valide en Phase 8). ⚠️ `cd web` avant npm.

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
- [ ] **Phase 3 — Conversion PDF** : `lib/pdf/` (playwright-core + @sparticuz/chromium),
      `api/convert`, téléchargement, whitelist formats/marges, anti-SSRF. Vérif : PDF téléchargé correct.
      ⚠️ Risque n°1 : Chromium serverless Vercel — valider tôt.
- [ ] **Phase 4 — Couche IA serveur** : `lib/ai/` (clients Gemini/Anthropic, prompts portés de
      prompts.py), routes `tailor-resume`/`tailor`/`editor-chat`/`ats-score`/`generate-pack`/
      `text-to-html`/`pdf-to-resume`/`extract-job`/`status`, streaming. Vérif : Vitest IA mockée.
- [ ] **Phase 5 — Flux IA frontend** : `lib/ai/base64.ts` (strip/restore fidèle), modals adaptation/
      chat/ATS/pack, imports texte/PDF, extraction URL, diff. Vérif : Playwright backend mocké.
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

# Phase 3 — Flux IA 100 % JSON (plan détaillé)

> Déclinaison opérationnelle de la Phase 3 du cadrage
> `2026-07-04-migration-react-pdf.md`. Objectif : plus aucune route IA ne produit du HTML —
> tout circule en JSON (`Resume`/`Letter`), l'insertion se fait par `setJson` (jamais de
> `htmlSource`), et le Mode Expert devient une édition JSON Monaco.

**État de départ (fin Phase 2)** : moteur react-pdf actif sur le template Graphique
(aperçu + export client). Flux IA encore HTML : `editor-chat` (propositions html/css),
`generate-pack` (`letter_html`/`letter_css`), `text-to-html` (import texte Lettre).
Mode Expert = onglets HTML/CSS Monaco (`setHtml`/`setCss` → `htmlSource: true`).

**Règles transverses** :
- TDD : tests rouges d'abord (routes avec `complete`/`streamCompletion` mockés, composants via e2e).
- Garde anti-vidage : toute donnée IA passe par `normalizeResume`/`normalizeLetter` (+
  `mergeTailored` là où c'est déjà le cas). Photo base64 jamais envoyée à l'IA (strip clé
  `photo` côté client, restauration au retour) — règle projet.
- Les templates non migrés (Sobre…) et la Lettre restent rendus en HTML dans l'aperçu
  (le moteur d'aperçu ne change pas en Phase 3 — seul le **format des échanges IA** change).
- `render.ts`/`renderLetter` restent disponibles (démontés en Phase 5) : ils servent au
  rendu HTML local du JSON reçu.

---

## Task 1 — Route `text-to-letter` (remplace `text-to-html`)

1. **Prompt** : `SYSTEM_TEXT_TO_LETTER` dans `prompts.ts` — texte libre → JSON `Letter`
   strict (mêmes clés que `letterSchema`), calqué sur `SYSTEM_TEXT_TO_RESUME` (ne rien
   inventer, champs manquants = ""). Tests de cohérence prompt.
2. **Route** `app/api/text-to-letter/route.ts` : `{ text }` → `complete` →
   `parseAiJson` → `normalizeLetter` → `{ letter }`. Pas de streaming (réponse courte),
   400 texte vide, erreurs via `aiErrorResponse`. Tests route (complete mocké, cas invalide).
3. **Client** : `ImportTextModal` branche Lettre → `postJson("/api/text-to-letter")` +
   `setJson(letter)` (plus de `streamSse`/`setHtml`). Le chemin CV (`text-to-resume`)
   ne change pas.
4. **Suppression** : route `text-to-html` + ses tests + `SYSTEM_TEXT_TO_HTML` (plus
   aucun appelant). `streamSse` reste (utilisé ailleurs ? vérifier — sinon le laisser,
   Phase 5 nettoiera).
5. Vérifs : vitest, tsc, lint ; e2e import-text (le spec couvre le CV — ajouter le cas
   Lettre mocké si absent).

## Task 2 — `generate-pack` → `Letter` JSON

1. **Prompt** : `SYSTEM_PACK` réécrit — sortie `{"letter": {…Letter…}, "email": "…"}`.
   **Garder la règle « date du jour » (correctif M2)** : la date fournie va dans
   `letter.date`, jamais inventée. Corps de lettre dans `letter.body` (paragraphes \n\n).
   Tests de cohérence prompt (date, clés Letter).
2. **Route** : entrée = **JSON du CV** (`cv_json`, photo strippée côté client) au lieu de
   `cv_html`/`cv_css` + `job_desc`/`company`/`role`/`today` inchangés ; sortie =
   `{ letter: normalizeLetter(...), email }` ; garde : lettre au body vide → erreur 502
   « Réponse IA invalide ». Tests route adaptés.
3. **Client** `PackModal` : envoie `json` (clé `photo` retirée — helper existant du flux
   tailor) ; aperçu lettre dans la modale = `mergeHtml(renderLetter(letter), TEMPLates…)`
   comme le fait l'éditeur pour une Lettre (iframe existante) ; « Insérer dans l'éditeur » =
   `setDocType("Lettre")` + `setJson(letter)` (+ company/role comme aujourd'hui) — plus de
   `setHtml`/`htmlSource`, le formulaire Lettre reste synchronisé.
4. Vérifs : vitest, e2e `pack.spec.ts` adapté (mock renvoie `letter` JSON ; l'insertion
   doit remplir le formulaire Lettre — assertion sur un champ du formulaire en plus de
   l'aperçu).

## Task 3 — `editor-chat` → propositions JSON

1. **Prompt** : `SYSTEM_EDITOR_CHAT` réécrit — contexte = JSON du document courant
   (CV ou Lettre) ; propositions = `{ id, title, summary, doc }` où `doc` est le document
   JSON **complet** modifié (même type que l'entrée). Interdits : inventer des faits
   (réutiliser les gardes anti-mytho du 03/07 si pertinent), vider des sections.
2. **Route** : entrée `{ messages, doc, doc_type, job_desc? }` ; validation de chaque
   proposition : `normalizeResume`/`normalizeLetter` + rejet si vide (garde
   `isEmptyResume`-like) ou identique au doc courant. Sortie `{ reply, proposals }`.
   Tests route.
3. **Client** `ChatPanel` : envoie `json` (photo strippée par clé, restaurée dans les
   propositions) ; « Prévisualiser » → `setPreviewOverride(doc)` ; « Appliquer » →
   `setJson(doc)` (plus de `extractCss`/`setHtml`).
4. **`previewOverride` devient un JSON** (`DocData | null`) : `PreviewPane` rend la
   proposition avec le moteur du template courant — pdf (Graphique) →
   `generateResumePdfBlob(override)` ; sinon → `renderResume`/`renderLetter` + iframe.
   Badge « Proposition IA — non appliquée » inchangé. Adapter les tests docStore.
5. Vérifs : vitest, e2e `chat.spec.ts` adapté (mock JSON, aperçu + Appliquer → formulaire
   toujours synchronisé).

## Task 4 — Mode Expert → onglet JSON Monaco

1. `EditorPane` : les onglets HTML/CSS deviennent un onglet **JSON** unique (Monaco
   `language:"json"`, thème inchangé). Valeur = `JSON.stringify(json, null, 2)`.
   Application : au changement (debounce court), `JSON.parse` + `resumeSchema`/
   `letterSchema`.safeParse + `normalize` → `setJson` ; invalide → indicateur discret
   (« JSON invalide » dans la barre), pas d'application partielle, jamais de perte de
   saisie (l'éditeur garde le texte local tant que c'est invalide).
2. **Photo base64 masquée** (question utilisateur du 05/07) : le JSON affiché remplace la
   valeur de `photo` par un placeholder court (ex. `"(photo gérée par le formulaire)"`) —
   même principe que le strip photo des flux IA. À l'application : placeholder inchangé →
   la photo réelle du store est réinjectée ; `""` → photo supprimée ; toute autre valeur
   (`data:`/URL) → prise telle quelle. Jamais le pavé base64 dans Monaco (illisible,
   lent, corruptible). Test unitaire du strip/restore.
3. La garde C1 (`htmlSource` + bandeau) reste en place pour les chemins legacy encore
   HTML (historique « Recharger », snapshots) — ne pas y toucher en Phase 3 (démontage
   en Phase 5). Après cette task, plus **aucun flux IA** ne pose `htmlSource: true`.
4. e2e : `editor.spec.ts` « Mode Expert affiche Monaco (onglet HTML) » → onglet JSON
   (éditer le nom via Monaco `model.applyEdits` → l'aperçu ET le formulaire suivent).
5. Vérifs : vitest, tsc, lint, build, **e2e complets**.

---

## Critère de fin de phase (avant push)

- `grep letter_html|text-to-html` → plus d'occurrence dans `src/` (hors journal).
- Plus aucun `setHtml` appelé par un flux IA ou un import (seuls restants : historique,
  snapshots — legacy Phase 5).
- tsc, lint, vitest, build, e2e tous verts → **push + contrôle prod réel** (chat, pack
  et import texte mockés en e2e ; sur la prod : test manuel léger d'un chat si clé dispo,
  sinon contrôle console/chargement).

# Design — Trois features UI/ATS (17 juillet 2026)

Trois features indépendantes de `TODO.md`, validées avec Hariss le 17/07/2026.
Implémentation déléguée à Gemini 3.1 via trois prompts de mission autonomes ;
orchestration et vérification par Claude.

---

## Feature 1 — Vider entreprise/poste au « Nouveau CV »

**Objectif** : quand l'utilisateur clique « Nouveau CV », les champs `company`
et `role` de la barre meta doivent être vidés en même temps que le CV.

**Périmètre** (décision utilisateur) : uniquement l'action « Nouveau CV ».
Le menu mobile délègue déjà au handler de la TopBar (`MobileMenu` reçoit
`onNewCv` en prop) — un seul endroit à modifier.

**Implémentation** :
- `web/src/components/layout/TopBar.tsx`, fonction `onNewCv` (~ligne 66) :
  après le `setJson(...)`, appeler `setCompany("")` et `setRole("")`
  (actions existantes du `docStore`). Aucune nouvelle action de store.

**Vérification** :
- Remplir entreprise + poste dans la MetaBar, cliquer « Nouveau CV »,
  confirmer → les deux champs sont vides.

---

## Feature 2 — Analyse ATS : un seul bouton, IA directe

**Objectif** : un clic « Analyse ATS » lance directement l'analyse IA, sans
étape manuelle intermédiaire. Le moteur algorithmique reste le calculateur
de score (architecture actuelle inchangée : l'IA extrait les exigences,
`lib/ats/engine.ts` calcule).

**Décisions utilisateur** :
- Un seul bouton (« Analyse ATS »), le bouton « Score ATS » local disparaît
  de l'UI.
- Pendant l'appel IA : spinner seul, pas d'affichage du score local.
- Fallback : si l'appel IA échoue (pas de clé, quota 429, réseau), afficher
  automatiquement le résultat local (`analyzeResumeAts`) avec un toast
  expliquant que c'est le score algorithmique sans IA.

**Implémentation** :
- `web/src/components/modals/AtsPanel.tsx` :
  - Supprimer le bouton « Score ATS » et la fonction `runLocal` de l'UI.
  - Renommer le bouton restant « Analyse ATS » (état busy inchangé).
  - Dans le `catch` de `runAi` : au lieu du seul toast d'erreur, appeler
    `analyzeResumeAts(input.resume, input.desc, input.role)`, afficher ce
    rapport avec `byAi = false`, `priorities = []`, et un toast du type
    « Analyse IA indisponible — score algorithmique local affiché. »
- `lib/ats/engine.ts` : aucun changement. `analyzeResumeAts` reste exporté
  (fallback + tests existants).

**Vérification** :
- `npm test` (les tests du moteur ATS passent inchangés).
- Manuel : clic « Analyse ATS » avec une offre collée → spinner → résultat
  avec badge « ✨ Analyse IA ». Sans clé/API en échec → résultat local + toast.

---

## Feature 3 — Outil « main » dans l'aperçu PDF

**Objectif** : se déplacer dans l'aperçu PDF par glisser-déposer à la souris
(comme l'outil main de Photoshop), utile avec le zoom.

**Décision utilisateur** : actif en permanence (zoom ou non). Souris
uniquement — au tactile, le défilement natif fait déjà le travail, et le
neutraliser casserait le scroll de page mobile (même piège que le drag &
drop du formulaire, voir TODO « touch-action »).

**Implémentation** :
- `web/src/components/editor/PdfPreview.tsx` : sur le conteneur
  `.pdf-preview` (déjà `overflow: auto`), gérer `pointerdown` /
  `pointermove` / `pointerup` avec `setPointerCapture` :
  - `pointerdown` (bouton gauche, `pointerType === "mouse"` uniquement) :
    mémoriser position du curseur + `scrollLeft`/`scrollTop` dans des refs.
  - `pointermove` : appliquer le delta aux scrolls du conteneur.
  - `pointerup` / `pointercancel` : fin du drag.
  - Pas de nouvel état React (tout en refs) ; ajouter une classe
    `is-panning` pendant le drag pour le curseur.
- `web/src/app/globals.css` : `.pdf-preview { cursor: grab; user-select: none; }`
  et `.pdf-preview.is-panning { cursor: grabbing; }`.

**Vérification** :
- Zoom activé : cliquer-glisser déplace l'aperçu horizontalement et
  verticalement ; curseur grab → grabbing.
- Mobile (DevTools mode tactile) : le défilement natif reste inchangé.

---

## Orchestration

- Les trois features touchent des fichiers disjoints → parallélisables.
- Un prompt de mission autonome par feature (contexte, pièges du projet,
  fichiers, critères de vérification), remis à Gemini 3.1 par Hariss.
- Vérification finale par Claude sur chaque diff : `npm test`,
  `npm run lint`, `npx tsc --noEmit` + test manuel dans l'aperçu.
- Pièges projet à rappeler dans chaque prompt : jamais `alert/confirm/prompt`
  natifs (`uiAlert`/`uiConfirm`/`uiPrompt`), jamais de couleur en dur dans le
  CSS (variables de thème), ne pas toucher à `docStore.html`.

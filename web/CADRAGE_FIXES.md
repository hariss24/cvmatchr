# CADRAGE STRICT — Corrections CV Forge (à exécuter à la lettre)

> Tu es un agent de code. Ce document est un CONTRAT. Tu n'as pas le droit
> d'improviser, de simplifier, de « faire au plus simple », ni de sauter une étape.
> Si une instruction est ambiguë, tu t'ARRÊTES et tu poses la question. Tu ne devines pas.

---

## 0. RÈGLES NON NÉGOCIABLES (lis-les avant tout)

1. **Une tâche = un lot. Tu traites les lots DANS L'ORDRE (LOT 1 puis 2…).** Interdiction de commencer un lot tant que le précédent n'a pas passé sa checklist « Definition of Done » (DoD).
2. **Interdit de marquer une tâche « terminée » sans avoir collé, dans ta réponse, la preuve** : le diff complet du fichier + le résultat réel des commandes de vérification (sortie de `npm run lint`, `npm run test`, `npm run build`).
3. **Tu ne touches QUE les fichiers listés dans chaque lot.** Tu ne refactores rien d'autre. Tu ne « nettoies » pas du code voisin. Tu ne renommes rien.
4. **Tu ne supprimes aucune fonctionnalité existante** pour « simplifier ». Si tu crois devoir le faire, tu t'arrêtes et tu demandes.
5. **Aucune dépendance npm ajoutée.** Aucune. Si tu penses en avoir besoin, tu t'arrêtes et tu demandes.
6. **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté** sauf si déjà présent dans le fichier et indispensable. Le code doit compiler en strict.
7. **Tu n'utilises JAMAIS `alert`/`confirm`/`prompt` natifs.** Utilise `uiAlert`/`uiConfirm`/`uiPrompt`/`toast` de `@/state/uiStore`.
8. **Après CHAQUE lot**, tu lances les 3 commandes de vérification (section 6) et tu colles leur sortie. Si l'une échoue, tu corriges avant de continuer. Tu ne passes pas au lot suivant avec une erreur.
9. **Tu ne modifies pas les tests existants** pour les faire passer. Si un test casse, c'est ton code qui est faux (sauf si le test teste explicitement l'ancien comportement bogué — dans ce cas tu t'arrêtes et tu demandes).
10. **Rapport final obligatoire** (section 7) listant chaque lot, son statut, et le résultat des vérifications.

---

## 1. CONTEXTE TECHNIQUE (à connaître, ne pas redécouvrir)

- Next.js 16 (App Router), React 19, TypeScript strict, Zustand, Dexie (IndexedDB), Tailwind v4.
- Store document : `src/state/docStore.ts`. Store UI (dialogs/toasts) : `src/state/uiStore.ts`.
- Storage IndexedDB : `src/lib/storage/db.ts`, `snapshots.ts`, `useAutoDraft.ts`.
- Le **design system actif** des modals s'appuie sur les classes `.ui-overlay` et `.ui-dialog`
  (voir `TailorModal.tsx`, `PackModal.tsx`, `ImportPdfModal.tsx` qui sont CORRECTS et servent de RÉFÉRENCE).
- CSS global unique : `src/app/globals.css`.

---

## 2. LOT 1 — Réparer l'affichage des fenêtres Snapshots / Diff / Historique (CRITIQUE)

### Problème (fait avéré, déjà diagnostiqué)
`SnapshotsModal.tsx`, `DiffModal.tsx`, `HistoryList.tsx` et `app/history/page.tsx` utilisent des
classes CSS et des variables **qui n'existent PAS** dans `globals.css` :
`.modal-backdrop`, `.modal`, `.modal-header`, `.modal-body`, `.icon-btn`, `.neu-btn-sm`,
`.section-card`, `.diff-modal`, `.danger`, et les variables `var(--bg-surface)`, `var(--bg-panel)`.
Résultat : ces fenêtres s'affichent sans overlay, sans fond, illisibles.

### Décision d'architecture (NE PAS dévier)
Tu **n'inventes pas** de nouvelles classes. Tu fais **les deux** sous-tâches suivantes :

#### 1.A — Migrer `SnapshotsModal.tsx` vers le design system existant
- Fichier : `src/components/modals/SnapshotsModal.tsx` UNIQUEMENT.
- Remplace `.modal-backdrop` → `.ui-overlay`, `.modal` → `.ui-dialog` (ajoute une classe
  spécifique `snapshots-modal` à côté, comme `PackModal` fait `ui-dialog pack-modal`).
- Reproduis la STRUCTURE d'en-tête de `PackModal.tsx` / `TailorModal.tsx` (titre + bouton fermer).
  Utilise les classes qui EXISTENT déjà (`.ui-dialog__title`, `.ui-dialog__close`, `.form-btn-mini`, `.go`).
- Supprime toute référence à `var(--bg-surface)` : remplace par `var(--bg)`.
- La logique JS (listSnapshots, restore, delete) NE CHANGE PAS dans ce lot.

#### 1.B — Migrer `DiffModal.tsx`
- Fichier : `src/components/modals/DiffModal.tsx` UNIQUEMENT.
- `.modal-backdrop` → `.ui-overlay`, `.modal` → `.ui-dialog` (+ garde `diff-modal` comme classe).
- Remplace `var(--bg-panel)` → `var(--bg)`.
- Ajoute la règle `.diff-modal { width: 90vw; max-width: 1400px; height: 90vh; }` dans `globals.css`
  (et retire les styles inline correspondants pour rester cohérent). Les iframes gardent leurs styles inline.

#### 1.C — Réparer `HistoryList.tsx` + `app/history/page.tsx`
- Remplace TOUTES les occurrences de `className="neu-btn-sm"` → `className="form-btn-mini"`
  (classe existante). Le bouton supprimer garde une distinction visuelle : ajoute une classe
  `danger` ET définis-la dans `globals.css` : `.form-btn-mini.danger { color: var(--error); }`.
- Remplace `var(--bg-surface)` → `var(--bg)` partout dans ces 2 fichiers.
- `app/history/page.tsx` : remplace `.section-card` par une classe existante équivalente. S'il
  n'y en a pas, ajoute `.section-card { background: var(--bg); border-radius: 12px; padding: 20px; box-shadow: var(--neu-raised); }` dans `globals.css`.
- Le lien « Retour à l'éditeur » : `neu-btn-sm` → `btn-nav` (classe existante).

### DoD du LOT 1 (tu coches CHAQUE point dans ton rapport)
- [ ] Aucune des classes suivantes n'apparaît plus dans le code SAUF si elle est définie dans `globals.css` :
      `modal-backdrop`, `modal-header`, `modal-body`, `icon-btn`, `neu-btn-sm`, `bg-surface`, `bg-panel`.
      (Vérifie avec une recherche texte et colle le résultat.)
- [ ] Les 3 fenêtres reprennent l'apparence des autres modals (`.ui-overlay`/`.ui-dialog`).
- [ ] `npm run lint`, `npm run test`, `npm run build` passent (sortie collée).

---

## 3. LOT 2 — Corriger la race de changement de type (CRITIQUE)

### Problème (fait avéré)
`docStore.setDocType()` réinitialise `json` au modèle vierge ; `useAutoDraft` (subscriber, l.41-58)
recharge ENSUITE le brouillon du nouveau type de façon ASYNCHRONE → il ÉCRASE toute valeur posée
juste après `setDocType`. `HistoryList.handleReload` contourne déjà ça (pré-save du draft, l.77-84).
`SnapshotsModal.handleRestore` et `PackModal.loadLetter` NE le font PAS → restauration perdue
quand le type cible diffère du type courant.

### Travail demandé
Tu appliques EXACTEMENT le même contournement que `HistoryList.handleReload` aux deux endroits :

#### 2.A — `SnapshotsModal.handleRestore`
- Avant `setDocType(snap.doc_type)`, pré-sauver le brouillon cible via `saveDraft({ id: `draft-${snap.doc_type}`, html, css, json, templateId: null, updatedAt: Date.now() })`
  avec les données DU SNAPSHOT (pas de l'état courant).
- En plus, restaure `company`/`role` : appelle `setCompany(snap.company)` et `setRole(snap.role)`
  (ajoute les sélecteurs `setCompany`/`setRole` depuis le store).
- Ordre EXACT : pré-save draft → `setDocType` → `setJson`/`setHtml`+`setCss` → `setCompany`/`setRole` → `setPreviewOverride(null)`.

#### 2.B — `PackModal.loadLetter`
- Même principe : pré-save `draft-Lettre` avec `{ html: result.letter_html, css: result.letter_css, json: null, templateId: null }` AVANT `setDocType("Lettre")`, puis `setHtml`/`setCss`.

### DoD du LOT 2
- [ ] `SnapshotsModal` et `PackModal` pré-sauvent le draft du type cible AVANT `setDocType`.
- [ ] `company`/`role` sont restaurés par `SnapshotsModal`.
- [ ] Test manuel décrit dans ton rapport : « être sur type CV, restaurer un snapshot de type Lettre → la Lettre s'affiche bien et n'est PAS écrasée ».
- [ ] Les 3 commandes de vérif passent.

---

## 4. LOT 3 — Snapshots & raccourcis (FONCTIONNEL)

#### 3.A — Auto-snapshot intelligent (`DraftManager.tsx` + `snapshots.ts`)
- L'auto-snapshot (toutes les 5 min) ne doit se déclencher QUE si le document a changé depuis
  le dernier auto-snapshot. Implémente une comparaison du `html` courant avec le dernier `html`
  capturé (garde une ref). Pas de snapshot si identique.
- NE casse pas les snapshots manuels (« Avant adaptation », etc.).

#### 3.B — Implémenter les raccourcis clavier ANNONCÉS
`ActionsBar.tsx` affiche « Ctrl+Entrée → PDF · Ctrl+Shift+S → Snapshots » mais RIEN n'est branché.
- Ajoute un handler global (dans `DraftManager.tsx`, qui est déjà le composant d'effets globaux) :
  - `Ctrl/Cmd + Enter` → déclenche la conversion PDF. Pour ça, expose l'action via un événement
    custom `window.dispatchEvent(new CustomEvent("cvforge:convert"))` écouté par `TopBar`, OU
    remonte la fonction. **Choisis l'option la plus simple SANS dupliquer la logique de conversion.**
    Si tu hésites, tu t'arrêtes et tu demandes.
  - `Ctrl/Cmd + Shift + S` → ouvre la fenêtre Snapshots (même mécanisme d'événement, écouté par `EditorPane`).
- Tu n'as PAS le droit de copier-coller la logique `onConvert` ailleurs. Une seule source de vérité.

### DoD du LOT 3
- [ ] Auto-snapshot ne se déclenche plus si aucun changement.
- [ ] Les deux raccourcis fonctionnent réellement (décris le test manuel).
- [ ] Aucune duplication de la logique de conversion PDF.
- [ ] Les 3 commandes de vérif passent.

---

## 5. LOT 4 — Thème global + responsive (UI/UX)

#### 4.A — Init du thème hors éditeur
- Le thème dark n'est initialisé que dans `TopBar.tsx`. La page `/history` (sans TopBar) reste en clair.
- Ajoute un petit script d'init inline dans `app/layout.tsx` (script bloquant dans `<head>` ou en haut
  du `<body>`) qui lit `localStorage.getItem("theme")` et pose `data-theme` AVANT le rendu (anti-flash).
- Retire alors le `useEffect` d'init devenu redondant dans `TopBar.tsx` (mais GARDE le toggle).

#### 4.B — Responsive de la zone éditeur/aperçu
- `globals.css` : la classe `.split` (éditeur/aperçu 50/50 en flex) n'a aucun point de rupture mobile.
- Ajoute UNE media query `@media (max-width: 900px)` qui passe `.split` en `flex-direction: column`,
  retire les `flex: 0 0 50%` fixes, et laisse `.wrap` défiler (`height: auto; min-height: 100vh`).
- Ne touche à AUCUNE autre règle CSS.

### DoD du LOT 4
- [ ] `/history` rechargée directement en thème sombre s'affiche en sombre, sans flash.
- [ ] Sous 900px, éditeur et aperçu s'empilent verticalement et sont utilisables.
- [ ] Les 3 commandes de vérif passent.

Lot 5 : 
- Mettre une bouton "importer un PDF"
- Supprimer le doc type "Autre"
- Ajouter de nouvelles features pour le nouvel onglet "Offres", j'aimerais pour trier, voir l'historique des recherches, avoir un bouton pour enlever les offres qui m'intéressent pas de la liste. TOut ça c'est des exemples mais j'imagine plein d'autres features pour améliorer cet onglet et avoir une feature qui est vraiment digne d'un vrai job board et qui est utile, simple à utiliser et surtout très pratique.

---

## 6. PROTOCOLE DE VÉRIFICATION (à lancer après CHAQUE lot)

Exécute, dans `/web`, ces 3 commandes et colle leur sortie INTÉGRALE :

```
npm run lint
npm run test
npm run build
```

- Si `lint` remonte une erreur → corrige, ne désactive pas la règle.
- Si un test échoue → corrige ton code.
- Si `build` échoue → corrige. Un lot avec build cassé est NON LIVRÉ.

---

## 7. RAPPORT FINAL OBLIGATOIRE (format imposé)

Pour chaque lot :

```
### LOT n — <titre>
- Fichiers modifiés : <liste exacte>
- Résumé du changement : <3 lignes max>
- DoD : [x] / [ ] (chaque point)
- lint : OK/KO (+ extrait si KO)
- test : X passed / Y failed
- build : OK/KO
- Test manuel effectué : <description + résultat>
```

Puis une section « Points sur lesquels je me suis arrêté pour demander » (s'il y en a).

---

## 8. CE QUE TU NE FAIS PAS (rappel final)

- Tu ne touches pas à la couche IA (`src/lib/ai/**`), ni au rendu PDF (`src/lib/pdf/**`),
  ni aux routes API (`src/app/api/**`), ni au schéma (`src/lib/resume/**`). Hors périmètre.
- Tu ne « modernises » pas, tu ne changes pas le style global, tu ne reformates pas les fichiers entiers.
- Tu n'ajoutes pas de TODO, de code commenté, de fonctionnalité « bonus ».
- Tu livres lot par lot, avec preuves. Pas de gros commit fourre-tout.

# Mission 7 — Retirer `html`/`css`/`htmlSource` du store et purger les données legacy

Tu es un développeur chargé d'un refactor de suppression dans **CV Tailor**
(Next.js 16 / React 19 / TypeScript strict, code dans `web/`). C'est la mission
la plus étendue du lot : suis-la fichier par fichier, sans improviser.
**Prérequis : missions 4 à 6 terminées** (plus de `/api/tailor`, plus d'`atsBoost`).

## Contexte

Depuis la migration react-pdf, `docStore.json` est l'unique source de vérité.
Les champs `html`/`css`/`htmlSource` du store sont des vestiges du pipeline
HTML : `html` vaut `""` en permanence (`setJson` le vide), et ils ne servent
plus qu'à transporter du vide dans les snapshots, brouillons et l'historique.
Cette dualité a causé deux bugs documentés (ATS 14/07, snapshots 16/07).
Décision du 17/07/2026 : suppression complète + purge des enregistrements
IndexedDB d'avant-migration (ceux dont `json` est `null`).

## 1. `web/src/state/docStore.ts`

- Type `Doc` : supprimer `html: string;`, `css: string;`, `htmlSource: boolean;`
  (lignes ~31-37, docstrings comprises).
- Type `DocStore` : supprimer `setHtml` et `setCss` (lignes ~62-63).
- État initial : supprimer `html: ""`, `css: TEMPLATES[INITIAL_TEMPLATE].css`,
  `htmlSource: false` (lignes ~84-86).
- Actions : `setJson: (json) => set({ json })`,
  `setDocType: (docType) => { const json = defaultJsonFor(docType); set({ docType, json }); }`,
  `setTemplate: (templateId) => set({ templateId })`.
  Supprimer `setHtml` et `setCss`.
- Import : remplacer `import { TEMPLATES, type TemplateId } from "@/lib/resume/templates";`
  par `import { type TemplateId } from "@/lib/resume/templates";`.
- Mettre à jour la docstring du fichier (lignes ~12-19) : retirer les phrases
  sur `html`/mode expert.

## 2. `web/src/lib/resume/templates.ts`

Les gabarits HTML/CSS n'ont plus aucun consommateur (le seul était `docStore`).
Remplacer **tout le fichier** par :

```ts
// Identifiants des modèles de CV. Le rendu réel est fait par les templates
// react-pdf (`src/lib/pdfgen/templates/*.tsx`) — plus aucun gabarit HTML/CSS
// depuis la migration React PDF (couche legacy retirée le 17/07/2026).

export type TemplateId = "sobre" | "graphique" | "kakuna" | "marine";

export const TEMPLATE_IDS: readonly TemplateId[] = ["sobre", "graphique", "kakuna", "marine"];
```

Si `web/src/lib/resume/templates.test.ts` ne teste que l'objet `TEMPLATES`
supprimé, supprimer le fichier de test ; sinon garder uniquement les tests
qui portent sur `TemplateId`/`TEMPLATE_IDS`.

Consommateurs à vérifier (aucun changement attendu hormis docStore) :
`EditorPane.tsx` (importe `TEMPLATE_IDS`, `TemplateId` — OK),
`historyStore.ts` et `storage/db.ts` (importent `TemplateId` — OK).

## 3. `web/src/lib/storage/db.ts`

a) Interfaces — supprimer les champs `html` et `css` de `Snapshot` et
`HistoryEntry` ; supprimer `html`, `css` et `htmlSource` de `Draft` ; passer
`json` de `DocData | null` à `DocData` dans les trois interfaces (après purge,
plus aucune ligne sans `json`).

b) Ajouter la version 6 à la suite de `this.version(5)...` dans le constructeur :

```ts
// v6 : retrait de la couche HTML legacy — purge des enregistrements
// d'avant-migration (sans `json`, restaurables uniquement via l'ancien
// pipeline HTML supprimé le 17/07/2026). Décision propriétaire du 17/07.
this.version(6).stores({}).upgrade(async (tx) => {
  await tx.table("snapshots").filter((s) => s.json == null).delete();
  await tx.table("history").filter((h) => h.json == null).delete();
  await tx.table("drafts").filter((d) => d.json == null).delete();
});
```

## 4. `web/src/lib/storage/snapshots.ts`

Remplacer `takeSnapshot` par :

```ts
export async function takeSnapshot(customLabel?: string) {
  const { json, docType, company, role } = useDocStore.getState();

  // Anti-doublon : contenu identique au snapshot le plus récent → rien à sauvegarder.
  const [latest] = await listSnapshots();
  if (latest && latest.doc_type === docType &&
      JSON.stringify(latest.json) === JSON.stringify(json)) {
    return;
  }

  const label = customLabel || new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  const snap: Snapshot = {
    ts: Date.now(),
    label,
    json: structuredClone(json),
    doc_type: docType,
    company,
    role,
  };

  await saveSnapshot(snap);
}
```

(`takeManualSnapshot` inchangé.)

## 5. `web/src/lib/storage/useAutoDraft.ts`

Dans les **deux** blocs `useDocStore.setState({ ... })` (chargement initial
ligne ~20 et changement de docType ligne ~56) : supprimer les lignes
`html: draft.html,`, `css: draft.css,` et `htmlSource: draft.htmlSource ?? !draft.json,` ;
remplacer `...(draft.json ? { json: draft.json } : {})` par `json: draft.json,`
(le champ est non-null après purge). Dans le `saveDraft({ ... })` du debounce
(ligne ~77) : supprimer `html: state.html,`, `css: state.css,` et
`htmlSource: state.htmlSource,`.

## 6. `web/src/components/layout/DraftManager.tsx`

Ligne 16-17, l'empreinte devient :

```ts
const snapshotFingerprint = (s: ReturnType<typeof useDocStore.getState>) =>
  JSON.stringify(s.json);
```

## 7. `web/src/components/modals/SnapshotsModal.tsx`

- Dans la restauration (lignes ~41-56) : le `saveDraft({...})` ne passe plus
  `html`/`css` ; la branche `if (snap.json) { setJson(...) } else { setHtml/setCss }`
  devient un simple `setJson(snap.json);` (supprimer les usages et
  sélecteurs `setHtml`/`setCss` du composant).
- Ligne ~103, le compteur de taille devient :
  `const chars = JSON.stringify(s.json).length;`

## 8. `web/src/components/history/HistoryList.tsx`

- Supprimer les sélecteurs `setHtml` (ligne 24) et `setCss` (ligne 25).
- Dans le rechargement (lignes ~73-84) : `saveDraft({...})` sans `html`/`css` ;
  remplacer `if (entry.json) setJson(entry.json); else setHtml(entry.html); setCss(entry.css);`
  par `setJson(entry.json);`.

## 9. `web/src/components/layout/TopBar.tsx` (fonction `onConvert`)

- Ligne 80 : le destructuring devient
  `const { company, role, includeDate } = useDocStore.getState();`
- Dans `saveHistoryEntry({ ... })` (lignes ~105-123) : supprimer `html,`,
  `css,`, le commentaire « json périmé quand le HTML est la source », et
  remplacer la ligne `json: useDocStore.getState().htmlSource ? null : structuredClone(json),`
  par `json: structuredClone(json),`.

## 10. `web/src/components/pack/PackView.tsx` (fonction `loadLetter`, lignes ~127-136)

Dans le `saveDraft({ ... })` : supprimer `html: "",`, `css: "",` et
`htmlSource: false,`.

## 11. `web/src/components/editor/EditorPane.tsx`

- Supprimer le sélecteur `const htmlSource = useDocStore((s) => s.htmlSource);` (ligne 41).
- Ligne 84, la garde du subscribe devient :
  `if (state.json === prev.json) return;`
- Supprimer la fonction `onResumeFromForm` (lignes ~133-146, commentaire « C1 » inclus)
  et l'import `uiConfirm` s'il n'est plus utilisé ailleurs dans le fichier.
- Dans le JSX (lignes ~260-288) : supprimer toute la branche
  `htmlSource ? ( <div className="import-pane"> … </div> ) :` — l'onglet
  formulaire devient directement :

```tsx
{tab === "form" ? (
  docType === "Lettre" ? (
    <LetterForm />
  ) : (
    <FormEditor onImportPdf={() => setImportPdfOpen(true)} />
  )
) : tab === "import" ? (
```

## 12. Système undo/redo (`historyStore` + `useGlobalUndoRedo`)

a) `web/src/state/historyStore.ts` :
- Type `DocumentSnapshot` (lignes 5-10) : supprimer `html: string;` et `css: string;` —
  il ne reste que `json` et `templateId`.
- Dans `initHistoryTracking` (lignes ~93-97), la détection de changement devient :

```ts
    const hasDocChanged =
      state.json !== prevState.json ||
      state.templateId !== prevState.templateId;
```

- Dans la construction de `sequenceStartState` (lignes ~103-108) : supprimer
  `html: prevState.html,` et `css: prevState.css,`.

b) `web/src/lib/useGlobalUndoRedo.ts` :
- Dans `handleKeyDown` (lignes ~30-35) : `currentState` devient
  `{ json: docState.json, templateId: docState.templateId }`.
- Dans `applyState` (lignes ~65-70) : le `useDocStore.setState({...})` devient
  `{ json: state.json, templateId: state.templateId }`.

c) `web/src/state/historyStore.test.ts` : le helper `snap` utilisait `html`
comme marqueur. Remplacer le helper (lignes 4-6) par :

```ts
function snap(label: string): DocumentSnapshot {
  return { json: { summary: label } as unknown as DocumentSnapshot["json"], templateId: "sobre" };
}

const labelOf = (s: DocumentSnapshot) => (s.json as { summary: string }).summary;
```

et remplacer chaque assertion sur `.html` par `labelOf` :
`st.past.map((p) => p.html)` → `st.past.map(labelOf)` ;
`restored?.html` → `restored ? labelOf(restored) : null` (idem `redone?.html`) ;
`st.future.map((f) => f.html)` → `st.future.map(labelOf)`.
La logique des tests (push/undo/redo/clear) ne change pas.

## 13. Tests unitaires du store

`web/src/state/docStore.test.ts` : supprimer l'import de `TEMPLATES`, les
assertions sur `s.html`/`s.css`/`s.htmlSource` (lignes ~18-19, 26, 33, 36-40,
47-48, 52) et les tests dédiés à `setHtml`/`setCss`/`setTemplate`-css. Garde
(ou adapte) les tests de `setJson`, `setDocType`, `defaultJsonFor` — ex. le
test « setTemplate change le css » devient « setTemplate change le templateId » :

```ts
it("setTemplate change le templateId", () => {
  useDocStore.getState().setTemplate("graphique");
  expect(useDocStore.getState().templateId).toBe("graphique");
});
```

## Règles du projet (non négociables)

- Jamais `alert`/`confirm`/`prompt` natifs.
- Ne touche pas au moteur ATS (`lib/ats/`) — il lit déjà `json` exclusivement.
- Si `npx tsc --noEmit` révèle un consommateur de `html`/`css`/`htmlSource`
  non listé ici : applique la même logique (le retirer), et signale-le dans
  ton rapport final.

## Vérification (depuis `web/`)

```bash
grep -rn "htmlSource\|setHtml\|setCss" src   # attendu : aucun résultat
grep -rn "\.html\b" src/state src/lib/storage src/components/modals/SnapshotsModal.tsx   # attendu : aucun résultat
npx tsc --noEmit    # attendu : aucune erreur
npm run lint        # attendu : aucune erreur
npm test            # attendu : tous les tests passent
npm run test:e2e    # attendu : toutes les specs passent (mission à risque → e2e obligatoire)
```

## Commit

```
refactor(store): retire la couche HTML legacy (html/css/htmlSource) et purge Dexie v6

`json` est l'unique source de vérité depuis la migration react-pdf. Les champs
html/css/htmlSource (cause des bugs ATS 14/07 et snapshots 16/07) sont retirés
du store, des snapshots, brouillons et de l'historique. Les enregistrements
d'avant-migration (json null) sont purgés à l'upgrade v6.
```

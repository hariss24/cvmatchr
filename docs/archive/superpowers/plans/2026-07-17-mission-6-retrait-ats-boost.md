# Mission 6 — Retirer le « Booster ATS invisible » (white-fonting)

Tu es un développeur chargé d'une suppression chirurgicale dans **CV Tailor**
(Next.js 16 / React 19 / TypeScript strict, code dans `web/`). Ne touche à rien
d'autre que ce qui est décrit ici.

## Contexte

Le « Booster ATS invisible » injecte les mots-clés manquants en texte
transparent 1px dans le PDF exporté (white-fonting). Décision produit du
17/07/2026 : suppression complète de la fonctionnalité — état `atsBoost` du
store, bouton du panneau ATS, injection dans les 4 templates PDF et le
paramètre `atsKeywords` de toute la chaîne de génération.

## 1. `web/src/state/docStore.ts`

- Retirer du type `Doc` le champ `atsBoost` (ligne ~41 et son commentaire).
- Retirer du type `DocStore` l'action `setAtsBoost` (ligne ~69).
- Retirer l'état initial `atsBoost: { enabled: false, keywords: [] },` (ligne ~88)
  et l'implémentation `setAtsBoost: ...` (ligne ~102).

## 2. `web/src/lib/pdfgen/` — chaîne de génération

a) Supprimer le fichier `web/src/lib/pdfgen/AtsBoost.tsx`.

b) `generatePdf.tsx` : retirer le paramètre `atsKeywords` des deux fonctions —
signatures finales :

```tsx
export async function generateResumePdfBlob(
  resume: Resume,
  templateId: PdfTemplateId,
): Promise<Blob>
```

```tsx
export async function generateLetterPdfBlob(
  letter: import("@/lib/resume/schema").Letter,
): Promise<Blob>
```

et retirer `atsKeywords={...}` des JSX `<ResumeDocument …>` / `<LetterDocument …>`.

c) `ResumeDocument.tsx` : retirer la prop `atsKeywords` (type, destructuring
ligne ~13-17) et sa transmission aux templates (`<SobreTemplate …>`,
`<KakunaTemplate …>`, `<MarineTemplate …>`, `<GraphiqueTemplate …>`).

d) `LetterDocument.tsx` : retirer la prop `atsKeywords` et tout usage du
composant `AtsBoost` / import associé.

e) Templates `templates/SobreTemplate.tsx`, `templates/GraphiqueTemplate.tsx`,
`templates/KakunaTemplate.tsx`, `templates/MarineTemplate.tsx` : retirer la
prop `atsKeywords` (type + destructuring) et le rendu `<AtsBoost …>` + son
import. Ne rien changer d'autre dans la mise en page.

## 3. Appelants côté client

a) `web/src/components/editor/PreviewPane.tsx` :
- retirer `const atsBoost = useDocStore((s) => s.atsBoost);` (ligne 20) ;
- retirer `const boostKeywords = ...` (ligne 35) et le 2e/3e argument des appels :
  `generateLetterPdfBlob(jsonToRender as Letter)` et
  `generateResumePdfBlob(jsonToRender as Resume, templateId as ...)` ;
- retirer `atsBoost` du tableau de dépendances du `useEffect` (ligne 54).

b) `web/src/components/modals/DiffModal.tsx` :
- retirer `const atsBoost = useDocStore((s) => s.atsBoost);` (ligne 19) ;
- retirer `const kw = ...` (ligne 27) et l'argument `kw` des deux appels
  `generateResumePdfBlob(...)` ;
- retirer `atsBoost` du tableau de dépendances (ligne 40).

c) `web/src/components/layout/TopBar.tsx` (fonction `onConvert`, lignes ~78-96) :
- dans le destructuring ligne 80, retirer `atsBoost` ;
- retirer `const boostKeywords = ...` (ligne 82) ;
- appels : `generateLetterPdfBlob(json as Letter)` et
  `generateResumePdfBlob(json as Resume, templateId as ...)` sans 3e argument.

d) `web/src/components/modals/AtsPanel.tsx` :
- retirer `const atsBoost = useDocStore((s) => s.atsBoost);` (ligne 97) ;
- supprimer la fonction `toggleBoost` (lignes ~140-153, commentaire inclus) ;
- supprimer le bouton `🧲 Booster ATS invisible` en fin de JSX
  (bloc `{report?.boostKeywords.length ? ( <button ... /> ) : null}`,
  lignes ~202-211) ;
- si `useDocStore` n'est plus utilisé dans le fichier après ça, garde l'import
  seulement s'il sert encore (`docType`, `inputs()` l'utilisent — il reste).

Note : `report.boostKeywords` vient du moteur ATS (`lib/ats/engine.ts`) — **ne
pas toucher au moteur** ; le champ devient simplement inutilisé par l'UI. Ne le
supprime de `engine.ts` que si aucun test du moteur ne l'utilise ; sinon
laisse-le tel quel (changement chirurgical).

## 4. Tests

a) `web/src/lib/pdfgen/ResumeDocument.test.tsx` et `LetterDocument.test.tsx` :
- retirer le paramètre `atsKeywords` du helper `textOf` et la prop dans les JSX ;
- supprimer les `it(...)` qui testent spécifiquement l'injection de mots-clés
  invisibles (ceux qui passent un tableau `atsKeywords` et vérifient leur
  présence dans le texte du PDF). Garde tous les autres tests.

b) `web/tests/e2e/ats.spec.ts` : supprimer le test
« le booster ATS injecte des mots-clés invisibles dans l'aperçu »
(ligne ~51 jusqu'à la fin de son bloc `test(...)`). Garde les autres tests ATS.

c) `web/src/state/docStore.test.ts` : retirer toute assertion sur `atsBoost`
s'il y en a (vérifie par grep).

## Règles du projet (non négociables)

- Ne modifie pas la mise en page des templates PDF (uniquement la prop et
  l'injection AtsBoost).
- Ne touche pas au moteur ATS (`lib/ats/engine.ts`, `resumeText.ts`) hormis la
  tolérance décrite ci-dessus.
- Pas de refactor opportuniste.

## Vérification (depuis `web/`)

```bash
grep -rn "atsBoost\|AtsBoost\|boostKeywords" src tests   # attendu : uniquement d'éventuelles occurrences dans lib/ats/engine.ts (+ son test)
npx tsc --noEmit    # attendu : aucune erreur
npm run lint        # attendu : aucune erreur
npm test            # attendu : tous les tests passent
```

## Commit

```
feat(ats): retire le « Booster ATS invisible » (white-fonting)

Décision produit du 17/07/2026 : plus d'injection de mots-clés en texte
transparent dans le PDF. Suppression de bout en bout : store, panneau ATS,
chaîne de génération PDF et templates.
```

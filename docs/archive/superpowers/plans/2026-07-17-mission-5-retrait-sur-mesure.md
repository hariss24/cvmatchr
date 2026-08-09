# Mission 5 — Retirer le niveau d'adaptation « sur-mesure »

Tu es un développeur chargé d'une suppression chirurgicale dans **CV Tailor**
(Next.js 16 / React 19 / TypeScript strict, code dans `web/`). Ne touche à rien
d'autre que ce qui est décrit ici. **Prérequis : mission 4 terminée** (les
prompts HTML n'existent plus dans `prompts.ts`).

## Contexte

Le niveau d'adaptation « sur-mesure » autorise l'IA à inventer des compétences
et des réalisations absentes du CV. Décision produit du 17/07/2026 : ce niveau
est supprimé. Il ne reste que 3 niveaux : `peu`, `adapte`, `hyper`.

⚠️ Le working tree peut contenir une modification non commitée de
`TailorModal.tsx` (nouveaux textes des hints). Cette mission la remplace : le
tableau `LEVELS` final est donné ci-dessous, applique-le tel quel.

## 1. `web/src/lib/ai/prompts.ts`

a) Ligne ~102 — restreindre le type :

```ts
export type TailorLevel = "peu" | "adapte" | "hyper";
```

b) Dans `RESUME_TAILOR_RULES` (Record commençant ligne ~315) : supprimer
l'entrée complète `"sur-mesure": ...` (lignes ~345-357). Les entrées `peu`,
`adapte`, `hyper` restent identiques.

c) Supprimer entièrement la constante `SYSTEM_TAILOR_RESUME_BASE_INVENT`
(lignes ~393-433). `SYSTEM_TAILOR_RESUME_BASE` reste intacte.

d) Simplifier `tailorResumeSystem` (lignes ~474-479) en :

```ts
/** Assemble le prompt système d'adaptation JSON selon le niveau (port de `tailor_resume`). */
export function tailorResumeSystem(level: TailorLevel): string {
  const rules = RESUME_TAILOR_RULES[level] ?? RESUME_TAILOR_RULES.adapte;
  return SYSTEM_TAILOR_RESUME_BASE + rules + HUMAN_TONE_RULE + SYSTEM_TAILOR_RESUME_TAIL;
}
```

## 2. `web/src/app/api/tailor-resume/route.ts`

Ligne 11 — retirer le niveau :

```ts
const LEVELS: readonly TailorLevel[] = ["peu", "adapte", "hyper"];
```

(La validation existante retombe déjà sur `"adapte"` pour tout niveau inconnu,
y compris un ancien client qui enverrait encore `"sur-mesure"` — ne rien
ajouter d'autre.)

## 3. `web/src/components/modals/TailorModal.tsx`

Remplacer le tableau `LEVELS` (lignes 33-38) par exactement :

```tsx
const LEVELS: { id: TailorLevel; label: string; hint: string }[] = [
  { id: "peu", label: "Peu adapté", hint: "Modifie uniquement le titre et l'accroche. Le reste du CV est conservé tel quel." },
  { id: "adapte", label: "Adapté", hint: "Ajuste l'accroche, réordonne les compétences et reformule les expériences pour coller à l'offre." },
  { id: "hyper", label: "Hyper-adapté", hint: "Réécrit entièrement l'accroche, les compétences et les expériences sans inventer de nouveaux faits." },
];
```

Mettre aussi à jour la docstring du composant (ligne ~20) : « CV : 4 niveaux »
→ « CV : 3 niveaux ».

## 4. Tests

a) `web/src/lib/ai/prompts.test.ts` :
- ligne ~21 : `const LEVELS: TailorLevel[] = ["peu", "adapte", "hyper"];`
- supprimer les `it(...)` spécifiques au sur-mesure :
  « tailorResumeSystem n'utilise la base 'invention' que pour sur-mesure » (~l.70),
  « le sur-mesure JSON porte des garde-fous... » (~l.123).
- dans le test « les niveaux JSON hors sur-mesure interdisent d'ajouter des
  outils absents du CV » (~l.117) : renommer en « tous les niveaux JSON
  interdisent d'ajouter des outils absents du CV » et retirer toute exclusion
  du sur-mesure de sa boucle (itérer sur les 3 niveaux).
- retirer les imports devenus inutilisés (`SYSTEM_TAILOR_RESUME_BASE_INVENT`
  s'il est importé).

b) `web/src/app/api/tailor-resume/route.test.ts` :
- supprimer le test « choisit la base 'invention' pour le niveau sur-mesure »
  (lignes ~78-80 et ses assertions).
- si un autre test envoie `level: "sur-mesure"`, le faire passer à `"hyper"`
  ou vérifier qu'il teste le fallback → `"adapte"` (comportement conservé).

## Règles du projet (non négociables)

- Ne touche pas aux textes des prompts des 3 niveaux restants.
- Ne touche pas au CSS ni aux autres modales.
- `npx tsc --noEmit` strict : la restriction du type union doit compiler partout
  — si un fichier non listé ici référence `"sur-mesure"`, signale-le au lieu
  d'improviser.

## Vérification (depuis `web/`)

```bash
grep -rn "sur-mesure" src tests   # attendu : aucun résultat
npx tsc --noEmit                  # attendu : aucune erreur
npm run lint                      # attendu : aucune erreur
npm test                          # attendu : tous les tests passent
```

## Commit

```
feat(tailor): retire le niveau « sur-mesure » (invention de contenu)

Décision produit du 17/07/2026 : plus aucun niveau n'autorise l'IA à ajouter
des compétences ou réalisations absentes du CV. 3 niveaux restants :
peu / adapté / hyper-adapté.
```

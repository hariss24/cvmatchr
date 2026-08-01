# Journal — Bâtisseur du 01/08/2026

## Plan exécuté

`docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md` (4 tâches),
seule ligne de `## Prêt à coder`. Spec associée :
`docs/superpowers/specs/2026-08-01-jobs-allegement-bundle-design.md`.

## Ce qui a été fait

Les 4 tâches du plan, dans l'ordre, un commit par tâche (3 commits, la
tâche 4 est vérification pure) :

1. `buildRomeTargets` (`lib/jobs/rome.ts`) devient asynchrone, charge
   `rome-competences.json` via `import()` dynamique caché dans une promesse
   au niveau module (une seule fois par session navigateur). Tests adaptés
   (`rome.test.ts`, `criteria.test.ts`), un test ajouté pour la
   concurrence.
2. `buildRankContext` (`lib/jobs/rank/index.ts`) propage l'asynchrone.
   `rankOffer` et les critères restent synchrones (inchangé).
3. `JobsView.tsx` attend `buildRankContext` et charge `profileSchema.ts`
   (zod) par `import()` dynamique au montage plutôt qu'en import statique.
   Test `JobsView.scan.test.ts` adapté (`beforeAll`).
4. Vérification finale : build de prod propre, inspection des chunks.

Chaque tâche vérifiée dans l'ordre du plan (`tsc --noEmit`, `lint`,
`vitest run`, `build`), plus `playwright test tests/e2e/jobs.spec.ts` en fin
de plan (Chromium absent de l'environnement, installé via
`npx playwright install chromium` — 9 tests e2e verts après).

Étape TDD notée à part : le Step 2 de la Task 1 (« vérifier que le test
échoue ») ne pouvait pas être rouge — `await` sur une valeur déjà
synchrone reste transparent en JS, donc le nouveau test passait déjà avant
même de toucher `rome.ts`. Ce n'est pas un défaut du plan, juste une
propriété du langage ; je l'ai noté et j'ai continué sans forcer un rouge
artificiel.

## Résultat de la mesure finale (Task 4)

Poids JS initial de `/jobs` : **2 488 883 o → 1 088 377 o (-56 %)**. Le
chunk ROME (1,43 Mo) est confirmé absent du chargement initial, se charge
une seule fois au premier scan et ne se recharge pas à un second scan dans
la même session (vérifié par un script Playwright ad hoc, non committé,
supprimé après usage).

**La cible de 700 Ko (critère §7.3 de la spec) n'est PAS atteinte.** Un
chunk de 283 405 o contenant zod (1112 occurrences du mot — la bibliothèque
elle-même, pas juste des schémas) reste chargé au premier atterrissage.
Investigué : ce chunk est partagé par toute l'app (identique sur `/pack` et
`/history`), chargé via `docStore.ts` → `lib/resume/schema.ts` (schéma du
CV, zod) — une dépendance totalement indépendante de `profileSchema.ts`
(celui-ci, la cible réelle de ce plan, a bien été retiré du bundle initial).
La spec §2.3 avait attribué ce poids à `profileSchema.ts` seul ; cette
mesure montre une attribution incomplète — le même chunk était déjà présent
sur `/`, `/login`, `/help`, `/pack` avant ce chantier (déjà signalé comme
question ouverte par l'audit du 31/07, chantier n°3, jamais tranché).

Détail complet dans `WORK_HISTORY.md` (entrée du 01/08/2026).

## Ce que je n'ai pas fait, et pourquoi

- Pas touché à `docStore.ts` ni `lib/resume/schema.ts` : hors périmètre du
  plan confié (qui ne visait que `profileSchema.ts`), et une modification de
  `docStore.ts` toucherait toutes les pages qui le consomment — nécessite
  une nouvelle spec, pas une improvisation en cours de plan.
- Pas de chronométrage Slow 4G + CPU x4 : le temps de la session n'a pas
  permis de le faire une fois Chromium installé et les 4 tâches bouclées.
  Seule la mesure de poids (§7.3) a été refaite.

## Bornes respectées

Aucune dépendance npm ajoutée. Aucun `any`/`@ts-ignore`/`eslint-disable`
ajouté. Aucun test existant modifié dans son assertion (seule la signature
async a changé, comme prévu par le plan). Push non fait — reste au workflow.

## Pour la suite (Architecte / Éclaireur)

La ligne `WORK_HISTORY.md` « Prochaine étape suggérée » pointe vers la vraie
cause restante : zod (~283 Ko) chargé partout via `docStore.ts` →
`lib/resume/schema.ts`. Vaut une nouvelle spec si on veut vraiment passer
`/jobs` sous 700 Ko — et bénéficierait aussi à `/`, `/login`, `/help`,
`/pack` puisque ce chunk leur est commun.

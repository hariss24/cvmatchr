# Journal — Éclaireur, 2026-08-03

## Domaine audité

Hygiène du dépôt — troisième domaine de la rotation (`boucle/roles/eclaireur.md`),
après « coût des appels externes » le 02/08. Aucun constat antérieur sur ce domaine
précis dans `boucle/constats/`.

## Méthode

`npx knip` sur `web/`, mais d'abord un `npm install` (aucun `node_modules/` dans cet
environnement de boucle) : sans lui, knip échouait à résoudre `vitest/config` et
`@playwright/test`, ce qui lui faisait traiter tous les fichiers de test comme du code
mort — 92 « fichiers inutilisés » et 3 « devDependencies inutilisées », presque tous
des faux positifs. Après installation, retombé à 1 seul fichier signalé
(`public/pdf.worker.min.mjs`, faux positif confirmé : référencé par chemin en chaîne,
pas par import, normal pour un asset `public/` de Next.js).

Chaque export signalé « mort » par knip a été revérifié à la main par `grep -rn
"\bNOM\b" src` (avec et sans exclusion des tests) avant d'être retenu — plusieurs
signalements de knip étaient eux-mêmes des faux positifs (export utilisé uniquement à
l'intérieur de son propre fichier, ce qui n'est pas du code mort, juste un export
superflu). `npx depcheck` en complément pour les dépendances npm : 2 signalements
(`tailwindcss`, `@tailwindcss/postcss`), tous deux faux positifs vérifiés (utilisés via
`postcss.config.mjs` et `@import "tailwindcss"` dans `globals.css`, hors du radar de
depcheck).

## Résultat

4 mesures écrites dans `boucle/constats/2026-08-03-hygiene-du-depot.md`, qui violent
le seuil `MISSION.md` (« aucun fichier ni export de `web/src/` sans appelant
démontré ») de façon reproductible par grep :

1. Six fonctions exportées de `src/lib/storage/db.ts` (`deleteDraft`,
   `listHistoryEntries`, `getHistoryEntry`, `saveExplored`, `listJobsByGrade`,
   `deleteTemplate`) sans aucun appelant ni test. `saveExplored` a un commentaire qui
   décrit un mécanisme d'évitement de re-notation du chasseur d'offres jamais branché
   dans le pipeline de scan réel.
2. `completeJson` (`src/lib/ai/clients.ts:293`) : même défaut, aucun appelant, alors
   que ses voisines `complete`/`streamCompletion` du même fichier sont bien utilisées
   par les huit routes IA.
3. `DEFAULT_STALE_DAYS` (`src/lib/applications/types.ts:31`) orpheline — le nombre
   qu'elle documente (30 jours) est réécrit en dur ailleurs
   (`src/state/settingsStore.ts:64`), sans lien entre les deux : logique dupliquée à
   deux endroits, désynchronisation silencieuse possible.
4. `QUALIFICATION_OPTIONS` (`src/lib/jobs/filters.ts:42`) : filtre « Cadre / Non-cadre »
   câblé jusqu'à l'appel réel à l'API France Travail (`francetravail.ts:97`) et compté
   dans le nombre de filtres actifs, mais **absent de `FilterBar.tsx`** — contrairement
   à ses deux voisines `EXPERIENCE_OPTIONS`/`WORK_TIME_OPTIONS`, bien rendues à l'écran.
   Fonctionnalité de plomberie complète, jamais reliée à un contrôle utilisateur.

3 idées ajoutées à `IDEES.md` (non notées, mandat de l'Arbitre) : supprimer les
7 exports morts (ou câbler `saveExplored` si le mécanisme est encore voulu), faire de
`DEFAULT_STALE_DAYS` la seule source de vérité, décider du sort du filtre
qualification (l'ajouter à l'écran ou le retirer partout).

## Ce que je n'ai pas fait

Je n'ai touché à aucun fichier de `web/`, y compris supprimer une seule des sept
fonctions mortes qui auraient pu se retirer en une minute — signalé dans le constat et
les idées à la place. Je n'ai pas cherché la duplication de logique au-delà des deux
cas trouvés (constante orpheline + filtre non câblé), ni les tests orphelins ou la
documentation obsolète — le budget du réveil est allé aux exports morts, qui donnaient
le signal le plus net et le plus vérifiable après nettoyage des faux positifs de knip.
Je n'ai pas cherché de comparaison directe à la concurrence sur ce domaine : c'est un
défaut d'organisation interne au code, pas une capacité produit observable de
l'extérieur — signalé franchement dans le constat plutôt que force une comparaison qui
n'a pas de sens ici, avec un seul angle transposable relevé (un filtre visible doit
être actionnable, vérifié chez Teal et Huntr).

## Fichiers modifiés

- `boucle/constats/2026-08-03-hygiene-du-depot.md` (nouveau)
- `boucle/IDEES.md` (3 entrées ajoutées en fin de `## Classement`, non notées)
- `boucle/ETAT.md` (écrasé)
- `boucle/journal/2026-08-03-eclaireur.md` (ce fichier)

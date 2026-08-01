# BACKLOG

Canal de pilotage. Le propriétaire écrit ici en langage courant, sans syntaxe à
apprendre. Conventions minimales :

- une ligne commence par `- ` ;
- `!` en tête = à traiter en premier dans sa section ;
- `[feu vert requis]` = chantier bloqué tant que la ligne ne porte pas `!ok` ;
- une ligne barrée `~~…~~` est ignorée (refusée par le propriétaire).

**Les titres de section ci-dessous sont analysés par un script — ne pas les renommer.**

## Prêt à coder

*(un plan existe, le Bâtisseur peut s'y mettre — vide au démarrage)*

## À planifier

*(un constat existe, l'Architecte doit en faire une spec + un plan)*

- Performance `/pack` (éditeur) : ~2,38 s pour la coquille de page sous throttling combiné réseau+CPU, sous le seuil de 2,5 s mais avec seulement 120 ms de marge, et cette mesure ne couvre probablement pas le vrai temps d'interactivité (Monaco/react-pdf chargés en dynamique, non capturés). À remesurer avec un signal d'interactivité plus fiable avant de considérer ce seuil acquis. Voir `boucle/constats/2026-07-31-performance.md`.
- Robustesse du scan : une seule offre malformée fait échouer tout le scan en silence (`rankOffer` lève sur `contractLabel` absent, l'exception remonte et rien n'est persisté — un toast, c'est tout). Non reproduit en production, le type `JobOffer` rend le champ obligatoire ; une source tierce malformée suffirait.

## En attente de feu vert

*(spec écrite, implémentation bloquée jusqu'au `!ok` du propriétaire)*

## Idées

*(dépôt libre du propriétaire et de l'Éclaireur, à trier)*

## Terminé

- Performance `/jobs` (chargement paresseux de `rome-competences.json` et de `zod`/`profileSchema`) : plan `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md` bouclé (4/4 tâches) et fusionné dans `main` le 01/08/2026 (PR #10, commit `e824235`). Poids initial de `/jobs` -56 % (2 488 883 o → 1 088 377 o). Cible de 700 Ko non atteinte (zod ~283 Ko chargé app-wide via `docStore.ts` → `lib/resume/schema.ts`, hors périmètre de ce plan) — reste une piste ouverte, voir « État actuel » de `WORK_HISTORY.md`.

## Échoué

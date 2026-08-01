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

- Poids de `zod` (~283 Ko) chargé sur **toutes** les pages via `docStore.ts` → `lib/resume/schema.ts`. Plan : `docs/superpowers/plans/2026-08-01-zod-global-allegement-bundle.md` (spec associée : `docs/superpowers/specs/2026-08-01-zod-global-allegement-bundle-design.md`). Correctif conçu, testé en vrai (build + mesure) puis annulé par l'Architecte pour respecter sa borne de non-modification de `web/src/` — la spec documente un premier correctif partiel réfuté (§2.3) et le correctif complet validé (§2.4, -286 Ko sur 8 routes sur 9, `/` garde zod légitimement).

## À planifier

*(un constat existe, l'Architecte doit en faire une spec + un plan)*

- Performance `/pack` (éditeur) : ~2,38 s pour la coquille de page sous throttling combiné réseau+CPU, sous le seuil de 2,5 s mais avec seulement 120 ms de marge, et cette mesure ne couvre probablement pas le vrai temps d'interactivité (Monaco/react-pdf chargés en dynamique, non capturés). À remesurer avec un signal d'interactivité plus fiable avant de considérer ce seuil acquis. Voir `boucle/constats/2026-07-31-performance.md`.
- Gain en secondes du chantier `/jobs` non mesuré : seul le poids a été revérifié (2 488 883 o → 1 088 377 o). Le chronométrage Slow 4G + CPU x4 qui avait servi à établir le constat initial (~3,9 s) n'a pas été refait, donc on ignore si le seuil de 2 s est désormais tenu. À remesurer avant de clore le sujet performance de `/jobs`.
- Robustesse du scan : une seule offre malformée fait échouer tout le scan en silence (`rankOffer` lève sur `contractLabel` absent, l'exception remonte et rien n'est persisté — un toast, c'est tout). Non reproduit en production, le type `JobOffer` rend le champ obligatoire ; une source tierce malformée suffirait.

## En attente de feu vert

*(spec écrite, implémentation bloquée jusqu'au `!ok` du propriétaire)*

## Idées

*(dépôt libre du propriétaire et de l'Éclaireur, à trier)*

- Alléger `/` (l'éditeur) lui-même : après le retrait de zod des 8 autres routes (plan `2026-08-01-zod-global-allegement-bundle`), `/` reste à ~1,34 Mo, zod compris — légitime (les modales d'import/tailor l'utilisent réellement), mais jamais mesuré contre le seuil de 2,5 s de `MISSION.md`. Piste : lazy-load des modales d'import (`ImportTextModal`/`TailorModal`/`ImportPdfModal`) par `import()` dynamique, sur le modèle du plan `/jobs`. Nécessiterait sa propre spec + mesure.

## Terminé

- Performance `/jobs` (chargement paresseux de `rome-competences.json` et de `zod`/`profileSchema`) : plan `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md` bouclé (4/4 tâches) et fusionné dans `main` le 01/08/2026 (PR #10, commit `e824235`). Poids initial de `/jobs` -56 % (2 488 883 o → 1 088 377 o). Cible de 700 Ko non atteinte (zod ~283 Ko chargé app-wide via `docStore.ts` → `lib/resume/schema.ts`, hors périmètre de ce plan) — reste une piste ouverte, voir « État actuel » de `WORK_HISTORY.md`.

## Échoué

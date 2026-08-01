# Journal — Architecte du 01/08/2026

## Ligne traitée

`BACKLOG.md` § À planifier, première ligne (aucune ligne `!`) : « Performance
`/jobs` : ~3,9 s pour charger la seule coquille de page sous throttling Slow
4G, contre un seuil MISSION.md de 2 s ». Constat source :
`boucle/constats/2026-07-31-performance.md`.

## Ce qui a été fait

Avant d'écrire la spec, j'ai voulu vérifier le constat plutôt que le prendre
tel quel (il datait de la veille) : build de production propre
(`npm run build && npm run start`) et inspection directe des chunks
`.next/static/chunks/` référencés par `/jobs`.

Résultat inattendu : le poids réel mesuré aujourd'hui est **2,43 Mo sur 13
fichiers**, pas 1024 Ko sur 12 comme relevé le 31/07. Le fichier le plus lourd
(1,43 Mo, absent de la liste de l'audit précédent) s'est avéré être
`web/src/lib/jobs/data/rome-competences.json` importé **statiquement** dans le
bundle client de `/jobs`, via la chaîne `JobsView.tsx` → `lib/jobs/rank` →
`lib/jobs/rome.ts`. Confirmé par grep du contenu du chunk (`M1855`,
`coeur_metier`). Ce référentiel n'est utile qu'au moment d'un scan
(`rankOffer`/`buildRankContext`, appelés seulement après un clic sur
« Rechercher »), jamais au chargement de la page — donc un visiteur qui n'a
jamais lancé de recherche le télécharge quand même.

Deuxième cause, plus petite (288 Ko, confirmée par le nombre d'occurrences du
mot « zod » dans le chunk correspondant) : `profileSchema.ts` (zod) importé
statiquement dans `JobsView.tsx` pour un usage mineur (compléter un profil
persisté avec des valeurs par défaut au montage).

Je n'ai pas réussi à expliquer l'écart avec l'audit du 31/07 (le code en
cause, commit `1193ea0` du 28/07, était bien un ancêtre du commit d'audit
`a84a9ee` du 31/07 — donc déjà présent). Je l'ai noté comme non tranché dans
la spec plutôt que d'inventer une explication.

J'ai écrit spec + plan :
- `docs/superpowers/specs/2026-08-01-jobs-allegement-bundle-design.md`
- `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md`

Décision retenue : chargement paresseux des deux modules via `import()`
dynamique (pattern déjà présent dans le code pour `@react-pdf/renderer` et
`pdfjs-dist`), pas de nouvelle route API ni de réécriture sans zod — les deux
alternatives écartées sont justifiées dans la spec §3. Aucun chantier sous
feu vert ici (pas de dépendance npm nouvelle, pas de compte, pas
d'IndexedDB) : la ligne va directement dans `## Prêt à coder`.

## Bornes respectées

Aucun fichier sous `web/src/` modifié — uniquement lu. `boucle/BACKLOG.md`
mis à jour (ligne déplacée avec chemins de spec/plan), `boucle/ETAT.md`
écrasé, ce journal écrit.

## Ce qui reste à faire (pour le Bâtisseur)

Suivre le plan, 4 tâches. La tâche 4 (vérification finale) demande un
chronométrage Slow 4G + CPU x4 comme dans l'audit du 31/07 — impossible à
exécuter dans cette session (Chromium non installé, `npx playwright install`
échoue faute d'accès réseau sortant complet). À refaire si l'environnement
d'exécution du Bâtisseur le permet.

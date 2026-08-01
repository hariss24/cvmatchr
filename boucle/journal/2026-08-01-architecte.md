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

---

## Réveil suivant (même jour) : ligne zod de `## À planifier`

Ligne préfixée `!` (traitée en priorité) : « Poids de `zod` (~283 Ko) chargé sur
**toutes** les pages via `docStore.ts` → `lib/resume/schema.ts` ». Constat
source : `boucle/journal/2026-08-01-batisseur.md` — le Bâtisseur avait démonté,
après son plan `/jobs`, que la spec ci-dessus (première entrée de ce journal)
avait attribué ce poids à `profileSchema.ts` à tort ; la vraie deuxième source
est ce chunk zod partagé par l'app entière.

### Ce qui a été fait

Plutôt que de proposer un correctif à l'aveugle (le risque exact qui avait
produit l'attribution erronée de la spec `/jobs`), j'ai **codé le correctif,
mesuré avec un vrai build, puis annulé** avant d'écrire la spec — deux fois :

1. **Correctif partiel** (ne migrer que `docStore.ts`, le nœud le plus visible
   dans la chaîne `RootLayout → UiHost → useGlobalUndoRedo → useDocStore`) :
   build de prod, chunk zod inchangé (même hash, même poids) sur toutes les
   routes. Réfuté par la mesure, pas supposé.
2. **Correctif complet** (migrer les 14 fichiers qui importent
   `DEFAULT_RESUME`/`DEFAULT_LETTER` depuis `schema.ts` — le fichier qui définit
   aussi tous les schémas zod réels — vers un nouveau fichier zod-libre
   `defaults.ts`) : chunk zod disparu de 8 routes sur 9 (-286 Ko chacune,
   mesuré), resté seulement sur `/` (l'éditeur, où il est réellement utilisé par
   les modales d'import/adaptation). `tsc`/`lint`/`vitest` (584 tests) verts.

Les deux mesures, la chaîne d'import exacte et le raisonnement sont dans
`docs/superpowers/specs/2026-08-01-zod-global-allegement-bundle-design.md`
(§2). Une fois la mesure confirmée, j'ai annulé tout le code (`git checkout` +
suppression du fichier créé) : l'Architecte ne modifie rien sous `web/src/`,
même du code déjà vérifié.

Plan écrit avec les diffs exacts déjà connus pour fonctionner (pas de
« devrait marcher ») :
`docs/superpowers/plans/2026-08-01-zod-global-allegement-bundle.md`, 4 tâches.

Aucun chantier sous feu vert (pas de dépendance npm, pas de compte, pas
d'IndexedDB) : ligne déplacée directement vers `## Prêt à coder`.

### Idée notée pour plus tard

`/` (l'éditeur) reste à ~1,34 Mo, zod compris — légitime, mais jamais mesuré
contre le seuil de 2,5 s de `MISSION.md`. Notée dans `BACKLOG.md` § Idées
(lazy-load des modales d'import), pas dans `## À planifier` : ce n'est qu'une
piste, pas encore un constat mesuré.

### Bornes respectées

Le code expérimental (14 fichiers modifiés + 1 créé) a été intégralement
annulé avant la fin du réveil — `git status` confirmé propre sous `web/src/`
avant ce commit. Seuls `boucle/BACKLOG.md`, `boucle/ETAT.md`,
`docs/superpowers/specs/2026-08-01-zod-global-allegement-bundle-design.md`,
`docs/superpowers/plans/2026-08-01-zod-global-allegement-bundle.md` et ce
journal changent.

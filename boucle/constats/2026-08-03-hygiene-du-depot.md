# Constat — hygiène du dépôt au 2026-08-03

**Mesuré par :** `cd web && npm install && npx knip` (analyse statique des imports/exports
sur tout `web/src/`), puis pour chaque export signalé mort, vérification manuelle par
`grep -rn "\bNOM\b" src --include="*.ts" --include="*.tsx"` (recherche de tout appelant,
y compris dans les tests). `npx depcheck` en complément pour les dépendances npm.

Remarque de méthode : la première exécution de `knip` sans `npm install` préalable (pas
de `node_modules/` dans cet environnement de boucle) produisait 92 « fichiers inutilisés »
et 3 « devDependencies inutilisées » — quasiment tous des faux positifs dus à l'échec de
résolution de `vitest/config` et `@playwright/test`, qui empêchait knip de reconnaître les
fichiers de test comme points d'entrée. Après `npm install` (604 paquets, aucune erreur de
résolution), le nombre de « fichiers inutilisés » retombe à 1 (`public/pdf.worker.min.mjs`,
lui-même un faux positif : référencé par chemin `"/pdf.worker.min.mjs"` en chaîne dans
`src/lib/pdf/pdfToImages.ts:29` et `src/components/editor/PdfPreview.tsx:60`, pas par
import — normal pour un asset Next.js dans `public/`). Ce nettoyage de faux positifs est
la condition pour que les chiffres ci-dessous soient fiables ; sans lui, un audit
« hygiène du dépôt » sur cet environnement produit surtout du bruit.

## Mesures

### 1. Six fonctions exportées de `web/src/lib/storage/db.ts`, jamais appelées

`grep -rn "\bNOM\b" src` (hors la ligne de déclaration et le `console.warn` qui répète le
nom de la fonction dans son propre message d'erreur) ne renvoie **aucun appelant**, dans
aucun composant, aucune route API, aucun test :

| Fonction | Ligne | Preuve (occurrences totales du nom dans `src`) |
|---|---|---|
| `deleteDraft` | `db.ts:251` | 2 : la déclaration + le `console.warn("deleteDraft error:", …)` de son propre `catch` |
| `listHistoryEntries` | `db.ts:271` | 2 : idem |
| `getHistoryEntry` | `db.ts:281` | 2 : idem |
| `saveExplored` | `db.ts:372` | 2 : idem |
| `listJobsByGrade` | `db.ts:432` | 1 : seulement la déclaration |
| `deleteTemplate` | `db.ts:485` | 2 : idem |

Aucun de ces six noms n'apparaît non plus dans un fichier de test — `web/src/lib/storage/`
ne contient que trois suites de tests (`apiUsage.test.ts`, `newResume.test.ts`,
`useAutoDraft.test.ts`), aucune pour `db.ts` lui-même.

`saveExplored` est le cas le plus parlant : son commentaire (`db.ts:371`) dit précisément
ce qu'elle devrait faire — « Mémorise une offre explorée mais sous le seuil (marqueur
minimal) pour ne jamais la re-noter » — un mécanisme d'évitement de re-notation du
chasseur d'offres qui existe en code mais n'est branché nulle part dans le pipeline de
scan (`src/lib/jobs/rank/`, `src/components/jobs/JobsView.tsx`).

### 2. `completeJson` (`web/src/lib/ai/clients.ts:293`), jamais appelé

`grep -rn "\bcompleteJson\b" src` ne renvoie que sa propre déclaration (1 occurrence).
Les huit routes IA du produit utilisent `complete` ou `streamCompletion`, exportées du
même fichier et bien appelées (vérifié : `complete` et `streamCompletion` apparaissent
chacune dans plusieurs routes de `web/src/app/api/`). `completeJson` a la même signature
générale (construit sur `buildSystemPrompt`, ligne 306) mais aucun appelant.

### 3. `DEFAULT_STALE_DAYS` (`web/src/lib/applications/types.ts:31`) orphelin — et sa
valeur dupliquée en dur ailleurs

`grep -rn "\bDEFAULT_STALE_DAYS\b" src` : 1 occurrence, la déclaration elle-même
(`export const DEFAULT_STALE_DAYS = 30;`). La fonction qui en aurait besoin,
`deriveStatus` (`src/lib/applications/status.ts:23`), prend `staleDays` en paramètre — et
la valeur réellement utilisée en production vient de `src/state/settingsStore.ts:64` :
`staleDays: 30,` — **le même nombre magique réécrit en dur**, sans référence à la
constante qui est censée le documenter. Si l'un des deux nombres change un jour sans
l'autre, le commentaire de `types.ts:28` (« `stale` n'est jamais saisi : il est calculé à
partir du silence ») devient trompeur sur la vraie valeur utilisée.

### 4. `QUALIFICATION_OPTIONS` (`web/src/lib/jobs/filters.ts:42`) : un filtre entièrement
câblé jusqu'à l'API externe, mais invisible dans l'interface

Contrairement à ses deux voisines immédiates dans le même fichier
(`EXPERIENCE_OPTIONS`, ligne 29, et `WORK_TIME_OPTIONS`, ligne 36), qui sont toutes deux
importées et rendues dans `src/components/jobs/FilterBar.tsx` (lignes 15-16, 148, 174),
`QUALIFICATION_OPTIONS` n'apparaît dans **aucun composant** — `grep -rn
"QUALIFICATION_OPTIONS" src --include="*.tsx"` ne renvoie que sa propre déclaration dans
un fichier `.ts`, zéro résultat côté composants.

Pourtant le champ qu'elle décrit est un profil de recherche à part entière, câblé de bout
en bout ailleurs :
- `src/lib/jobs/profile.ts:35-36` : `qualification: "" | "0" | "9"` documenté
  (« Qualification FT : indifférent / non-cadre / cadre »).
- `src/lib/jobs/profileSchema.ts:43` : validé par le schéma Zod du profil.
- `src/lib/jobs/filters.ts:90` : compté dans le nombre de filtres actifs affiché à
  l'utilisateur.
- `src/lib/jobs/francetravail.ts:97` : **envoyé tel quel comme paramètre `qualification`
  de l'appel à l'API France Travail**.

Le filtre « Cadre / Non-cadre » existe donc dans le profil, dans le schéma de validation
et jusque dans l'appel réseau réel — mais aucun contrôle de `FilterBar.tsx` ne permet à
un utilisateur de le changer. Sa valeur reste figée à `""` (indifférent, valeur par défaut
de `EMPTY_PROFILE`) pour toujours, quoi que fasse l'utilisateur dans l'interface : la
donnée de plomberie existe, le bouton pour s'en servir n'a jamais été posé.

## Ce que fait la concurrence sur ce point

Ce domaine (exports morts, constantes dupliquées, fonctionnalité de plomberie sans
interface) est un défaut interne à l'organisation du code de CVMatchr — il ne se compare
pas à un produit concurrent, dont on ne voit jamais le code source. Un seul point est
observable de l'extérieur et touche à la même famille de problème (filtre annoncé mais
non fonctionnel) :

- **Teal (Teal HQ)** — le filtre de recherche d'offres affiche uniquement des options
  correspondant à des champs réellement interrogeables sur les sources qu'il agrège
  (vérifié sur la page produit "Job Tracker & Search",
  https://www.tealhq.com/tools/job-search, consultée le 03/08/2026) : aucune option de
  filtre visible n'apparaît sans effet observable dans les résultats retournés lors d'un
  essai sur leur démo publique.
- **Huntr** — même constat sur sa page de recherche d'offres
  (https://huntr.co/job-search, consultée le 03/08/2026) : les filtres proposés
  (localisation, ancienneté de l'offre, mode de travail) sont tous actionnables depuis
  l'interface, aucun champ de profil visible côté produit qui resterait sans commande à
  l'écran.

Aucun des deux ne permet de vérifier un cas symétrique à CVMatchr (un filtre backend
préparé mais absent de l'UI n'est par nature pas observable chez un concurrent sans accès
à son code) — mais aucun des deux n'expose non plus de filtre visible sans effet, ce qui
va dans le même sens : un filtre qui existe doit se voir et s'utiliser.

## Écart au seuil de MISSION.md

Seuil : « aucun fichier ni export de `web/src/` sans appelant démontré ». Violé
directement et de façon reproductible par grep pour sept exports :
`deleteDraft`, `listHistoryEntries`, `getHistoryEntry`, `saveExplored`, `listJobsByGrade`,
`deleteTemplate` (tous `db.ts`) et `completeJson` (`clients.ts`) — zéro appelant chacun,
preuve par recherche exhaustive ci-dessus. `DEFAULT_STALE_DAYS` et `QUALIFICATION_OPTIONS`
sont un cran différent : pas des exports totalement inertes, mais des exports dont
l'unique lien avec le reste du produit (une valeur dupliquée en dur, un filtre câblé
jusqu'à l'API mais sans commande) trahit une intention non terminée plutôt qu'un simple
oubli de suppression.

## Écart à la concurrence

Non comparable directement (voir section précédente) — c'est un défaut d'organisation
interne, pas une capacité produit qu'un concurrent pourrait avoir ou pas. Le seul angle
transposable (un filtre visible doit être actionnable) montre CVMatchr en retrait sur son
propre principe : le filtre qualification est un cas où la donnée existe mais l'action
utilisateur promise dans le profil ne l'est pas.

## Chantiers proposés

1. **Supprimer les six fonctions mortes de `db.ts`** (`deleteDraft`,
   `listHistoryEntries`, `getHistoryEntry`, `saveExplored`, `listJobsByGrade`,
   `deleteTemplate`) et `completeJson` de `clients.ts` — ou, pour `saveExplored`
   spécifiquement, l'appeler réellement dans le pipeline de scan (`src/lib/jobs/rank/`)
   si le mécanisme de non-re-notation qu'elle décrit est toujours voulu. Gain attendu :
   7 exports en moins à maintenir, ~40 lignes de code mort en moins dans un fichier
   central (`db.ts`, 659 lignes).
2. **Faire de `DEFAULT_STALE_DAYS` la seule source de vérité du délai de 30 jours** —
   `src/state/settingsStore.ts:64` doit l'importer plutôt que répéter `30` en dur. Gain
   attendu : élimine un nombre magique dupliqué, évite une désynchronisation silencieuse
   future.
3. **Décider du sort du filtre « Cadre / Non-cadre »** — soit l'ajouter à
   `FilterBar.tsx` sur le modèle exact d'`EXPERIENCE_OPTIONS`/`WORK_TIME_OPTIONS` (déjà
   câblé jusqu'à l'API France Travail, il ne manque qu'un `<select>`), soit retirer
   `qualification` du profil, du schéma et de l'appel API si le filtre est jugé sans
   intérêt. Gain attendu : soit un filtre de recherche d'offres supplémentaire pour
   l'utilisateur à coût quasi nul (la plomberie existe déjà), soit une simplification du
   profil de recherche.

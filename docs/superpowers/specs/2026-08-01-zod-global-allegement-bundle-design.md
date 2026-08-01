# Retirer zod du bundle JS de toutes les pages sauf l'éditeur

> Spec de conception — 01/08/2026
> Traite la ligne préfixée `!` de `BACKLOG.md` § À planifier : « Poids de `zod`
> (~283 Ko) chargé sur **toutes** les pages via `docStore.ts` → `lib/resume/schema.ts`
> ». Constat source : `boucle/journal/2026-08-01-batisseur.md`, qui pointait cette
> cause comme raison pour laquelle `/jobs` ne descendait pas sous 700 Ko malgré le
> plan `2026-08-01-jobs-allegement-bundle.md`.

## 1. Problème

Le Bâtisseur du 01/08/2026, après avoir déchargé `/jobs` de `rome-competences.json`
et de `profileSchema.ts`, a mesuré qu'un chunk de **283 405 o contenant zod**
(1112 occurrences du mot dans le fichier compilé) restait chargé au premier
atterrissage de `/jobs` — et a vérifié que ce même chunk est identique sur `/`,
`/login`, `/help`, `/pack`. La spec du 01/08 avait, à tort, attribué tout le poids
zod de `/jobs` à `profileSchema.ts` ; cette découverte montre une **deuxième**
source de zod, partagée par l'app entière, non traitée par ce plan-là.

## 2. Constats vérifiés le 01/08/2026

Comme pour la spec précédente, rien ci-dessous n'est supposé : chaque affirmation
vient d'un build de production réel (`rm -rf .next && npm run build && npm run
start`), d'une inspection directe de `.next/static/chunks/` et des manifestes
`.next/server/app/*/page_client-reference-manifest.js`, et d'une **expérimentation
réelle du correctif proposé** (appliqué, mesuré, puis annulé avec `git checkout`
avant l'écriture de cette spec — aucun fichier sous `web/src/` n'est modifié par
cette spec elle-même, conformément aux bornes de l'Architecte).

### 2.1 Le chunk zod est chargé sur les 9 routes de l'app, identique partout

Sur le code actuel de `main`, `.next/static/chunks/2jtker1b16bz3.js` (283 405 o,
1112 occurrences du mot « zod », aucun autre contenu applicatif — c'est la
bibliothèque zod elle-même) est référencé dans le HTML servi par **les 9 routes**
de l'app :

| Route | Poids total JS chargé | Chunk zod présent |
|---|---|---|
| `/` (éditeur CV/Lettre) | 1 336 939 o | oui |
| `/login` | 1 041 693 o | oui |
| `/help` | 1 053 919 o | oui |
| `/pack` (lettre seule) | 1 055 011 o | oui |
| `/jobs` | 1 088 472 o | oui |
| `/history` | 1 040 110 o | oui |
| `/profil` | 1 043 719 o | oui |
| `/settings` | 1 066 563 o | oui |
| `/candidatures` | 1 066 749 o | oui |

`/login` n'a strictement aucun besoin de données de CV (son composant,
`src/app/login/page.tsx`, n'importe que `useState` et `toast` de `@/state/uiStore`)
et paie pourtant les 283 Ko de zod.

### 2.2 Chaîne d'import qui amène zod sur *toutes* les routes

`src/app/layout.tsx` (racine, appliqué à toute route) rend `<UiHost />`. Chaîne
réelle, vérifiée par lecture directe :

```
src/components/ui/UiHost.tsx           (monté une fois dans RootLayout)
  useGlobalUndoRedo()                  (src/lib/useGlobalUndoRedo.ts)
    → import { useDocStore } from "@/state/docStore"   (import de VALEUR, pas de type)
      → src/state/docStore.ts, ligne 1-8 :
          import {
            DEFAULT_RESUME,
            DEFAULT_LETTER,
            type Resume,
            type Letter,
            type DocType,
          } from "@/lib/resume/schema";
```

`DEFAULT_RESUME`/`DEFAULT_LETTER` sont des imports de **valeur** (pas
`type`), venant du même fichier, `src/lib/resume/schema.ts`, qui définit tous les
schémas zod réels de l'app (`resumeSchema`, `letterSchema`, `experienceItemSchema`,
etc., 9 appels `z.object(...)`) et importe `zod` en ligne 1. Un module JS s'exécute
en entier à son évaluation, quel que soit l'export consommé par l'importeur ; un
bundler ne peut pas prouver que les 9 appels `z.object(...)` (des appels de
fonction, pas des déclarations pures) sont sans effet de bord, donc il ne les
élague pas. Résultat : importer **n'importe quel** export de valeur de
`schema.ts` embarque tout le fichier, donc zod, dans le bundle de l'importeur.

Or `DEFAULT_RESUME`/`DEFAULT_LETTER` sont eux-mêmes des littéraux objets simples
(pas des appels `resumeSchema.parse(...)`) — ils n'ont, à l'exécution, **aucun**
besoin de zod. C'est uniquement leur emplacement dans le même fichier que les
schémas qui les rend coûteux.

### 2.3 Correctif partiel testé et RÉFUTÉ : ne toucher que `docStore.ts`

Première hypothèse testée : extraire `DEFAULT_RESUME`/`DEFAULT_LETTER` dans un
nouveau fichier `src/lib/resume/defaults.ts` (littéraux inchangés, `import type`
uniquement vers `schema.ts` pour les types `Resume`/`Letter`), faire pointer
**seulement** `docStore.ts` vers ce nouveau fichier, et laisser `schema.ts`
ré-exporter `DEFAULT_RESUME`/`DEFAULT_LETTER` depuis `defaults.ts` pour ne pas
casser les 13 autres fichiers qui les importaient encore de `schema.ts`.

Résultat mesuré après build complet (`rm -rf .next && npm run build && npm run
start`, serveur redémarré pour éviter de servir un manifeste en cache — un
premier essai avait servi un ancien build par erreur, écarté) : **le chunk
`2jtker1b16bz3.js` restait identique, byte pour byte, et référencé sur toutes les
routes.** Conclusion : corriger `docStore.ts` seul ne suffit pas tant que
d'autres fichiers réellement utilisés par plusieurs routes (`profile.ts`,
importé par `ProfileView.tsx`, `ActionsBar.tsx`, `PackView.tsx` ; `letter/adapt.ts`,
importé par `PackView.tsx`, `TailorModal.tsx` ; `storage/newResume.ts`, importé
par `TopBar.tsx`) continuent d'importer `DEFAULT_RESUME`/`DEFAULT_LETTER` **par
valeur** depuis `schema.ts` — même via un ré-export. Turbopack semble décider de
regrouper zod dans un chunk partagé dès qu'un nombre suffisant de routes
distinctes le rendent nécessaire quelque part dans leur arbre, puis référencer ce
chunk partagé depuis **toutes** les routes, pas seulement celles qui le
requièrent — un comportement déjà pressenti (sans être expliqué) par la spec
`2026-08-01-jobs-allegement-bundle-design.md` §2.5 à propos des chunks framework.

### 2.4 Correctif complet testé et VALIDÉ : migrer tous les consommateurs

Deuxième expérience : les **14 fichiers** qui importent `DEFAULT_RESUME` et/ou
`DEFAULT_LETTER` (listés en §4) sont tous repointés vers le nouveau
`defaults.ts`, et le ré-export dans `schema.ts` est supprimé — plus aucun fichier
de production ou de test n'importe ces deux constantes depuis `schema.ts`.

Après `rm -rf .next && npm run build`, serveur redémarré, mesure identique à
§2.1 :

| Route | Avant (o) | Après (o) | Δ | zod présent |
|---|---|---|---|---|
| `/` (éditeur) | 1 336 939 | 1 336 837 | -102 (bruit) | **oui** (légitime, §2.5) |
| `/login` | 1 041 693 | 755 611 | **-286 082** | non |
| `/help` | 1 053 919 | 767 837 | **-286 082** | non |
| `/pack` | 1 055 011 | 768 929 | **-286 082** | non |
| `/jobs` | 1 088 472 | 802 423 | **-286 049** | non |
| `/history` | 1 040 110 | 754 028 | **-286 082** | non |
| `/profil` | 1 043 719 | 757 637 | **-286 082** | non |
| `/settings` | 1 066 563 | 780 481 | **-286 082** | non |
| `/candidatures` | 1 066 749 | 780 667 | **-286 082** | non |

`npx tsc --noEmit`, `npm run lint` et `npx vitest run` (584 tests, 74 fichiers)
passaient tous au vert sur ce correctif complet, avant qu'il ne soit annulé
(`git checkout`) pour respecter la borne de l'Architecte.

### 2.5 `/` garde zod — légitimement

`/` (`src/app/page.tsx`) est l'éditeur CV/Lettre réel (`TopBar`, `MetaBar`,
`ActionsBar`, `EditorPane`, `PreviewPane`, `DraftManager`, `EditorDrawer`).
`.next/server/app/page_client-reference-manifest.js` (après le correctif complet)
montre que `EditorPane.tsx`, `PreviewPane.tsx`, `TopBar.tsx`, `MetaBar.tsx`,
`ActionsBar.tsx`, `DraftManager.tsx`, `EditorDrawer.tsx` référencent tous le chunk
zod dans leur liste de chunks (`entryJSFiles["[project]/src/app/page"]`) —
parce qu'ils utilisent, en aval, `normalize.ts` (`resumeSchema.parse`,
`letterSchema.parse`, réellement appelés) via `ImportTextModal.tsx`,
`TailorModal.tsx`, `ImportPdfModal.tsx` et `EditorPane.tsx` elles-mêmes. C'est un
besoin réel : ces modales parsent du JSON renvoyé par l'IA côté client, en direct,
sans aller-retour serveur. Aucune régression à corriger ici — seul le fait que
**les autres routes** en payaient le prix est le bug.

### 2.6 `/pack` et `/profil` n'ont, eux, plus aucun besoin réel de zod

Contrairement à l'hypothèse de départ (ces deux routes touchent aussi au domaine
CV/Lettre), la mesure du correctif complet (§2.4) montre qu'elles perdent zod
tout autant que `/login`. Vérifié : `PackView.tsx` et `ProfileView.tsx`
n'importent que des **types** (`type Resume`) ou `DEFAULT_RESUME`/`DEFAULT_LETTER`
(désormais zod-libres) depuis le domaine CV — jamais `resumeSchema`/`letterSchema`
eux-mêmes. Leur besoin réel se limitait toujours à des littéraux par défaut, pas
à de la validation.

## 3. Décisions de conception

1. **Extraire `DEFAULT_RESUME` et `DEFAULT_LETTER` dans un nouveau fichier
   `web/src/lib/resume/defaults.ts`**, qui n'importe de `schema.ts` que les types
   `Resume`/`Letter` (`import type`, entièrement effacé à la compilation — aucune
   dépendance runtime vers zod). Les deux constantes restent des littéraux
   strictement identiques à aujourd'hui, aucune valeur ne change.

   **Écarté explicitement : ne migrer que `docStore.ts` (le nœud dans la chaîne
   RootLayout → toutes les routes) et garder un ré-export dans `schema.ts` pour
   les 13 autres fichiers.** Testé et réfuté en §2.3 : le chunk zod restait
   identique sur toutes les routes après cette version partielle. Le mécanisme de
   regroupement de chunks de Turbopack semble se déclencher dès qu'**un seul**
   fichier réellement multi-routes touche encore `schema.ts` par valeur — corriger
   `docStore.ts` seul ne suffit pas.

2. **Migrer les 14 fichiers (production et tests) qui importent `DEFAULT_RESUME`/
   `DEFAULT_LETTER` pour qu'ils les prennent tous sur `defaults.ts`**, et
   supprimer toute trace de ces deux constantes dans `schema.ts` (pas de
   ré-export shim). Validé par mesure réelle en §2.4 : c'est cette migration
   complète, et seulement elle, qui fait disparaître le chunk zod des 8 routes qui
   n'en ont pas besoin.

   **Écarté explicitement : dupliquer `DEFAULT_RESUME`/`DEFAULT_LETTER` par
   fichier consommateur plutôt que les centraliser dans `defaults.ts`.** Rejeté :
   recréerait le risque de divergence silencieuse qu'une spec précédente
   (`2026-08-01-jobs-allegement-bundle-design.md` §3, décision 2) a déjà écarté
   pour une raison identique.

   **Écarté explicitement : réécrire les schémas zod eux-mêmes pour éliminer la
   dépendance à la bibliothèque (validation « maison »).** Hors de proportion
   avec le problème réel : le problème n'est pas que zod soit lourd pour ce qu'il
   valide, c'est que sa présence est mal placée dans le graphe de modules. Aucune
   réécriture de logique n'est nécessaire, seulement un déplacement de fichier.

3. **Ne pas toucher au chargement de zod sur `/` (l'éditeur).** Légitime et
   mesuré comme tel (§2.5) : `resumeSchema.parse`/`letterSchema.parse` y sont
   réellement appelés, côté client, par les modales d'import/adaptation.

   **Écarté explicitement : charger `normalize.ts` par `import()` dynamique dans
   `ImportTextModal.tsx`/`TailorModal.tsx`/`ImportPdfModal.tsx`/`EditorPane.tsx`
   pour alléger `/` lui-même.** Chantier réel et potentiellement utile, mais
   distinct : il concerne le poids propre de l'éditeur (`/`, déjà à 1,34 Mo, avec
   ou sans ce chantier), pas le fait que les 8 *autres* routes payaient un coût
   qui ne les concernait pas — qui est le problème adressé ici. Laissé en note
   dans `BACKLOG.md` § Idées pour une spec séparée si le poids de `/`
   lui-même dépasse un jour un seuil.

## 4. Architecture

### Fichier créé

`web/src/lib/resume/defaults.ts` — contenu identique aux blocs `DEFAULT_RESUME`/
`DEFAULT_LETTER` actuels de `schema.ts` (lignes 162-239), avec en tête :

```ts
import type { Resume, Letter } from "./schema";
```

Le commentaire existant sur `signoff` (« Politesse courte : la formule
cérémonieuse d'origine… ») est déplacé avec le bloc, mot pour mot — c'est de la
documentation de contenu, pas du code, rien n'y change.

### Fichiers modifiés (import de `DEFAULT_RESUME`/`DEFAULT_LETTER` repointé vers `defaults.ts`)

| Fichier | Change aussi |
|---|---|
| `web/src/lib/resume/schema.ts` | Suppression des deux blocs `DEFAULT_RESUME`/`DEFAULT_LETTER` (aucun autre export ne change) |
| `web/src/state/docStore.ts` | — |
| `web/src/state/docStore.test.ts` | — |
| `web/src/lib/resume/normalize.ts` | Garde `resumeSchema`, `letterSchema`, `RESUME_TOP_KEYS` depuis `schema.ts` |
| `web/src/lib/resume/normalize.test.ts` | — |
| `web/src/lib/pdfgen/ResumeDocument.test.tsx` | Garde `resumeSchema` depuis `schema.ts` |
| `web/src/lib/pdfgen/LetterDocument.test.tsx` | Garde `letterSchema` depuis `schema.ts` |
| `web/src/lib/storage/newResume.ts` | — |
| `web/src/lib/storage/useAutoDraft.test.ts` | — |
| `web/src/lib/profile/profile.ts` | Garde `type Resume` (déjà `import type`-able) depuis `schema.ts` |
| `web/src/lib/profile/profile.test.ts` | Garde `type Resume` depuis `schema.ts` |
| `web/src/lib/letter/adapt.ts` | Garde `type Letter`, `type Resume` depuis `schema.ts` |
| `web/src/lib/letter/adapt.test.ts` | Garde `type Letter`, `type Resume` depuis `schema.ts` |
| `web/src/lib/templates/defaults.test.ts` | — (ne pas confondre avec l'import local `./defaults`, fichier différent) |

Aucun fichier supprimé, aucune dépendance npm ajoutée ou retirée, aucune
signature de fonction changée, aucune assertion de test modifiée — uniquement
des chemins d'import.

## 5. Flux après le changement

```
RootLayout (toutes les routes)
  → UiHost → useGlobalUndoRedo → docStore.ts
      import { DEFAULT_RESUME, DEFAULT_LETTER } from "@/lib/resume/defaults";
      import type { Resume, Letter, DocType } from "@/lib/resume/schema";
        (import type = effacé à la compilation, zod jamais chargé)

/ (éditeur) uniquement
  → EditorPane/PreviewPane/TopBar/… → ImportTextModal/TailorModal/ImportPdfModal
      → normalize.ts → resumeSchema.parse / letterSchema.parse (zod, réel, légitime)

/login, /help, /pack, /jobs, /history, /profil, /settings, /candidatures
  → plus aucune chaîne d'import ne touche schema.ts par valeur
  → zod absent de leur bundle initial
```

## 6. Tests

Aucune assertion ne change : seuls des chemins d'import bougent. Après chaque
tâche du plan, la vérification standard suffit :

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Vérification finale spécifique à ce chantier (poids par route + présence du
chunk zod) :

```bash
cd web
rm -rf .next && npm run build
npm run start &
sleep 5

# 1. Identifier le chunk zod du build courant (son hash change à chaque build).
ZOD_CHUNK=$(grep -l "zod" .next/static/chunks/*.js 2>/dev/null | xargs -n1 basename)
echo "Chunk zod de ce build : $ZOD_CHUNK"

# 2. Pour chaque route, poids total + présence du chunk zod ci-dessus.
for route in "" login help pack jobs history profil settings candidatures; do
  curl -s "http://localhost:3000/$route" -o "/tmp/page_${route:-root}.html"
  total=0
  for chunk in $(grep -oE '"/_next/static/chunks/[^"]+\.js"' "/tmp/page_${route:-root}.html" | tr -d '"' | sed 's#.*/##' | sort -u); do
    sz=$(stat -c%s ".next/static/chunks/$chunk" 2>/dev/null || echo 0)
    total=$((total+sz))
  done
  has_zod=$(grep -c "$ZOD_CHUNK" "/tmp/page_${route:-root}.html")
  echo "${route:-/} : ${total} o, zod présent: ${has_zod}"
done

kill %1
```

## 7. Critères de succès vérifiables

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (584 tests) passent, sans
   régression sur le nombre de tests verts.
2. Sur un build de production propre, le chunk contenant zod (identifiable par
   `grep -c zod` sur les fichiers de `.next/static/chunks/`, seuil : plus de 500
   occurrences, comme aujourd'hui) **n'est plus référencé** dans le HTML servi par
   `/login`, `/help`, `/pack`, `/jobs`, `/history`, `/profil`, `/settings`,
   `/candidatures`.
3. Le chunk zod **reste** référencé par `/` (l'éditeur) — sa disparition sur
   cette route serait le signe d'une régression fonctionnelle (import/tailor
   cassés), pas un succès.
4. Poids total JS de `/login` (ou toute route de la liste du critère 2)
   inférieur d'au moins 250 000 o par rapport à la mesure d'avant ce chantier
   (§2.1 de cette spec, colonne « Avant »).
5. Aucune régression manuelle sur les parcours qui touchent réellement
   `DEFAULT_RESUME`/`DEFAULT_LETTER` : nouveau CV vierge (`newResume.ts`),
   nouvelle lettre depuis un modèle (`templates/build.ts`), undo/redo global
   (`docStore.ts`), adaptation de lettre (`letter/adapt.ts`) — testable en
   ouvrant `/` dans un navigateur et en exerçant ces actions, en plus des tests
   automatisés du critère 1.

## 8. Limites connues

- **`/` reste à ~1,34 Mo**, zod compris — inchangé par ce chantier, qui ne
  visait que les 8 autres routes. Alléger `/` lui-même (ex. lazy-load des
  modales d'import) est un chantier distinct, noté en `BACKLOG.md` § Idées
  (§3, décision 3 de cette spec).
- **Le mécanisme exact du regroupement de chunks de Turbopack (§2.3) n'est pas
  documenté officiellement** — cette spec décrit un comportement observé et
  reproduit deux fois (correctif partiel réfuté, correctif complet validé), pas
  une règle publiée par Next.js/Turbopack. Si une future version de Next.js
  change ce comportement, la mesure du critère 2 (§7) reste la source de vérité,
  pas le raisonnement de ce paragraphe.
- **Gain non re-mesuré en temps réel (Slow 4G + CPU x4)** : comme pour la spec
  précédente, seul le poids est mesuré ici. À re-chronométrer si le seuil de 2 s
  de `MISSION.md` reste en question après ce chantier (voir aussi la ligne
  distincte de `BACKLOG.md` sur le chronométrage `/jobs` non refait).

## 9. Hors périmètre

- Alléger `/` (l'éditeur) lui-même — §8, ligne distincte à ouvrir si besoin.
- Le chantier `/pack` performance (marge de 120 ms, temps d'interactivité réel
  non mesuré) — ligne distincte de `BACKLOG.md`.
- Le chronométrage Slow 4G + CPU x4 de `/jobs` non refait — ligne distincte de
  `BACKLOG.md`.
- La robustesse du scan face à une offre malformée — ligne distincte de
  `BACKLOG.md`, sans lien avec ce chantier.

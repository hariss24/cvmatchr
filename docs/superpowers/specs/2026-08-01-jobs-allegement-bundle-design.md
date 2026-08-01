# Alléger le poids JS initial de `/jobs`

> Spec de conception — 01/08/2026
> Traite la ligne de `BACKLOG.md` § À planifier : « Performance `/jobs` : ~3,9 s
> pour charger la seule coquille de page sous throttling Slow 4G, contre un
> seuil de 2 s ». Constat source : `boucle/constats/2026-07-31-performance.md`.

## 1. Problème

`boucle/constats/2026-07-31-performance.md` mesurait, le 31/07/2026, un poids
JS+CSS décompressé de **1024 Ko sur 12 fichiers** pour `/jobs`, et un temps de
chargement de la coquille de page de **~3,9 s sous Slow 4G** — contre un seuil
MISSION.md de 2 s pour le premier résultat visible. Le CPU n'était pas en
cause (x4 ne coûtait que ~130 ms de plus que la référence) : le poids réseau
l'était.

## 2. Constats vérifiés le 01/08/2026

Rien de ce qui suit n'est supposé : chaque chiffre vient d'un build de
production propre exécuté aujourd'hui (`npm run build && npm run start`,
`GET /jobs` → `200` vérifié avant mesure) puis d'une inspection directe des
fichiers produits dans `.next/static/chunks/`.

### 2.1 Le poids réel aujourd'hui est 2,4 fois plus élevé que ce que l'audit du 31/07 avait mesuré

Les scripts référencés par le HTML de `/jobs` aujourd'hui :

| Fichier | Poids décompressé |
|---|---|
| `0ls2l51sgdo-4.js` | **1 497 490 o (1,43 Mo)** |
| `2w9bjs17pyc72.js` | 288 085 o |
| `373yfygk3klou.js` | 138 009 o |
| `3j9pm5otqxm82.js` | 226 355 o |
| `0cz1d0mv5g_q7.js` | 112 594 o |
| `15uu-4m773xbb.js` | 104 116 o |
| `14mrh2-p_w84d.js` | 54 646 o |
| `27jktro2p5rq9.js` | 44 414 o |
| `3shsgfootcq6x.js` | 23 719 o |
| `1rdwzq95w5po9.js` | 30 836 o |
| `0d0xsf77msz55.js` | 11 193 o |
| `turbopack-0wr3x24b_na96.js` | 10 613 o |
| `36ssnkm0cjgq6.js` | 6 546 o |
| **Total (13 fichiers)** | **2 488 883 o (≈ 2,43 Mo)** |

Contre 1024 Ko / 12 fichiers relevés le 31/07. **Non tranchable** : impossible
de dire depuis cette session pourquoi l'audit précédent n'a pas vu le fichier
le plus lourd (`0ls2l51sgdo-4.js`, absent de sa liste de 12) — peut-être un
chunk que son point de mesure (`waitUntil: "load"`) n'a pas capturé à temps,
peut-être un état de build différent. Le code sur `main` aujourd'hui n'a de
toute façon pas changé depuis l'audit sur ce point (vérifié : le commit qui
introduit la donnée en cause, `1193ea0` du 28/07, est bien un ancêtre du
commit de l'audit, `a84a9ee` du 31/07 — donc le code était déjà là). Ce
désaccord n'est pas résolu ici ; ce qui compte pour trancher cette spec est la
mesure d'aujourd'hui, reproductible avec les commandes ci-dessus sur le code
actuel de `main`.

### 2.2 Cause n°1 (60 % du poids) : le référentiel ROME entier est importé statiquement dans le bundle client de `/jobs`

`0ls2l51sgdo-4.js` (1,43 Mo, **le plus gros fichier chargé par n'importe quelle
route du site**) est le contenu de
`web/src/lib/jobs/data/rome-competences.json` (1 459 020 o sur disque),
confirmé par grep du chunk :

```
grep -o "coeur_metier\|M1855\|rome-competences" .next/static/chunks/0ls2l51sgdo-4.js
→ M1855 (×3)
head -c 300 .next/static/chunks/0ls2l51sgdo-4.js
→ (globalThis.TURBOPACK...).push([...,(e,i,r)=>{i.exports=JSON.parse('{"A1101":{"i":"Conducteur...
```

Chaîne d'import qui l'amène dans le bundle client :

```
web/src/components/jobs/JobsView.tsx   ("use client", ligne 13)
  import { rankOffer, buildRankContext, shouldPersist } from "@/lib/jobs/rank";
    → web/src/lib/jobs/rank/index.ts (ligne 13)
      import { buildRomeTargets } from "../rome";
        → web/src/lib/jobs/rome.ts (ligne 15)
          import data from "./data/rome-competences.json";   ← import STATIQUE
```

`JobsView` est rendu directement par `app/jobs/page.tsx` (pas de `next/dynamic`
sur ce composant) : tout ce qu'il importe statiquement est chargé **au premier
atterrissage**, avant toute interaction. Or `rankOffer`/`buildRankContext` ne
sont appelés que dans `scanGroupe`/`scan` (`JobsView.tsx` lignes 213 et 266),
c'est-à-dire **seulement après un clic sur « Rechercher »**. Un visiteur qui
ouvre `/jobs` sans jamais lancer de recherche télécharge quand même 1,43 Mo de
données qu'il n'utilisera peut-être jamais.

### 2.3 Cause n°2 (12 % du poids) : zod entier chargé côté client pour compléter un objet avec des valeurs par défaut

`2w9bjs17pyc72.js` (288 Ko) contient 1112 occurrences (grep insensible à la
casse) du mot « zod » — c'est le module `web/src/lib/jobs/profileSchema.ts`
(`import { z } from "zod"`, ligne 1), qui définit `jobSearchProfileSchema` et
`parseProfile`.

Deux usages de `parseProfile` existent :

- **Serveur, légitime** : `web/src/lib/jobs/resolveProfile.ts` → appelé depuis
  `web/src/app/api/jobs/search/route.ts` pour valider le corps de
  `POST /api/jobs/search`. Ne pèse rien côté client, c'est du code serveur.
- **Client** : `web/src/components/jobs/JobsView.tsx` ligne 11
  (`import { parseProfile } from "@/lib/jobs/profileSchema"`), utilisé une
  seule fois, au montage (lignes 59-66), pour compléter un profil lu depuis
  IndexedDB qui daterait d'avant l'ajout d'un champ — un simple mécanisme de
  valeurs par défaut, pas une validation de frontière.

C'est ce second usage qui embarque zod (et son schéma complet, seuils de
lettres compris) dans le bundle client pour une tâche que quelques appels à
`.catch(défaut)` en JS suffiraient à couvrir — sauf que la fonction existe déjà
côté serveur et qu'on ne veut pas la dupliquer (§3, décision 2).

### 2.4 Pattern de chargement paresseux déjà présent dans le code — à réutiliser, pas à inventer

Aucun `next/dynamic` dans `web/src`, mais deux usages d'`import()` dynamique
existent déjà pour exactement ce problème (bibliothèque lourde chargée
seulement au moment de l'usage réel) :

- `web/src/lib/pdfgen/generatePdf.tsx` (lignes 16-17) :
  `Promise.all([import("@react-pdf/renderer"), import("./ResumeDocument")])`,
  appelé seulement au moment de générer un PDF.
- `web/src/components/editor/PdfPreview.tsx` (ligne 59) :
  `await import("pdfjs-dist")`, chargé seulement à l'ouverture de l'aperçu.

C'est ce pattern — pas une nouvelle dépendance, pas une route API — qui est
repris ici (§3).

### 2.5 Non actionnable ici : les chunks partagés

`373yfygk3klou.js` (138 Ko) et `3j9pm5otqxm82.js` (226 Ko) font partie des
`rootMainFiles` du build (fichiers chargés sur **toutes** les routes, pas
spécifiques à `/jobs` — framework Next/React). Déjà noté par l'audit du 31/07
comme chunk partagé ; aucune mesure ne permet de les rattacher à `/jobs`
plutôt qu'à l'app entière. Hors périmètre de cette spec (§10).

### 2.6 Non exécutable dans cette session : re-mesure du temps sous throttling

L'environnement de rédaction de cette spec n'a pas Chromium installé
(`npx playwright install` échoue faute d'accès réseau sortant complet dans
cette session). Le lien poids → temps n'est donc pas re-chronométré ici ; il
l'a été par l'audit du 31/07 (1024 Ko → 3,9 s, quasi entièrement réseau). Le
critère de succès §7 fixe une cible de poids, la re-mesure du temps sous Slow
4G est à faire après implémentation avec la méthodologie de cet audit.

## 3. Décisions de conception

1. **Charger `rome-competences.json` par `import()` dynamique, mis en cache en
   mémoire, déclenché uniquement au premier scan** — pas au chargement de la
   page. `buildRomeTargets` et `buildRankContext` deviennent asynchrones ;
   `rankOffer`, `metierPoints`, `romeLabel` et tous les autres consommateurs de
   `RankContext` **restent synchrones**, car ils ne lisent le contexte
   qu'après sa résolution (jamais avant, dans tout le code de production).

   **Écarté explicitement : servir ce JSON via une route API dédiée
   (`GET /api/jobs/rome-data`).** Rejeté parce que cela réintroduirait un appel
   réseau dans le chemin de classement, alors que la spec `2026-07-28-notation-
   lettres-design.md` (décision §3.6) pose explicitement « aucun appel réseau
   entre la recherche et l'affichage » comme condition du classement gratuit et
   instantané. Un `import()` dynamique reste un chargement de **module local**,
   servi comme n'importe quel autre chunk JS du même build — différé, mis en
   cache par le navigateur comme tout asset statique, mais jamais un aller-
   retour serveur applicatif.

2. **Charger `profileSchema.ts` (donc zod) par `import()` dynamique au point
   d'usage dans `JobsView.tsx`**, au lieu d'un import statique en tête de
   fichier.

   **Écarté explicitement : réécrire `parseProfile` sans zod pour l'usage
   client.** Techniquement plus léger (zéro octet de zod téléchargé, même
   différé), mais rejeté : cela dupliquerait la logique de complétion des
   valeurs par défaut entre le client et `resolveProfile.ts` (qui garde son
   usage légitime de zod côté serveur, §2.3), avec un risque de divergence
   silencieuse entre les deux copies dans le temps — un coût que rien dans
   `MISSION.md` ne demande de prendre ici. L'`import()` dynamique atteint la
   même cible mesurable (retirer zod du poids « au premier atterrissage »,
   exactement la définition du problème dans le constat du 31/07) sans toucher
   à la logique existante ni la dupliquer.

3. **Ne pas toucher aux chunks partagés (§2.5).** Aucune mesure ne les
   rattache à `/jobs` spécifiquement ; les optimiser relève d'un audit
   transverse, hors périmètre d'une ligne de backlog qui porte sur `/jobs`.

## 4. Architecture

### Modules modifiés

| Fichier | Changement |
|---|---|
| `web/src/lib/jobs/rome.ts` | `buildRomeTargets` devient `async`, charge la table via `import()` dynamique mis en cache module ; `romeLabel` reste synchrone, lit le cache déjà résolu |
| `web/src/lib/jobs/rank/index.ts` | `buildRankContext` devient `async` (`await buildRomeTargets(...)`) |
| `web/src/components/jobs/JobsView.tsx` | `await buildRankContext(...)` (ligne 266) ; type de `ctx` dans `scanGroupe` (ligne 173) ; import statique de `parseProfile` remplacé par un `import()` dynamique au point d'usage (lignes 11, 59-66) |

### Tests à adapter (signature devenue asynchrone, aucune assertion ne change)

- `web/src/lib/jobs/rome.test.ts`
- `web/src/lib/jobs/rank/index.test.ts`
- `web/src/lib/jobs/rank/criteria.test.ts`
- `web/src/components/jobs/JobsView.scan.test.ts`

Aucun fichier créé, aucun supprimé, aucune dépendance npm ajoutée.

## 5. Flux après le changement

```
Atterrissage sur /jobs
  → bundle client : JobsView + FilterBar/JobCard/ScoringInfo/etc.
    (SANS rome-competences.json, SANS zod)

Clic sur « Rechercher »
  → import() dynamique de profileSchema (si un profil existant est complété)
  → POST /api/jobs/search
  → import() dynamique de rome-competences.json (une fois, mis en cache)
  → classement local (inchangé, toujours 100 % local, zéro appel réseau
    supplémentaire pendant le classement lui-même)
```

## 6. Tests

- Adapter les 4 fichiers de test listés en §4 : chaque appel à
  `buildRomeTargets(...)` ou `buildRankContext(...)` doit être `await`é, et
  chaque `it`/`describe` englobant doit devenir `async`. Exemple de
  transformation, `web/src/lib/jobs/rome.test.ts` :

  ```ts
  // avant
  it("classe les cibles et leurs voisins officiels", () => {
    const t = buildRomeTargets(["M1855"]);
    ...
  });

  // après
  it("classe les cibles et leurs voisins officiels", async () => {
    const t = await buildRomeTargets(["M1855"]);
    ...
  });
  ```

  Dans `web/src/lib/jobs/rank/criteria.test.ts`, le helper local `ctx()`
  (ligne 16-19) devient asynchrone et chaque site d'appel doit être `await`é :

  ```ts
  // avant
  const ctx = (romeCodes = [], home = null) => ({
    rome: buildRomeTargets(romeCodes),
    home,
  });
  ...
  const l = metierPoints(offre({ romeCode: "M1855" }), EMPTY_PROFILE, ctx(["M1855"]));

  // après
  const ctx = async (romeCodes = [], home = null) => ({
    rome: await buildRomeTargets(romeCodes),
    home,
  });
  ...
  const l = metierPoints(offre({ romeCode: "M1855" }), EMPTY_PROFILE, await ctx(["M1855"]));
  ```

  Dans `web/src/components/jobs/JobsView.scan.test.ts`, `ctx` est calculé une
  fois par `describe` (ligne 28) et réutilisé par plusieurs `it` : passer par
  `beforeAll` plutôt que par un appel direct, pour ne le résoudre qu'une fois :

  ```ts
  describe("logique de scan", () => {
    let ctx: Awaited<ReturnType<typeof buildRankContext>>;
    beforeAll(async () => {
      ctx = await buildRankContext(profil, { lat: 48.85, lng: 2.35 });
    });
    ...
  });
  ```

- Nouveau test dans `rome.test.ts` : le module ne charge le JSON qu'une seule
  fois même sur plusieurs appels concurrents à `buildRomeTargets` (vérifie que
  le cache de la promesse évite un double téléchargement/parse) :

  ```ts
  it("ne charge la table qu'une seule fois même avec des appels concurrents", async () => {
    const [a, b] = await Promise.all([buildRomeTargets(["M1855"]), buildRomeTargets(["M1834"])]);
    expect(a.cibles.has("M1855")).toBe(true);
    expect(b.cibles.has("M1834")).toBe(true);
  });
  ```

- Non-régression manuelle (§7) : build de production + inspection des chunks
  chargés par `/jobs`, avec et sans clic sur « Rechercher », par la même
  méthode que §2 de cette spec (`grep`/`stat` sur `.next/static/chunks/`,
  scripts référencés dans le HTML servi).

## 7. Critères de succès vérifiables

1. `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` passent.
2. Sur un build de production propre, les scripts référencés par le HTML de
   `/jobs` **avant tout clic** ne contiennent plus le texte `coeur_metier` ni
   plus de 5 occurrences du mot `zod` dans aucun fichier — vérifiable par les
   mêmes commandes `grep`/`stat` que §2.2 et §2.3 de cette spec.
3. Poids total JS+CSS décompressé chargé par `/jobs` au premier atterrissage
   **< 700 Ko** (contre 2 489 Ko mesurés le 01/08/2026 avant ce chantier) —
   cible volontairement au-dessus de `/pack` (198 Ko) car `/jobs` a plus de
   composants de formulaire (`FilterBar`, `MetierInput`, `LocationInput`,
   `SourcePicker`, `MoreFilters`), pas au niveau de rigueur pour trancher un
   chiffre plus bas sans nouvelle mesure.
4. Après un clic sur « Rechercher », un seul téléchargement du chunk contenant
   `rome-competences.json` a lieu, même sur des scans successifs dans la même
   session (vérifiable dans l'onglet réseau : un seul `200`, les suivants
   absents ou `304`/servis du cache mémoire du module).
5. Aucune régression sur le classement : `npx vitest run src/lib/jobs/rank
   src/lib/jobs/rome.test.ts src/components/jobs/JobsView.scan.test.ts`
   affiche le même nombre de tests verts qu'avant ce chantier (mêmes
   assertions, seule la signature a changé).
6. Chronométrage Slow 4G + CPU x4 (méthodologie de
   `boucle/constats/2026-07-31-performance.md`) repassé sous 2 s pour le
   premier atterrissage de `/jobs` — à re-mesurer après implémentation, dans un
   environnement où Chromium est disponible (pas garanti dans toute session de
   boucle, voir §2.6).

## 8. Limites connues

- **Le premier scan paiera un téléchargement différé d'environ 1,4 Mo**
  (moins côté réseau une fois compressé, mais un téléchargement one-shot tout
  de même). Accepté : le seuil MISSION.md porte sur le « premier résultat
  visible », pas sur la durée du scan lui-même — déjà mesuré comme rapide une
  fois la page chargée (174-241 ms, audit du 31/07, §« /jobs »).
- **Le désaccord entre le poids mesuré le 31/07 (1024 Ko) et celui mesuré ici
  le 01/08 (2489 Ko) n'est pas expliqué** (§2.1). Traité comme non bloquant :
  la mesure de cette spec est reproductible sur le code actuel et fait
  autorité pour ce chantier.
- **Les chunks framework partagés (~356 Ko combinés) restent inchangés** —
  hors périmètre, §3 décision 3.

## 9. Hors périmètre

- Optimisation des chunks framework partagés (§2.5).
- Le chantier `/pack` (marge de 120 ms, temps d'interactivité réel non mesuré)
  — ligne distincte de `BACKLOG.md`, à traiter séparément.
- La robustesse du scan face à une offre malformée — ligne distincte de
  `BACKLOG.md`, sans lien avec le poids du bundle.
- Ajout d'un outil d'analyse de bundle (`@next/bundle-analyzer`) — non
  nécessaire ici (la cause a été identifiée sans lui, par inspection directe
  des chunks) ; noterait une dépendance npm nouvelle, `[feu vert requis]` si
  jamais proposé plus tard.

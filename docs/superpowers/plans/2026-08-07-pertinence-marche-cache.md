# Pertinence de la recherche « Marché caché » — plan d'exécution

> **Destinataire** : agent d'implémentation autonome (Gemini / DeepSeek).
> Tu travailles seul, sans pouvoir poser de question. Tout ce dont tu as besoin
> est dans ce document. Les chiffres cités sont **mesurés**, pas estimés : la
> date de mesure est indiquée à chaque fois. Ne les remplace jamais par des
> estimations.

**Objectif** : qu'une recherche d'emploi sur la source « Marché caché » rende
des offres qui correspondent au métier cherché et à la zone demandée. Aujourd'hui
elle rend ni l'un ni l'autre.

---

## 0. Contexte du projet

**CVMatchr** — application Next.js 16 / React 19 / TypeScript strict d'aide à la
recherche d'emploi. Tout le code applicatif vit dans `web/`. Les scripts de
moisson de données vivent dans `scripts/` (Node pur, `.mjs`).

Quatre sources d'offres. Trois interrogent une API externe (France Travail,
Adzuna, JSearch). La quatrième, **« Marché caché »**, est différente et c'est
elle qui nous occupe : elle ne fait **aucune requête de recherche**. Un scan
quotidien (GitHub Actions, 06:00 UTC) moissonne les pages carrières de ~860
entreprises via leurs ATS (Greenhouse, Lever, Ashby, SmartRecruiters, Workday)
et écrit un index local **committé dans le dépôt** :

| Fichier | Contenu | Taille |
|---|---|---|
| `web/src/lib/jobs/data/boards-offres.json` | 19 555 offres (titre, lieu, url, dates, lat/lng) | ~8 Mo |
| `web/src/lib/jobs/data/boards-geo.json` | cache de géocodage : libellé → commune/lat/lng | ~355 Ko |
| `web/src/lib/jobs/data/boards-fr.json` | liste des boards moissonnés | — |

La recherche consiste donc à **filtrer ce fichier local**, puis à aller chercher
le texte complet, en direct, uniquement pour les offres retenues.

### Chaîne de traitement actuelle

```
web/src/lib/jobs/boardsFr.ts  ::  searchBoards(profile)
  1. elargirMotsCles(profile.keywords)         → synonymes.ts
  2. filtre titre        (sous-chaîne, OU sur tous les mots-clés)
  3. filtre mots exclus  (exclude.ts)
  4. filtre âge          (maxAgeDays)
  5. filtre lieu         (boardsLieu.ts :: dansLeSecteur)
  6. tri                 (date décroissante)          ← PROBLÈME B
  7. dédoublonnage       (normKey)
  8. plafond 60          (repartirParEntreprise, round-robin par employeur)
  9. récupération du texte en direct (boardsText.ts)
        ↓ réponse HTTP
web/src/components/jobs/JobsView.tsx
 10. rankOffer()  → score /100 + lettre S/A/B/C/D
 11. shouldPersist() → TOUJOURS true                  ← PROBLÈME C
 12. saveJob()  → base Dexie locale, CUMULATIVE
```

**Point capital, souvent mal compris** : l'écran `/jobs` n'affiche **pas** le
résultat de la dernière recherche. Il affiche le **contenu cumulé de la base
Dexie locale**. Une recherche ajoute des offres, n'en retire jamais. Vérifié le
07/08/2026 : le serveur a répondu `{"offers":[]}` et l'écran affichait toujours
« 44 offres retenues », toutes datées du scan précédent.

### Contraintes non négociables

Elles viennent de `CLAUDE.md`, `web/AGENTS.md` et `web/CADRAGE_EXECUTION.md`.
Une violation invalide la tâche.

| # | Contrainte |
|---|---|
| 1 | **`git push` strictement interdit.** Le push déploie la production Vercel. Tu commits, l'humain pousse. |
| 2 | **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.** TypeScript est en mode strict. |
| 3 | **Aucune dépendance npm ajoutée ou mise à jour.** |
| 4 | **Ne jamais écrire de diacritique combinant littéral dans une regex.** Toujours `[̀-ͯ]` ou `\p{Diacritic}`. Ce piège s'est produit six fois dans ce dépôt. |
| 5 | **Jamais `alert` / `confirm` / `prompt` natifs.** Utiliser `uiAlert` / `uiConfirm` / `uiPrompt` / `toast` depuis `src/state/uiStore.ts`. |
| 6 | **Ne jamais modifier un test existant pour le faire passer.** Si un test casse, c'est le code qui est faux — sauf si CE plan dit explicitement de l'adapter (c'est le cas en T2 et T4, où c'est signalé). |
| 7 | Cette version de Next.js a des ruptures d'API. Lire `node_modules/next/dist/docs/` avant d'écrire du code Next. |
| 8 | Commentaires et messages de commit **en français**. |
| 9 | `append.js` à la racine reste non suivi : ne jamais l'ajouter à un commit. |

### Commandes de vérification

Depuis `web/` :

```bash
npm test          # Vitest — 679 tests, 83 fichiers, doivent tous passer
npm run build     # typecheck complet — Vitest NE typecheck PAS
npm run lint      # ESLint — 0 erreur (5 warnings préexistants tolérés)
```

Depuis la racine, pour les scripts `.mjs` :

```bash
node --test scripts/boards/
```

**Une tâche n'est terminée que si ces commandes ont réellement tourné et que
leur sortie a été lue.** Jamais de « ça devrait marcher ».

### Données de test

- CV de référence : `web/tests/fixtures/base_resume.json`
- Offre de référence : `web/tests/fixtures/job_sharkninja.txt`

---

## 1. Diagnostic

Recherche réelle d'un utilisateur, mesurée le 07/08/2026 :

```
keywords : ["Web marketer", "Webmaster", "Chargé marketing digital",
            "Chargé de communication digitale", "E-merchandiser"]
location : { kind: "region", code: "11", label: "Île-de-France", radiusKm: 10 }
sources  : { boards: true, francetravail: false, adzuna: false, jsearch: false }
maxAgeDays: 30
excludedWords: ["alternan","apprenti","stagiaire","professionnalisation","cfa"]
```

Résultat obtenu : **49 offres, dont 0 en rapport avec le marketing.** Extraits
réels : « Responsable RAMS H/F », « Bid manager H/F », « Release Manager H/F »,
« Head of HRBP », « Account Manager for Nuclear Generation », « Supply Chain
Project Manager ».

Quatre causes indépendantes ont été isolées.

### Problème A — table de synonymes trop large ✅ DÉJÀ CORRIGÉ le 07/08/2026

`web/src/lib/jobs/synonymes.ts` contenait des groupes bâtis sur un **niveau
hiérarchique** et non sur un métier :

```ts
["responsable", "manager", "head of"]
["directeur",   "director", "head of"]
["directrice",  "director", "head of"]
["marketing",   "marketing", "growth"]
```

Le filtre titre fait une recherche de **sous-chaîne**. Une fois `"manager"`
ajouté comme mot-clé, tout titre le contenant remontait. Mesure avant/après sur
l'index entier :

| Mot-clé | Avant | Après |
|---|---|---|
| responsable RH | 5 → **2 807** (14 % de l'index) | 5 → **90** |
| ingénieur | 1 770 → 3 031 | 1 770 → 3 031 *(inchangé)* |
| commercial | 561 → 1 188 | 561 → 1 188 *(inchangé)* |
| chef de projet | 387 → 534 | 387 → 534 *(inchangé)* |
| développeur | 293 → 727 | 293 → 727 *(inchangé)* |

Sur la recherche réelle : `calls.boards` est passé de **49 à 2**, bruit résiduel
(offres amenées par `manager`/`responsable`/`head of`/`growth`) = **0**.

**Ne pas refaire cette tâche. Ne pas restaurer ces groupes.** Elle est décrite
ici parce qu'elle explique l'état du fichier et parce que **T4 traite deux
groupes restants qui ont exactement le même défaut**.

### Problème B — le plafond de 60 est rempli par date, pas par pertinence

`web/src/lib/jobs/boardsFr.ts`, étapes 6 à 8. Les offres survivantes sont triées
**uniquement par date décroissante**, puis les 60 premières sont retenues.

Conséquence : une offre qui matche un mot-clé **réellement saisi** par le
candidat n'a aucune priorité sur une offre qui matche seulement un synonyme.
Sur la recherche mesurée, les 60 places partaient à des offres amenées par des
synonymes, et les rares offres pertinentes n'entraient jamais.

Le tri par date n'est pas gratuit et ne doit pas disparaître : il sert le but du
dispositif (une offre publiée aujourd'hui a moins de candidats). Il doit devenir
le **second** critère, pas le premier.

### Problème C — la notation fonctionne, mais rien n'en tient compte

Le système de notation (`web/src/lib/jobs/rank/`) marche correctement. Lecture
de la base Dexie de l'utilisateur, le 07/08/2026 :

```json
{"title": "Head of HRBP",                        "grade": "D", "score": 18}
{"title": "Senior Site Contracts Manager - FSP",  "grade": "D", "score": 18}
```

Il a **correctement** identifié ces offres comme hors-sujet : 18/100, lettre D.
Puis `shouldPersist()` les a enregistrées quand même, parce que c'est un bouchon :

```ts
// web/src/lib/jobs/rank/index.ts:126
export function shouldPersist(_result: RankResult, _profile: JobSearchProfile): boolean {
  return true;
}
```

Les 44 offres hors-sujet sont donc **stockées** dans la base locale. Elles
resteront affichées après toute correction en amont, puisque rien ne les
supprime. C'est ce qui donne l'impression que les corrections ne servent à rien.

### Problème D — le filtre région / département ignore les coordonnées

`web/src/lib/jobs/boardsLieu.ts:48-69` :

```ts
if (filtre.kind === "commune" && cible && aDesCoords) {
  return haversineKm(cible, {...}) <= Math.max(1, filtre.radiusKm);
}
if (!offre.lieu) return true;
if (!nom) return true;
return normalize(offre.lieu).includes(nom);   // ← région et département tombent ici
```

Pour une **commune**, la distance réelle est calculée. Pour un **département**
ou une **région**, on tombe sur une comparaison de texte : le libellé libre de
l'offre doit contenir la chaîne « ile de france ». Les coordonnées, présentes
sur **92 % de l'index** (18 019 offres sur 19 555), ne sont jamais consultées.

Mesures du 07/08/2026 sur `boards-offres.json` :

```
Libellés contenant explicitement « île-de-france » :    273
Libellés « Paris » sans mention de région           :  4 124
```

Sur la recherche réelle : **126 offres écartées par ce filtre, dont 91
manifestement franciliennes.** Exemples de libellés rejetés :

```
"Paris"                — VP Growth                        [Joko]
"Paris"                — Growth Manager                   [Voodoo]
"Paris office"         — Lifecycle Marketing Manager       [Nabla]
"FR - Paris"           — Account Executive Team Manager    [Airwallex]
"Paris - Main Office"  — Senior Integrated Marketing…      [Deliveroo]
"EMEA | Paris"         — Integrated Marketing Manager      [Plaud]
```

Le défaut est **symétrique**. Une offre passe le filtre par accident quand son
libellé énumère plusieurs sites :

```
"Service Marketing Manager EMEA" — Medtronic
lieu : "Dublin, County Dublin, Ireland / Watford, … / Paris, Île de France, France"
```

Poste basé à Dublin, retenu pour une recherche en Île-de-France.

---

## 2. Ordre d'exécution

Quatre tâches, à faire **dans cet ordre**. Chacune se termine par un commit.

| # | Tâche | Effet attendu |
|---|---|---|
| T1 | Filtre région/département par département réel | débloque ~91 offres franciliennes, écarte Dublin |
| T2 | Le plafond de 60 se remplit par pertinence puis par date | les offres pertinentes entrent enfin dans la sélection |
| T3 | Ne plus enregistrer les offres hors-sujet + purger l'existant | l'écran cesse d'afficher les 44 offres en D |
| T4 | Deux derniers groupes de synonymes trop larges | supprime le bruit sur « sécurité informatique » et « données » |

---

## T1 — Filtre région et département par département réel

**Fichiers**

| Fichier | Opération |
|---|---|
| `scripts/boards/geo.mjs` | Modifier — persister le département |
| `scripts/boards/geo.test.mjs` | Modifier — ajouter les cas |
| `scripts/build-boards-offres.mjs` | Modifier — propager `dept` sur chaque offre |
| `web/src/lib/jobs/departements.ts` | **Créer** — table département → région |
| `web/src/lib/jobs/departements.test.ts` | **Créer** |
| `web/src/lib/jobs/boardsFr.ts` | Modifier — champ `dept` sur `OffreLegere` |
| `web/src/lib/jobs/boardsLieu.ts` | Modifier — utiliser `dept` |
| `web/src/lib/jobs/boardsLieu.test.ts` | Modifier — ajouter les cas |

### Principe

L'API Base Adresse Nationale (`api-adresse.data.gouv.fr`, gratuite, déjà
utilisée par `geo.mjs`) renvoie pour chaque commune un champ `properties.context`
au format exact :

```
"93, Seine-Saint-Denis, Île-de-France"
```

Le premier segment est le **code département**. Il suffit de le persister au
moment du géocodage, de le propager sur chaque offre, puis de comparer des codes
au lieu de comparer du texte libre.

Ne pas dériver le département de `properties.postcode` : un code postal n'est pas
un code département (Monaco, communes à cheval, DOM à trois chiffres). Le
premier segment de `context` est la source correcte.

### Étapes

- [ ] **1. Persister le département dans le cache de géocodage**

Dans `scripts/boards/geo.mjs`, la fonction `coordonneesDe` rend actuellement
`{ ville, lat, lng, via }`. Ajouter `departement`.

```js
/**
 * Code département tel que la Base Adresse Nationale le donne, premier segment
 * de `context` (« 93, Seine-Saint-Denis, Île-de-France » → « 93 »).
 *
 * ⚠️ Ne pas le dériver du code postal : « 20 » n'existe pas (Corse = 2A/2B) et
 * les DOM tiennent sur trois chiffres. Le premier segment de `context` est le
 * seul champ qui porte réellement le code département.
 */
function departementDuTrait(trait) {
  const contexte = trait?.properties?.context ?? "";
  const premier = contexte.split(",")[0]?.trim() ?? "";
  return /^(\d{2,3}|2A|2B)$/.test(premier) ? premier : "";
}
```

Puis, à l'endroit où l'objet résultat est construit, ajouter le champ :

```js
return {
  ville: trait.properties.city ?? trait.properties.name,
  lat: /* inchangé */,
  lng: /* inchangé */,
  via: /* inchangé */,
  departement: departementDuTrait(trait),
};
```

- [ ] **2. Tests du script**

Ajouter dans `scripts/boards/geo.test.mjs` :

```js
test("le code département est extrait du contexte BAN", () => {
  assert.equal(departementDuTrait({ properties: { context: "93, Seine-Saint-Denis, Île-de-France" } }), "93");
  assert.equal(departementDuTrait({ properties: { context: "2A, Corse-du-Sud, Corse" } }), "2A");
  assert.equal(departementDuTrait({ properties: { context: "974, La Réunion, La Réunion" } }), "974");
});

test("un contexte absent ou illisible ne fabrique pas de département", () => {
  assert.equal(departementDuTrait({ properties: {} }), "");
  assert.equal(departementDuTrait({ properties: { context: "Île-de-France" } }), "");
});
```

Exporter `departementDuTrait` pour pouvoir le tester.

Vérifier : `node --test scripts/boards/geo.test.mjs` → tous verts.

- [ ] **3. Régénérer le cache de géocodage**

Les 2 918 entrées existantes de `boards-geo.json` n'ont pas le champ
`departement`. Il faut les recalculer. Le script réinterroge la BAN pour toute
entrée dépourvue du champ.

Dans `scripts/build-boards-offres.mjs`, à l'endroit où le cache est consulté,
traiter une entrée sans `departement` comme absente :

```js
// ⚠️ Une entrée du cache antérieure au 07/08/2026 n'a pas de département.
// La considérer comme absente force son recalcul, une seule fois.
const enCache = geo[libelle];
const utilisable = enCache === null || (enCache && typeof enCache.departement === "string");
if (utilisable) { /* réutiliser */ } else { /* re-géocoder */ }
```

Attention : `null` est une valeur légitime du cache — elle signifie « libellé
testé, non résoluble » (« France », « Anywhere in France »). Ne pas la recalculer.

Lancer le scan complet :

```bash
node scripts/build-boards-offres.mjs
```

C'est long (~2 918 libellés à géocoder, la BAN est limitée en débit). Vérifier
ensuite que le fichier est bien peuplé :

```bash
node -e "const g=require('./web/src/lib/jobs/data/boards-geo.json'); const v=Object.values(g).filter(Boolean); console.log('resolus', v.length, '| avec dept', v.filter(x=>x.departement).length)"
```

Attendu : « avec dept » proche de « resolus ». Un écart de quelques dizaines est
normal (communes dont la BAN ne renvoie pas de contexte).

- [ ] **4. Propager `dept` sur chaque offre**

Dans `scripts/build-boards-offres.mjs`, là où `lat`/`lng` sont posés sur l'offre,
poser aussi `dept` quand il est connu. Suivre exactement le style existant :
un champ absent plutôt qu'un champ vide.

```js
...(coord?.departement ? { dept: coord.departement } : {}),
```

- [ ] **5. Table département → région**

Créer `web/src/lib/jobs/departements.ts`. Codes INSEE officiels. La table est
figée : elle n'a pas changé depuis 2016.

```ts
/**
 * Rattachement de chaque département à sa région, par codes INSEE.
 *
 * ⚠️ Ce sont les codes, pas les libellés. `LocationFilter.code` porte « 11 »
 * pour l'Île-de-France, et l'index porte « 75 » sur l'offre : c'est cette table
 * qui fait le lien. Comparer des libellés à la place échouerait sur les accents
 * et les traits d'union (« Île-de-France » vs « Ile de France »).
 *
 * Découpage figé depuis la réforme de 2016.
 */
export const REGION_DE_DEPARTEMENT: Readonly<Record<string, string>> = {
  // 84 Auvergne-Rhône-Alpes
  "01": "84", "03": "84", "07": "84", "15": "84", "26": "84", "38": "84",
  "42": "84", "43": "84", "63": "84", "69": "84", "73": "84", "74": "84",
  // 27 Bourgogne-Franche-Comté
  "21": "27", "25": "27", "39": "27", "58": "27", "70": "27", "71": "27",
  "89": "27", "90": "27",
  // 53 Bretagne
  "22": "53", "29": "53", "35": "53", "56": "53",
  // 24 Centre-Val de Loire
  "18": "24", "28": "24", "36": "24", "37": "24", "41": "24", "45": "24",
  // 94 Corse
  "2A": "94", "2B": "94",
  // 44 Grand Est
  "08": "44", "10": "44", "51": "44", "52": "44", "54": "44", "55": "44",
  "57": "44", "67": "44", "68": "44", "88": "44",
  // 32 Hauts-de-France
  "02": "32", "59": "32", "60": "32", "62": "32", "80": "32",
  // 11 Île-de-France
  "75": "11", "77": "11", "78": "11", "91": "11", "92": "11", "93": "11",
  "94": "11", "95": "11",
  // 28 Normandie
  "14": "28", "27": "28", "50": "28", "61": "28", "76": "28",
  // 75 Nouvelle-Aquitaine
  "16": "75", "17": "75", "19": "75", "23": "75", "24": "75", "33": "75",
  "40": "75", "47": "75", "64": "75", "79": "75", "86": "75", "87": "75",
  // 76 Occitanie
  "09": "76", "11": "76", "12": "76", "30": "76", "31": "76", "32": "76",
  "34": "76", "46": "76", "48": "76", "65": "76", "66": "76", "81": "76",
  "82": "76",
  // 52 Pays de la Loire
  "44": "52", "49": "52", "53": "52", "72": "52", "85": "52",
  // 93 Provence-Alpes-Côte d'Azur
  "04": "93", "05": "93", "06": "93", "13": "93", "83": "93", "84": "93",
  // Outre-mer : le code région est identique au code département
  "971": "01", "972": "02", "973": "03", "974": "04", "976": "06",
};

/** Code région d'un département, ou "" si le département est inconnu. */
export function regionDeDepartement(dept: string): string {
  return REGION_DE_DEPARTEMENT[dept] ?? "";
}
```

Test `web/src/lib/jobs/departements.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { REGION_DE_DEPARTEMENT, regionDeDepartement } from "./departements";

describe("regionDeDepartement", () => {
  it("rattache les huit départements franciliens à la région 11", () => {
    for (const d of ["75", "77", "78", "91", "92", "93", "94", "95"]) {
      expect(regionDeDepartement(d)).toBe("11");
    }
  });

  it("couvre la Corse et l'outre-mer, qui ne suivent pas la numérotation", () => {
    expect(regionDeDepartement("2A")).toBe("94");
    expect(regionDeDepartement("2B")).toBe("94");
    expect(regionDeDepartement("974")).toBe("04");
  });

  it("rend une chaîne vide pour un département inconnu", () => {
    expect(regionDeDepartement("99")).toBe("");
    expect(regionDeDepartement("")).toBe("");
  });

  it("couvre les 101 départements français", () => {
    expect(Object.keys(REGION_DE_DEPARTEMENT)).toHaveLength(101);
  });
});
```

⚠️ Si le dernier test échoue, c'est la table qui est incomplète — la compléter,
ne pas ajuster le nombre attendu.

- [ ] **6. Déclarer le champ sur le type**

Dans `web/src/lib/jobs/boardsFr.ts`, interface `OffreLegere`, à côté de
`lat`/`lng` :

```ts
  /**
   * Code département de l'offre (« 75 », « 2A », « 974 »), posé à la
   * construction de l'index à partir du contexte Base Adresse Nationale.
   * Absent des fichiers antérieurs au 07/08/2026 et des offres dont le libellé
   * n'est pas géocodable (« Anywhere in France »).
   */
  dept?: string;
```

- [ ] **7. Utiliser `dept` dans le filtre**

Dans `web/src/lib/jobs/boardsLieu.ts`, `dansLeSecteur`. Insérer le nouveau
traitement **avant** le repli sur les libellés, et laisser le cas `commune`
intact.

```ts
import { regionDeDepartement } from "./departements";

// … dans dansLeSecteur, après le bloc « commune » :

  // ⚠️ Département et région se tranchent sur le code, pas sur le libellé.
  // Avant le 07/08/2026 ils tombaient sur `normalize(offre.lieu).includes(nom)` :
  // il fallait que l'offre écrive « Île-de-France » en toutes lettres. Mesuré ce
  // jour-là, 273 libellés le faisaient contre 4 124 qui écrivaient « Paris »
  // seul. Une recherche francilienne écartait 91 offres franciliennes, et en
  // retenait une basée à Dublin dont le libellé énumérait dix sites.
  if (filtre.kind === "departement" && offre.dept) {
    return offre.dept === filtre.code;
  }
  if (filtre.kind === "region" && offre.dept) {
    return regionDeDepartement(offre.dept) === filtre.code;
  }

  // Repli inchangé : sans département connu, l'absence d'information n'est pas
  // une preuve d'éloignement (même règle que pour les dates).
  if (!offre.lieu) return true;
  if (!nom) return true;
  return normalize(offre.lieu).includes(nom);
```

- [ ] **8. Tests du filtre**

Ajouter dans `web/src/lib/jobs/boardsLieu.test.ts` :

```ts
it("retient une offre parisienne dont le libellé ne nomme pas la région", () => {
  // ⚠️ Cas mesuré le 07/08/2026 : 4 124 offres écrivent « Paris » sans mention
  // de région. Le filtre textuel les écartait toutes d'une recherche IDF.
  const offre = { lieu: "Paris", dept: "75" };
  const filtre = { kind: "region" as const, code: "11", label: "Île-de-France", radiusKm: 10 };
  expect(dansLeSecteur(offre, filtre, null)).toBe(true);
});

it("écarte une offre hors région même si son libellé cite la région", () => {
  // ⚠️ Le défaut symétrique : « Dublin … / Paris, Île de France, France » passait
  // le filtre IDF alors que le poste est irlandais.
  const offre = { lieu: "Dublin, Ireland / Paris, Île de France, France", dept: "" };
  const filtre = { kind: "region" as const, code: "11", label: "Île-de-France", radiusKm: 10 };
  // Sans département connu on retombe sur le libellé : ce cas reste imparfait,
  // il est documenté comme limite connue. On vérifie seulement qu'un département
  // renseigné et étranger au périmètre est bien écarté.
  expect(dansLeSecteur({ lieu: "Lyon", dept: "69" }, filtre, null)).toBe(false);
});

it("le filtre département compare le code, pas le libellé", () => {
  const filtre = { kind: "departement" as const, code: "93", label: "Seine-Saint-Denis", radiusKm: 10 };
  expect(dansLeSecteur({ lieu: "Montreuil", dept: "93" }, filtre, null)).toBe(true);
  expect(dansLeSecteur({ lieu: "Saint-Denis", dept: "974" }, filtre, null)).toBe(false);
});

it("une offre sans département garde le repli sur le libellé", () => {
  const filtre = { kind: "region" as const, code: "11", label: "Île-de-France", radiusKm: 10 };
  expect(dansLeSecteur({ lieu: "Paris, Île-de-France, France" }, filtre, null)).toBe(true);
});
```

- [ ] **9. Vérifier et committer**

```bash
cd web && npm test && npm run build && npm run lint
```

```bash
git add scripts/boards/geo.mjs scripts/boards/geo.test.mjs scripts/build-boards-offres.mjs web/src/lib/jobs/departements.ts web/src/lib/jobs/departements.test.ts web/src/lib/jobs/boardsFr.ts web/src/lib/jobs/boardsLieu.ts web/src/lib/jobs/boardsLieu.test.ts web/src/lib/jobs/data/boards-geo.json web/src/lib/jobs/data/boards-offres.json
git commit -m "fix(boards): une recherche regionale trouve enfin les offres de la region"
```

### Critère de réussite mesurable

Écrire un fichier d'analyse jetable, le lancer, **lire sa sortie**, puis le
supprimer :

```
Recherche : keywords=["marketing digital"], region 11 (Île-de-France), 30 jours
AVANT T1 : 10 offres retenues
APRÈS T1 : > 60 offres retenues (le plafond doit être atteint)
Aucune offre retenue dont le dept n'appartient pas à {75,77,78,91,92,93,94,95}
```

### Limite connue, à documenter et non à résoudre

Une offre dont le libellé énumère plusieurs sites (« Dublin … / Paris … ») est
géocodée sur une seule commune. Le géocodeur choisit Paris, l'offre reçoit
`dept: "75"` et passe le filtre IDF alors que le poste est à Dublin. Le traiter
demanderait de géocoder chaque site du libellé et de garder une liste de
départements. **Hors périmètre.** L'ajouter à `LIMITES.md`, section 2.

---

## T2 — Le plafond de 60 se remplit par pertinence, puis par date

**Fichiers**

| Fichier | Opération |
|---|---|
| `web/src/lib/jobs/boardsFr.ts` | Modifier — fonction `pertinence` + tri à deux niveaux |
| `web/src/lib/jobs/boardsFr.test.ts` | Modifier — ajouter les cas |

### Principe

Un mot-clé **saisi par le candidat** vaut plus qu'un mot-clé **ajouté par la
table de synonymes**. Le tri devient : pertinence décroissante d'abord, date
décroissante ensuite. Aucun filtre n'est ajouté ni retiré — seul l'ordre change,
donc seul le contenu des 60 places change.

### Étapes

- [ ] **1. Ajouter la fonction de pertinence**

Dans `web/src/lib/jobs/boardsFr.ts`, à côté de `matchTitre` :

```ts
/**
 * Priorité d'une offre dans la sélection : 2 si son titre contient un mot-clé
 * réellement saisi par le candidat, 1 s'il ne contient qu'un équivalent ajouté
 * par la table de synonymes, 0 sinon (ne devrait pas arriver, l'offre ayant
 * déjà passé `matchTitre`).
 *
 * ⚠️ Sans ce niveau de tri, le plafond de 60 se remplissait par date seule.
 * Mesuré le 07/08/2026 sur une recherche marketing : les 60 places partaient à
 * des offres amenées par un synonyme, et les offres correspondant aux intitulés
 * réellement tapés n'entraient jamais dans la sélection. La date reste le
 * second critère : à pertinence égale, une offre du jour a moins de candidats.
 */
function pertinence(titre: string, saisis: string[], elargis: string[]): number {
  const hay = normalize(titre);
  if (saisis.some((k) => k.trim() !== "" && hay.includes(normalize(k)))) return 2;
  if (elargis.some((k) => k.trim() !== "" && hay.includes(normalize(k)))) return 1;
  return 0;
}
```

- [ ] **2. Appliquer le tri**

Dans `searchBoards`, remplacer la ligne de tri actuelle. **Conserver tous les
commentaires existants qui l'entourent** : ils documentent deux bugs mesurés (le
tri alphabétique du 04/08, le repli `decouverteLe` du 06/08) et restent vrais.

```ts
    .sort((a, b) =>
      pertinence(b.titre, profile.keywords, motsCles) -
        pertinence(a.titre, profile.keywords, motsCles) ||
      dateEffective(b).localeCompare(dateEffective(a)),
    );
```

- [ ] **3. Tests**

Ajouter dans `web/src/lib/jobs/boardsFr.test.ts` :

```ts
it("une offre correspondant au mot tapé passe devant une offre plus récente amenée par un synonyme", () => {
  // ⚠️ Défaut mesuré le 07/08/2026 : le plafond de 60 se remplissait par date
  // seule, et les offres correspondant aux intitulés tapés n'entraient jamais.
  // (Construire un profil avec keywords ["développeur"], et deux offres :
  //  A « Développeur PHP » publiée il y a 20 jours,
  //  B « Software Engineer » publiée hier.
  //  Attendu : A avant B dans la sélection.)
});

it("à pertinence égale, la plus récente reste en tête", () => {
  // Le tri par date n'est pas supprimé, il devient le second critère.
});
```

⚠️ Écrire ces tests **complètement**, avec les fixtures. Les squelettes
ci-dessus décrivent l'intention, pas le code à livrer.

- [ ] **4. Tests existants à adapter — signalé explicitement**

Ce changement modifie l'**ordre** des résultats. Des tests de
`boardsFr.test.ts` asservissent l'ordre attendu. Pour chacun qui casse :

1. Vérifier que la nouvelle sortie est **correcte** au regard du nouveau
   contrat (pertinence puis date).
2. Si oui, adapter l'attendu **et ajouter un commentaire** indiquant la date et
   la raison, sur le modèle de ceux déjà présents dans ce fichier.
3. Si non — si un test échoue pour une autre raison que l'ordre — **arrêter**.
   C'est le code qui est faux.

- [ ] **5. Vérifier et committer**

```bash
cd web && npm test && npm run build && npm run lint
```

```bash
git add web/src/lib/jobs/boardsFr.ts web/src/lib/jobs/boardsFr.test.ts
git commit -m "fix(boards): les offres correspondant au metier tape passent devant"
```

### Critère de réussite mesurable

Sur la recherche de référence (`keywords` de la section Diagnostic, région 11) :
parmi les 60 candidates retenues, **aucune ne doit avoir une pertinence de 0**,
et les offres de pertinence 2 doivent toutes précéder celles de pertinence 1.

---

## T3 — Ne plus enregistrer les offres hors-sujet, et purger l'existant

**Fichiers**

| Fichier | Opération |
|---|---|
| `web/src/lib/jobs/rank/index.ts` | Modifier — `shouldPersist` cesse d'être un bouchon |
| `web/src/lib/jobs/rank/index.test.ts` | Modifier — ajouter les cas |
| `web/src/lib/storage/db.ts` | Modifier — ajouter `supprimerJobsSousLeSeuil` |
| `web/src/components/jobs/JobsView.tsx` | Modifier — bouton de purge |

### Principe

La notation fonctionne déjà et donne 18/100 lettre D aux offres hors-sujet. Deux
choses manquent : ne plus les enregistrer, et retirer celles déjà en base.

⚠️ **`shouldPersist` s'applique aux quatre sources, pas seulement au marché
caché.** Le seuil doit donc être conservateur et lisible par l'utilisateur, pas
codé en dur au hasard. `profile.gradeThresholds` existe déjà et vaut par défaut
`{ S: 85, A: 70, B: 55, C: 40 }` : en dessous de `C`, l'offre est en D.

### Étapes

- [ ] **1. Rendre `shouldPersist` effectif**

`web/src/lib/jobs/rank/index.ts:126` :

```ts
/**
 * L'offre mérite-t-elle d'entrer dans la base locale ?
 *
 * ⚠️ Cette fonction rendait `true` sans condition, ce qui rendait la notation
 * décorative. Mesuré le 07/08/2026 dans la base d'un utilisateur : 44 offres
 * stockées, dont « Head of HRBP » et « Senior Site Contracts Manager » notées
 * 18/100 lettre D sur une recherche marketing. Le classement les avait
 * correctement identifiées comme hors-sujet ; rien n'en tenait compte.
 *
 * Le seuil est celui que l'utilisateur règle déjà pour la lettre C : une offre
 * en D est, par définition de ses propres réglages, hors-sujet.
 */
export function shouldPersist(result: RankResult, profile: JobSearchProfile): boolean {
  const seuil = profile.gradeThresholds?.C ?? DEFAULT_THRESHOLDS.C;
  return result.score >= seuil;
}
```

- [ ] **2. Tests**

```ts
it("n'enregistre pas une offre sous le seuil de la lettre C", () => {
  // ⚠️ Cas réel du 07/08/2026 : « Head of HRBP » notée 18/100 sur une recherche
  // marketing, enregistrée quand même.
});

it("enregistre une offre au seuil exact", () => {
  // Le seuil est inclusif : score === seuil doit passer.
});

it("respecte un seuil personnalisé du profil", () => {
  // gradeThresholds.C réglé à 60 : une offre à 55 ne passe plus.
});
```

Écrire ces tests complètement.

- [ ] **3. Purge des offres déjà stockées**

Dans `web/src/lib/storage/db.ts`, à côté de `listJobsByGrade` :

```ts
/**
 * Supprime les offres déjà en base dont le score est sous le seuil.
 *
 * ⚠️ Nécessaire parce que la base est CUMULATIVE : une recherche y ajoute des
 * offres, n'en retire jamais. Les offres hors-sujet enregistrées avant que
 * `shouldPersist` ne devienne effectif resteraient affichées indéfiniment, ce
 * qui donne l'impression que les corrections en amont ne servent à rien.
 *
 * Rend le nombre d'offres supprimées.
 */
export async function supprimerJobsSousLeSeuil(seuil: number): Promise<number> {
  // Implémentation Dexie : suivre le style des fonctions voisines du fichier.
}
```

- [ ] **4. Exposer la purge dans l'écran Offres**

Dans `web/src/components/jobs/JobsView.tsx`, ajouter un bouton **« Purger les
offres hors-sujet »** à côté de « Réinitialiser ».

Contraintes d'interface :

- Demander confirmation avec **`uiConfirm`**, jamais `confirm` natif. Le message
  doit annoncer le nombre exact d'offres concernées, pas un nombre vague.
- Après suppression, confirmer avec **`toast`** : « N offres hors-sujet
  supprimées. »
- Recharger la liste (`reload()`).
- Suivre les classes et le style des boutons voisins. Ne pas introduire de
  nouvelle convention visuelle.

- [ ] **5. Vérifier et committer**

```bash
cd web && npm test && npm run build && npm run lint
```

```bash
git add web/src/lib/jobs/rank/index.ts web/src/lib/jobs/rank/index.test.ts web/src/lib/storage/db.ts web/src/components/jobs/JobsView.tsx
git commit -m "fix(jobs): les offres hors-sujet ne sont plus enregistrees ni conservees"
```

### Critère de réussite mesurable

Vérification **dans l'application lancée** (`npm run dev`), pas en test unitaire :

1. Ouvrir `/jobs`, noter le nombre affiché (« N offres retenues »).
2. Cliquer « Purger les offres hors-sujet », confirmer.
3. Le compteur doit diminuer du nombre d'offres en D, et aucune carte affichée
   ne doit plus porter la lettre D.
4. Relancer une recherche : aucune offre en D ne doit apparaître.

---

## T4 — Deux derniers groupes de synonymes trop larges

**Fichiers**

| Fichier | Opération |
|---|---|
| `web/src/lib/jobs/synonymes.ts` | Modifier — deux groupes |
| `web/src/lib/jobs/synonymes.test.ts` | Modifier — ajouter les cas |

### Diagnostic

Deux groupes ont le même défaut que ceux corrigés en A, et n'ont pas été touchés
parce qu'ils sortaient du périmètre de cette correction.

**`["securite", "safety", "hse"]`** — un candidat qui cherche « sécurité
informatique » déclenche aussi ce groupe, parce que son mot-clé **contient**
« securite ». Il reçoit des postes HSE (hygiène, sécurité, environnement), un
métier sans rapport. Le groupe voisin `["securite informatique",
"cybersecurity", "security engineer"]` est correct et doit rester.

**`["donnees", "data"]`** — `"data"` ajouté comme mot-clé isolé fait remonter
tout titre le contenant : Data Analyst, Data Engineer, Data Scientist, Master
Data Specialist. C'est un domaine, pas un métier.

### Étapes

- [ ] **1. Mesurer avant de corriger**

Écrire un fichier d'analyse jetable qui compte, sur `boards-offres.json`, les
offres atteintes par `elargirMotsCles(["sécurité informatique"])` et par
`elargirMotsCles(["données"])`. **Noter les deux nombres** : ils serviront de
référence avant/après et devront figurer dans le commentaire du code.

- [ ] **2. Corriger**

Appliquer la règle déjà en vigueur dans le fichier : **expression, jamais mot
isolé**.

```ts
  // ⚠️ « securite » seul déclenchait ce groupe depuis « sécurité informatique »,
  // et un candidat en cybersécurité recevait des postes HSE. Le métier HSE se
  // nomme en expression.
  ["responsable hse", "hse manager", "health safety environment", "hygiene securite environnement"],
```

```ts
  // ⚠️ « data » seul est un domaine, pas un métier : il remontait Data Analyst,
  // Data Engineer, Data Scientist et Master Data Specialist indifféremment.
  ["donnees", "data analyst", "data engineer", "data scientist", "analyste de donnees"],
```

⚠️ Tous les termes des groupes doivent être écrits **en minuscules sans
accent** : `elargirMotsCles` compare le mot-clé normalisé au terme **brut**
(`k.includes(terme)`). Un terme accentué dans la table ne se déclenche jamais.

- [ ] **3. Tests**

```ts
it("« sécurité informatique » ne ramène pas de postes HSE", () => {
  const r = elargirMotsCles(["sécurité informatique"]);
  expect(r).toContain("cybersecurity");
  expect(r).not.toContain("hse");
  expect(r).not.toContain("safety");
});

it("« données » ne ramène pas le mot « data » seul", () => {
  const r = elargirMotsCles(["données"]);
  expect(r).not.toContain("data");
  expect(r).toContain("data analyst");
});
```

- [ ] **4. Tests existants à adapter — signalé explicitement**

Si un test existant de `synonymes.test.ts` asservit `"data"` ou `"safety"` nus,
c'est exactement le comportement supprimé : adapter l'attendu vers les
expressions, avec un commentaire daté expliquant pourquoi. Comme en T2, si un
test casse pour une autre raison, **arrêter**.

- [ ] **5. Mettre à jour l'en-tête du fichier**

`synonymes.ts` porte un tableau de mesures en en-tête. Y ajouter les deux
chiffres relevés à l'étape 1 (avant → après). **Ne jamais y écrire un chiffre
non mesuré** : ce tableau a déjà contenu une valeur inventée (« responsable RH,
+490 % » alors que le vrai chiffre était 2 807 titres atteints), ce qui a masqué
le défaut pendant une journée.

- [ ] **6. Vérifier et committer**

```bash
cd web && npm test && npm run build && npm run lint
```

```bash
git add web/src/lib/jobs/synonymes.ts web/src/lib/jobs/synonymes.test.ts
git commit -m "fix(boards): la cybersecurite ne ramene plus de postes HSE"
```

---

## 3. Clôture

- [ ] Mettre à jour `LIMITES.md` : la limite du filtre régional est levée
      (section 2.4) ; ajouter la limite des libellés multi-sites (T1).
- [ ] Ajouter une entrée à `WORK_HISTORY.md` : ce qui a été corrigé, les
      chiffres mesurés avant/après, et ce qui reste ouvert.
- [ ] Supprimer tout fichier d'analyse jetable créé en route. Vérifier avec
      `git status --porcelain` : seul `append.js` doit rester non suivi.
- [ ] **Ne pas pousser.** Laisser les commits en local.

### Rapport attendu

Pour chaque tâche :

1. Le diff (fichiers et lignes).
2. La **sortie réelle** de `npm test`, `npm run build`, `npm run lint` — copiée,
   pas résumée.
3. La mesure avant/après du critère de réussite.
4. Ce qui n'a pas été fait, et pourquoi.

Une tâche dont le critère de réussite n'a pas été mesuré n'est pas terminée.

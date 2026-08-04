# Marché caché — Brique 1 : l'index des boards français — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** produire `boards-fr.json`, la liste des entreprises dont le board ATS
public contient au moins une offre en France, et le tenir à jour chaque semaine
sans repayer le balayage complet.

**Architecture:** cinq petits modules `.mjs` sous `scripts/boards/`, chacun avec
une responsabilité unique et sa propre suite `node --test`, orchestrés par
`scripts/build-boards-fr.mjs` sur le patron de `scripts/build-rome.mjs`. La
sortie est deux fichiers JSON commités dans `web/src/lib/jobs/data/` : l'index,
et la mémoire de ce qui a déjà été testé. Un workflow GitHub Actions hebdomadaire
relance le script en incrémental.

**Tech Stack:** Node 22, ESM (`.mjs`), `fetch` natif, `node --test` pour les
modules de script, Vitest pour le test de cohérence du JSON produit. **Aucune
dépendance npm.**

**Spec de référence :** `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`.
**Contrat d'exécution :** `web/CADRAGE_EXECUTION.md` — à lire en entier avant la
première ligne de code.

## Global Constraints

- **Aucune dépendance npm ajoutée ou mise à jour.** Ni dans le script, ni dans l'app.
- Le script ne touche jamais à `web/` hors des deux fichiers de données qu'il produit.
- Aucun secret : les quatre ATS et l'API entreprises sont publics et sans clé.
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.** TypeScript strict doit compiler.
- **PUSH STRICTEMENT INTERDIT.** Commit local par task, jamais de `git push`.
- Journal obligatoire après chaque task dans `WORK_HISTORY.md` (section `## Journal`,
  entrée datée en tête) + mise à jour de la ligne « Prochaine étape suggérée ».
- Les commentaires de code sont en **français**, les identifiants en français
  aussi dans `scripts/boards/` — c'est la langue du reste de `scripts/build-rome.mjs`.
- **Concurrence réseau plafonnée à 12 requêtes simultanées, timeout 15 s.** Ces
  APIs sont publiques et gratuites ; un balayage plus agressif risquerait un
  bannissement d'IP qui coûterait la brique entière.
- `null` et `0` ne veulent pas dire la même chose dans tout ce plan : `0` = « testé,
  rien trouvé », `null` = « on ne sait pas » (réseau, 5xx, JSON illisible). Cette
  distinction est ce qui empêche l'index de s'effacer un jour de panne réseau.

## Protocole de vérification (après CHAQUE task)

Depuis la racine du dépôt :

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/`, dans cet ordre, en collant la sortie réelle :

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

Une vérification rouge = task NON LIVRÉE. On corrige avant de continuer.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `scripts/boards/slugs.mjs` | nom d'entreprise → slugs candidats (jumeau de `ats.ts`) |
| `scripts/boards/france.mjs` | « ce lieu est-il en France ? » — fonction pure |
| `scripts/boards/ats.mjs` | compter les offres FR d'un board, par ATS |
| `scripts/boards/memo.mjs` | lire/écrire l'index et le mémo, TTL, tri |
| `scripts/boards/sources.mjs` | énumérer les slugs (listes) et les entreprises (SIRENE) |
| `scripts/boards/lot.mjs` | exécuter N tâches avec une concurrence plafonnée |
| `scripts/build-boards-fr.mjs` | orchestration, CLI |
| `web/src/lib/jobs/data/boards-fr.json` | l'index — produit, commité |
| `web/src/lib/jobs/data/boards-fr-testes.json` | le mémo — produit, commité |
| `web/src/lib/jobs/data/boards-fr.test.ts` | cohérence de l'index (Vitest) |
| `.github/workflows/boards-fr.yml` | rafraîchissement hebdomadaire |

---

## Task 1 : dérivation des slugs candidats

**Files:**
- Create: `scripts/boards/slugs.mjs`
- Create: `scripts/boards/slugs.test.mjs`
- Modify: `web/src/lib/jobs/ats.test.ts` (ajout d'un commentaire de jumelage, 3 lignes)

**Interfaces:**
- Consumes: rien.
- Produces: `normaliserNom(nom: string): string`, `slugsCandidats(nom: string): string[]`.

**Pourquoi ce doublon.** `web/src/lib/jobs/ats.ts` contient déjà `normalizeCompany`
et `atsSlugs`. Ils ne sont pas importables ici : un `.mjs` ne peut pas importer un
`.ts`, et l'app ne peut pas importer depuis `scripts/`. On duplique donc huit
lignes, et on épingle les deux copies avec **les mêmes vecteurs de test** pour
qu'une divergence casse une suite au lieu de produire un index faux en silence.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `scripts/boards/slugs.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normaliserNom, slugsCandidats } from "./slugs.mjs";

// ⚠️ VECTEURS JUMEAUX — les mêmes cas existent dans
// web/src/lib/jobs/ats.test.ts (describe « atsSlugs »). Les deux copies de la
// dérivation doivent rester identiques ; si tu modifies un cas ici, modifie-le
// là-bas aussi, sinon l'index et l'app ne parleront plus du même slug.

test("met en minuscules et retire les accents", () => {
  assert.equal(normaliserNom("Société Générale"), "societe-generale");
});

test("propose la variante collée en plus de la variante tiretée", () => {
  assert.deepEqual(slugsCandidats("Groupe SEB"), ["groupe-seb", "groupeseb"]);
});

test("ne propose qu'un slug quand les deux variantes sont identiques", () => {
  assert.deepEqual(slugsCandidats("Doctolib"), ["doctolib"]);
});

test("retire les apostrophes et la ponctuation", () => {
  assert.deepEqual(slugsCandidats("L'Oréal S.A."), ["l-oreal-s-a", "lorealsa"]);
});

test("ne renvoie rien pour un nom vide ou sans lettre", () => {
  assert.deepEqual(slugsCandidats(""), []);
  assert.deepEqual(slugsCandidats("   "), []);
  assert.deepEqual(slugsCandidats("---"), []);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/slugs.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/slugs.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/slugs.mjs` :

```js
// Nom d'entreprise → slugs candidats pour les boards ATS.
//
// ⚠️ JUMEAU de `normalizeCompany` / `atsSlugs` dans web/src/lib/jobs/ats.ts.
// La duplication est subie : un .mjs ne peut pas importer un .ts, et l'app ne
// peut pas importer depuis scripts/. Les deux copies sont épinglées par des
// vecteurs de test identiques (voir slugs.test.mjs et ats.test.ts).

/**
 * Nom ramené à sa forme canonique : minuscules, sans accent, mots séparés par
 * des tirets. La plage U+0300–U+036F est celle des diacritiques combinants,
 * isolés par la décomposition NFD : « Société » devient « societe ».
 */
export function normaliserNom(nom) {
  return String(nom)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs à essayer, du plus probable au moins probable. Chaque ATS a ses
 * conventions : « Groupe SEB » peut être `groupe-seb` chez l'un et `groupeseb`
 * chez l'autre. On essaie les deux plutôt que de parier.
 */
export function slugsCandidats(nom) {
  const base = normaliserNom(nom);
  if (!base) return [];

  const colle = base.replace(/-/g, "");
  return colle === base ? [base] : [base, colle];
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/slugs.test.mjs"
```

Attendu : `# pass 5`, `# fail 0`.

- [ ] **Step 5 : marquer le jumelage côté app**

Dans `web/src/lib/jobs/ats.test.ts`, insérer juste au-dessus de la ligne
`describe("atsSlugs", () => {` :

```ts
// ⚠️ VECTEURS JUMEAUX — les mêmes cas existent dans scripts/boards/slugs.test.mjs,
// qui teste la copie `.mjs` de cette dérivation (le script de build ne peut pas
// importer ce fichier TypeScript). Si tu modifies un cas ici, modifie-le là-bas.
```

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 6 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 7 : commit**

```bash
git add scripts/boards/slugs.mjs scripts/boards/slugs.test.mjs web/src/lib/jobs/ats.test.ts
git commit -m "feat(boards): dérivation des slugs candidats, jumelle de celle de l'app"
```

- [ ] **Step 8 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 2 : reconnaître une offre située en France

**Files:**
- Create: `scripts/boards/france.mjs`
- Create: `scripts/boards/france.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `estFrancais(lieu: string, paysIso?: string): boolean`.

**Le cœur de la brique.** Trois règles dans l'ordre : champ pays structuré,
marqueur de pays dans le texte, ville ou région française. La troisième n'est
**pas** un repli — mesuré le 04/08/2026, sans elle On Running sort entièrement
de l'index (8 offres « Paris », aucun marqueur de pays) et Loft Orbital perd 13
de ses 14 offres (« Toulouse, Occitanie »).

- [ ] **Step 1 : écrire le test qui échoue**

Créer `scripts/boards/france.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { estFrancais } from "./france.mjs";

// Règle 1 — le champ pays structuré fait foi, on ne regarde pas le texte.
test("le pays structuré l'emporte sur le texte", () => {
  assert.equal(estFrancais("Berlin", "FR"), true);
  assert.equal(estFrancais("Paris, France", "US"), false);
  assert.equal(estFrancais("Lille", "fr"), true);
});

// Règle 2 — marqueur de pays explicite dans le texte.
test("reconnaît un marqueur de pays dans le texte", () => {
  assert.equal(estFrancais("Paris, France"), true);
  assert.equal(estFrancais("Anywhere in France"), true);
  assert.equal(estFrancais("Paris Area, France"), true);
  assert.equal(estFrancais("Montpellier, France"), true);
  assert.equal(estFrancais("Lille, fr"), true);
});

// Règle 3 — ville ou région. Sans elle, deux boards réels disparaissent.
test("reconnaît une région française sans marqueur de pays", () => {
  assert.equal(estFrancais("Toulouse, Occitanie"), true);
});

test("reconnaît une ville française seule", () => {
  assert.equal(estFrancais("Paris"), true);
  assert.equal(estFrancais("Sophia Antipolis"), true);
  assert.equal(estFrancais("Issy-les-Moulineaux"), true);
});

// Garde — sans elle, « Paris, TX » entre dans l'index.
test("rejette une ville homonyme à l'étranger", () => {
  assert.equal(estFrancais("Paris, TX"), false);
  assert.equal(estFrancais("Paris, Texas"), false);
});

// « Grande-Bretagne » contient « Bretagne » : le piège est réel.
test("ne prend pas la Grande-Bretagne pour la Bretagne", () => {
  assert.equal(estFrancais("Londres, Grande-Bretagne"), false);
});

test("rejette les lieux étrangers", () => {
  assert.equal(estFrancais("Berlin, Berlin, Germany"), false);
  assert.equal(estFrancais("Remote, Brasil"), false);
  assert.equal(estFrancais("Frankfurt"), false);
  assert.equal(estFrancais("Münster; Osnabrück"), false);
  assert.equal(estFrancais("New York, New York"), false);
});

test("rejette une entrée vide ou absente", () => {
  assert.equal(estFrancais(""), false);
  assert.equal(estFrancais("   "), false);
  assert.equal(estFrancais(undefined), false);
  assert.equal(estFrancais(null), false);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/france.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/france.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/france.mjs` :

```js
// « Cette offre est-elle en France ? »
//
// Les quatre ATS écrivent le lieu de quatre façons incompatibles. Formats
// relevés sur de vraies réponses le 04/08/2026 :
//   Greenhouse       "Berlin, Berlin, Germany"  "Frankfurt"  "Paris"
//   Ashby            "Paris, France"            "Anywhere in France"
//   Lever            "Paris Area, France"       "Toulouse, Occitanie"
//   SmartRecruiters  champ structuré { city, country }
//   Lever            champ structuré `country` (ISO), présent mais pas toujours
//
// ⚠️ La règle 3 (ville/région) n'est PAS un confort. Mesuré le 04/08/2026 :
// On Running a 8 offres françaises écrites « Paris », zéro marqueur de pays —
// sans la règle 3 ce board sort entièrement de l'index. Loft Orbital a 13 offres
// « Toulouse, Occitanie » contre 1 seule avec marqueur.

/** Décomposition NFD puis suppression des diacritiques combinants. */
function sansAccent(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Marqueur de pays explicite. « Île-de-France » et « Hauts-de-France » passent ici. */
const MARQUEUR_FR = /(\bfrance\b|,\s*fr\s*$|\(\s*fr\s*\))/i;

/**
 * Pays étrangers qui invalident une correspondance de ville ou de région.
 * « grande-bretagne » et « great britain » sont là pour une raison précise :
 * sans eux, « Bretagne » les capture.
 */
const PAYS_ETRANGERS = [
  "germany", "deutschland", "spain", "espana", "italy", "italia", "portugal",
  "belgium", "belgique", "netherlands", "nederland", "switzerland", "suisse",
  "luxembourg", "austria", "poland", "polska", "romania", "hungary", "czechia",
  "brazil", "brasil", "canada", "mexico", "argentina", "chile", "colombia",
  "india", "japan", "china", "singapore", "korea", "vietnam", "thailand",
  "australia", "new zealand", "usa", "u.s.", "united states", "uk",
  "united kingdom", "grande-bretagne", "great britain", "england", "scotland",
  "ireland", "sweden", "norway", "denmark", "finland", "iceland", "greece",
  "turkey", "israel", "egypt", "morocco", "maroc", "tunisia", "tunisie",
  "algeria", "algerie", "senegal", "south africa", "nigeria", "kenya",
  "uae", "dubai", "saudi", "qatar", "russia", "ukraine", "bulgaria", "serbia",
];

/** Noms d'états américains qui piègent une ville homonyme (« Paris, Texas »). */
const ETATS_US = [
  "texas", "illinois", "kentucky", "tennessee", "arkansas", "missouri", "maine",
  "idaho", "ohio", "indiana", "iowa", "michigan", "virginia", "california",
  "florida", "georgia", "colorado", "arizona", "nevada", "oregon", "washington",
  "massachusetts", "pennsylvania", "carolina", "alabama", "oklahoma", "kansas",
  "nebraska", "minnesota", "wisconsin", "louisiana", "mississippi", "utah",
];

const RE_ETRANGER = new RegExp(`\\b(${[...PAYS_ETRANGERS, ...ETATS_US].join("|")})\\b`, "i");

/**
 * Code à deux lettres en fin de chaîne : « Paris, TX ».
 * On exige la fin de chaîne — sinon « Paris, La Défense » serait pris pour
 * la Louisiane.
 */
const RE_CODE_FINAL = /,\s*([a-z]{2})\s*$/i;

/** Les treize régions métropolitaines, sans accent, plus le sigle PACA. */
const REGIONS = [
  "auvergne-rhone-alpes", "bourgogne-franche-comte", "bretagne",
  "centre-val de loire", "corse", "grand est", "hauts-de-france",
  "ile-de-france", "normandie", "nouvelle-aquitaine", "occitanie",
  "pays de la loire", "provence-alpes-cote d'azur", "paca",
];

/**
 * Villes françaises usuelles et pôles d'emploi tech, sans accent.
 * Certaines sont ambiguës hors contexte — « nice », « tours », « nancy »,
 * « brest » — mais la règle 3 ne s'applique qu'à des champs de localisation
 * courts, déjà filtrés par RE_ETRANGER et RE_CODE_FINAL.
 */
const VILLES = [
  "paris", "lyon", "marseille", "toulouse", "lille", "bordeaux", "nantes",
  "nice", "strasbourg", "montpellier", "rennes", "grenoble", "rouen", "toulon",
  "saint-etienne", "dijon", "angers", "villeurbanne", "le mans", "reims",
  "aix-en-provence", "clermont-ferrand", "brest", "limoges", "tours", "amiens",
  "perpignan", "metz", "besancon", "orleans", "mulhouse", "caen", "nancy",
  "argenteuil", "roubaix", "tourcoing", "nanterre", "avignon", "poitiers",
  "versailles", "courbevoie", "creteil", "pau", "la rochelle", "cannes",
  "antibes", "sophia antipolis", "sophia-antipolis", "valbonne", "saclay",
  "massy", "orsay", "issy-les-moulineaux", "levallois-perret",
  "boulogne-billancourt", "neuilly-sur-seine", "rungis", "saint-denis",
  "montreuil", "vincennes", "puteaux", "la defense", "cergy", "evry",
  "marne-la-vallee", "labege", "blagnac", "merignac", "cesson-sevigne",
  "villeneuve-d-ascq", "villeneuve d'ascq", "lens", "annecy", "chambery",
  "la roche-sur-yon", "niort", "angouleme", "bayonne", "biarritz", "arras",
];

const RE_REGIONS = new RegExp(`\\b(${REGIONS.join("|")})\\b`, "i");
const RE_VILLES = new RegExp(`\\b(${VILLES.join("|")})\\b`, "i");

/**
 * `paysIso` est le code pays du champ structuré quand l'ATS en expose un
 * (SmartRecruiters toujours, Lever souvent). Quand il est présent il fait foi,
 * y compris pour dire non.
 */
export function estFrancais(lieu, paysIso) {
  const iso = String(paysIso ?? "").trim();
  if (iso) return iso.toUpperCase() === "FR";

  const brut = String(lieu ?? "").trim();
  if (!brut) return false;

  if (MARQUEUR_FR.test(brut)) return true;

  const texte = sansAccent(brut);
  if (RE_ETRANGER.test(texte)) return false;

  const code = RE_CODE_FINAL.exec(brut);
  if (code && code[1].toUpperCase() !== "FR") return false;

  return RE_REGIONS.test(texte) || RE_VILLES.test(texte);
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/france.test.mjs"
```

Attendu : `# pass 8`, `# fail 0`.

- [ ] **Step 5 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 6 : commit**

```bash
git add scripts/boards/france.mjs scripts/boards/france.test.mjs
git commit -m "feat(boards): détection des offres situées en France"
```

- [ ] **Step 7 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 3 : compter les offres françaises d'un board

**Files:**
- Create: `scripts/boards/ats.mjs`
- Create: `scripts/boards/ats.test.mjs`

**Interfaces:**
- Consumes: `estFrancais(lieu, paysIso)` de `./france.mjs`.
- Produces: `ATS: string[]`, `compterFR(ats, slug, fetchImpl?): Promise<number | null>`.

**La distinction qui protège l'index.** `compterFR` renvoie `null` quand la
réponse n'est pas exploitable — réseau coupé, 5xx, JSON illisible — et un nombre
quand elle l'est. `null` veut dire « on ne sait pas » et n'autorise aucune
conclusion ; `0` veut dire « testé, rien trouvé ». Sans cette distinction, une
panne d'Ashby viderait l'index et le commiterait.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `scripts/boards/ats.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { ATS, compterFR } from "./ats.mjs";

/** `fetch` factice : une réponse par fragment d'URL, 404 pour tout le reste. */
function fauxFetch(reponses) {
  return async (url) => {
    const u = String(url);
    const cle = Object.keys(reponses).find((k) => u.includes(k));
    if (!cle) return new Response("", { status: 404 });
    const r = reponses[cle];
    if (typeof r === "number") return new Response("", { status: r });
    return new Response(JSON.stringify(r), { status: 200 });
  };
}

test("les quatre ATS sont déclarés", () => {
  assert.deepEqual([...ATS].sort(), ["ashby", "greenhouse", "lever", "smartrecruiters"]);
});

test("Greenhouse : compte les offres françaises et ignore les autres", async () => {
  const f = fauxFetch({
    "boards-api.greenhouse.io": {
      jobs: [
        { location: { name: "Paris" } },
        { location: { name: "Berlin, Berlin, Germany" } },
        { location: { name: "Lyon, France" } },
      ],
    },
  });
  assert.equal(await compterFR("greenhouse", "onrunning", f), 2);
});

test("Ashby : lit le lieu à la racine de l'offre", async () => {
  const f = fauxFetch({
    "api.ashbyhq.com": { jobs: [{ location: "Paris, France" }, { location: "Madrid, Spain" }] },
  });
  assert.equal(await compterFR("ashby", "alan", f), 1);
});

// Lever expose `country` en ISO sur certains boards : quand il est là, il fait foi.
test("Lever : le champ country structuré prime sur le texte", async () => {
  const f = fauxFetch({
    "api.lever.co": [
      { categories: { location: "Paris Area, France" }, country: "FR" },
      { categories: { location: "Riyadh" }, country: "SA" },
      { categories: { location: "Toulouse, Occitanie" } },
    ],
  });
  assert.equal(await compterFR("lever", "contentsquare", f), 2);
});

// SmartRecruiters filtre côté serveur : on lit un compteur, pas une liste.
test("SmartRecruiters : lit totalFound avec le filtre pays", async () => {
  const f = fauxFetch({ "api.smartrecruiters.com": { totalFound: 192 } });
  assert.equal(await compterFR("smartrecruiters", "accor", f), 192);
});

test("un board absent vaut zéro, pas inconnu", async () => {
  assert.equal(await compterFR("greenhouse", "boulangerie-durand", fauxFetch({})), 0);
});

test("un board vivant sans offre française vaut zéro", async () => {
  const f = fauxFetch({ "boards-api.greenhouse.io": { jobs: [{ location: { name: "Frankfurt" } }] } });
  assert.equal(await compterFR("greenhouse", "siemens", f), 0);
});

// ⚠️ Le cœur de la protection : une panne ne doit JAMAIS se lire comme un vide.
test("une erreur réseau vaut null, pas zéro", async () => {
  const f = async () => { throw new Error("ECONNRESET"); };
  assert.equal(await compterFR("ashby", "alan", f), null);
});

test("un 500 vaut null, pas zéro", async () => {
  assert.equal(await compterFR("ashby", "alan", fauxFetch({ "api.ashbyhq.com": 500 })), null);
});

test("un JSON illisible vaut null, pas zéro", async () => {
  const f = async () => new Response("<html>maintenance</html>", { status: 200 });
  assert.equal(await compterFR("lever", "swile", f), null);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/ats.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/ats.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/ats.mjs` :

```js
// Compter les offres françaises d'un board ATS public.
//
// Ordre décidé par mesure (sondage du 03/08/2026 sur 49 entreprises
// françaises) : ashby 8, lever 6, smartrecruiters 4, greenhouse 2. Greenhouse,
// l'ATS le plus connu, arrive dernier — c'est un outil de start-up américaine.

import { estFrancais } from "./france.mjs";

export const ATS = ["ashby", "lever", "smartrecruiters", "greenhouse"];

/** Coupe un endpoint qui ne répond pas ; 12 requêtes en vol, personne ne nous a invités. */
const TIMEOUT_MS = 15_000;

const ENDPOINTS = {
  greenhouse: {
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    postes: (c) => (c?.jobs ?? []).map((j) => ({ lieu: j?.location?.name ?? "", pays: "" })),
  },
  lever: {
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    // `country` est un code ISO présent sur certains boards seulement : absent
    // chez Loft Orbital, dont les 13 offres « Toulouse, Occitanie » ne tiennent
    // qu'à la détection textuelle.
    postes: (c) => (Array.isArray(c) ? c : []).map((j) => ({
      lieu: j?.categories?.location ?? "",
      pays: j?.country ?? "",
    })),
  },
  ashby: {
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    // Pas de mode léger : testé le 04/08/2026, includeCompensation=false et
    // includeContent=false rendent 1 666 Ko, le poids de l'appel nu.
    postes: (c) => (c?.jobs ?? []).map((j) => ({ lieu: j?.location ?? "", pays: "" })),
  },
  smartrecruiters: {
    // `country=fr` filtre côté serveur et `limit=1` évite de rapatrier le board :
    // `totalFound` donne directement le compte français. Mesuré sur Accor —
    // 530 offres au total, 192 avec le filtre.
    url: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?country=fr&limit=1`,
    compteur: (c) => (typeof c?.totalFound === "number" ? c.totalFound : 0),
  },
};

/**
 * Nombre d'offres françaises sur ce board.
 *
 * ⚠️ `null` et `0` ne sont pas interchangeables :
 *   - `0`    → testé, board absent ou sans offre française. C'est un fait.
 *   - `null` → réseau, 5xx, JSON illisible. On ne sait pas, et l'appelant n'a
 *              le droit d'en conclure RIEN — surtout pas de retirer l'entrée
 *              de l'index.
 */
export async function compterFR(ats, slug, fetchImpl = fetch) {
  const e = ENDPOINTS[ats];

  let res;
  try {
    res = await fetchImpl(e.url(slug), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }

  if (res.status === 404) return 0;
  if (!res.ok) return null;

  let corps;
  try {
    corps = await res.json();
  } catch {
    return null;
  }

  if (e.compteur) return e.compteur(corps);
  return e.postes(corps).filter((p) => estFrancais(p.lieu, p.pays)).length;
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/ats.test.mjs"
```

Attendu : `# pass 10`, `# fail 0`.

- [ ] **Step 5 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 6 : commit**

```bash
git add scripts/boards/ats.mjs scripts/boards/ats.test.mjs
git commit -m "feat(boards): comptage des offres françaises par ATS, sans confondre panne et vide"
```

- [ ] **Step 7 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 4 : l'index, le mémo et la TTL

**Files:**
- Create: `scripts/boards/memo.mjs`
- Create: `scripts/boards/memo.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces : `cle(ats, slug): string`, `mois(date): string`, `estFrais(vuLe, date): boolean`,
  `nomDepuisSlug(slug): string`, `trierIndex(entrees): entrees`, `trierMemo(entrees): entrees`,
  `fusionner(index, trouvailles): entrees`.

**Pourquoi deux fichiers.** L'index (`boards-fr.json`) ne contient que les succès
et doit rester un diff lisible. Le mémo (`boards-fr-testes.json`) retient **tout**
ce qui a été essayé, échecs compris — sans lui l'incrémental n'a rien sur quoi
s'appuyer, et chaque passage hebdomadaire repaierait 1,6 Go et ~117 000 requêtes.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `scripts/boards/memo.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { cle, mois, estFrais, nomDepuisSlug, trierIndex, trierMemo, fusionner } from "./memo.mjs";

test("la clé identifie un board", () => {
  assert.equal(cle("lever", "contentsquare"), "lever:contentsquare");
});

test("la date est au mois", () => {
  assert.equal(mois(new Date("2026-08-04T12:00:00Z")), "2026-08");
  assert.equal(mois(new Date("2026-01-31T23:00:00Z")), "2026-01");
});

// La TTL s'exprime en mois parce que le mémo date au mois : une durée en jours
// n'y serait pas calculable.
test("le mois courant et le précédent sont frais, le reste est périmé", () => {
  const d = new Date("2026-08-04T12:00:00Z");
  assert.equal(estFrais("2026-08", d), true);
  assert.equal(estFrais("2026-07", d), true);
  assert.equal(estFrais("2026-06", d), false);
  assert.equal(estFrais(undefined, d), false);
});

test("le passage de janvier remonte à décembre de l'année précédente", () => {
  const d = new Date("2026-01-15T12:00:00Z");
  assert.equal(estFrais("2025-12", d), true);
  assert.equal(estFrais("2025-11", d), false);
});

// La source A ne connaît que le slug : ni Ashby, ni Lever, ni Greenhouse
// n'exposent le nom de l'entreprise (vérifié le 04/08/2026).
test("le nom se déduit du slug faute de mieux", () => {
  assert.equal(nomDepuisSlug("contentsquare"), "Contentsquare");
  assert.equal(nomDepuisSlug("loft-orbital"), "Loft Orbital");
  assert.equal(nomDepuisSlug("on-running-fr"), "On Running Fr");
});

test("l'index est trié par nom puis par ats", () => {
  const t = trierIndex([
    { nom: "Zeta", ats: "lever", slug: "zeta" },
    { nom: "Alpha", ats: "lever", slug: "alpha" },
    { nom: "Alpha", ats: "ashby", slug: "alpha" },
  ]);
  assert.deepEqual(t.map((e) => `${e.nom}/${e.ats}`), ["Alpha/ashby", "Alpha/lever", "Zeta/lever"]);
});

test("le mémo est trié par clé", () => {
  const t = trierMemo([{ cle: "lever:b" }, { cle: "ashby:a" }]);
  assert.deepEqual(t.map((e) => e.cle), ["ashby:a", "lever:b"]);
});

test("fusionner ajoute les nouveaux boards", () => {
  const r = fusionner([], [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 192, siren: "602036444", vuLe: "2026-08" }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].offresFR, 192);
});

test("fusionner met à jour un board déjà connu", () => {
  const ancien = [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 100, siren: null, vuLe: "2026-06" }];
  const r = fusionner(ancien, [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 192, siren: "602036444", vuLe: "2026-08" }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].offresFR, 192);
  assert.equal(r[0].siren, "602036444");
});

// Un board retombé à zéro sort de l'index — mais seulement parce qu'on l'a
// CONSTATÉ. Un `null` n'arrive jamais jusqu'ici (voir ats.mjs).
test("fusionner retire un board tombé à zéro", () => {
  const ancien = [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 100, siren: null, vuLe: "2026-06" }];
  const r = fusionner(ancien, [{ nom: "Accor", ats: "smartrecruiters", slug: "accor", offresFR: 0, siren: null, vuLe: "2026-08" }]);
  assert.deepEqual(r, []);
});

test("fusionner laisse intactes les entrées non retestées", () => {
  const ancien = [{ nom: "Swile", ats: "lever", slug: "swile", offresFR: 7, siren: null, vuLe: "2026-06" }];
  const r = fusionner(ancien, []);
  assert.deepEqual(r, ancien);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/memo.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/memo.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/memo.mjs` :

```js
// L'index et le mémo : deux fichiers, deux rôles opposés.
//
//   boards-fr.json        les boards ayant >= 1 offre française. Lu par l'app.
//                         Doit rester un diff lisible.
//   boards-fr-testes.json tout ce qui a été essayé, succès ET échecs. Lu par
//                         ce script seul. Sans lui, l'incrémental n'existe pas.

/** Identité stable d'un board. */
export function cle(ats, slug) {
  return `${ats}:${slug}`;
}

/** Date au mois, « 2026-08 ». */
export function mois(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Une entrée est fraîche si elle date du mois courant ou du précédent.
 *
 * La TTL s'exprime en mois parce que le mémo date au mois : à raison d'un
 * passage hebdomadaire, une date au jour ferait bouger un quart des ~30 000
 * lignes à chaque exécution. L'ancienneté réelle tolérée oscille donc entre 30
 * et 60 jours — sans conséquence, un ATS ne change pas en huit semaines.
 */
export function estFrais(vuLe, date) {
  if (!vuLe) return false;
  const precedent = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return vuLe === mois(date) || vuLe === mois(precedent);
}

/**
 * Nom d'affichage déduit du slug.
 *
 * La source A ne dispose de rien d'autre : vérifié le 04/08/2026, la racine
 * Ashby ne porte que { jobs, apiVersion } et aucune offre Lever ou Greenhouse ne
 * contient de champ entreprise. C'est une étiquette imparfaite et assumée ; la
 * source B l'écrase par la raison sociale SIRENE quand elle retrouve le board.
 */
export function nomDepuisSlug(slug) {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(" ");
}

/** Tri par nom puis par ats — le second critère rend l'ordre déterministe. */
export function trierIndex(entrees) {
  return [...entrees].sort(
    (a, b) => a.nom.localeCompare(b.nom, "fr") || a.ats.localeCompare(b.ats),
  );
}

export function trierMemo(entrees) {
  return [...entrees].sort((a, b) => a.cle.localeCompare(b.cle));
}

/**
 * Applique les constats d'un passage à l'index existant.
 *
 * `trouvailles` ne contient que des boards RÉELLEMENT testés avec une réponse
 * exploitable — jamais un `null` de `compterFR`. Une entrée absente des
 * trouvailles n'a pas été retestée : on la laisse telle quelle.
 */
export function fusionner(index, trouvailles) {
  const parCle = new Map(index.map((e) => [cle(e.ats, e.slug), e]));

  for (const t of trouvailles) {
    const k = cle(t.ats, t.slug);
    if (t.offresFR > 0) {
      const ancien = parCle.get(k);
      parCle.set(k, { ...ancien, ...t, siren: t.siren ?? ancien?.siren ?? null });
    } else {
      parCle.delete(k);
    }
  }

  return trierIndex([...parCle.values()]);
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/memo.test.mjs"
```

Attendu : `# pass 11`, `# fail 0`.

- [ ] **Step 5 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 6 : commit**

```bash
git add scripts/boards/memo.mjs scripts/boards/memo.test.mjs
git commit -m "feat(boards): index, mémo des tests et TTL mensuelle"
```

- [ ] **Step 7 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 5 : énumérer les slugs et les entreprises françaises

**Files:**
- Create: `scripts/boards/sources.mjs`
- Create: `scripts/boards/sources.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `LISTES: Record<string, string>`, `TRANCHES: string[]`,
  `slugsDesListes(fetchImpl?): Promise<{ats, slug}[]>`,
  `entreprisesFrancaises(fetchImpl?, tranches?): Promise<{nom, siren}[]>`.

**Les deux sources de découverte.** La source A balaie 15 862 slugs publics et
rend 0,7 à 2,7 % de boards français — 98 % de ces boards sont américains. La
source B part des entreprises françaises et atteint SmartRecruiters, absent des
listes publiques et sans API d'énumération.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `scripts/boards/sources.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { LISTES, TRANCHES, slugsDesListes, entreprisesFrancaises } from "./sources.mjs";

test("les trois listes publiques sont déclarées, sans SmartRecruiters", () => {
  assert.deepEqual(Object.keys(LISTES).sort(), ["ashby", "greenhouse", "lever"]);
});

test("les sept tranches d'effectif sont déclarées", () => {
  assert.deepEqual(TRANCHES, ["31", "32", "41", "42", "51", "52", "53"]);
});

test("les listes sont aplaties en couples ats+slug", async () => {
  const f = async (url) => {
    const u = String(url);
    if (u.includes("greenhouse_companies")) return Response.json(["acme", "beta"]);
    if (u.includes("lever_companies")) return Response.json(["gamma"]);
    return Response.json([]);
  };
  const r = await slugsDesListes(f);
  assert.deepEqual(r.sort((a, b) => a.slug.localeCompare(b.slug)), [
    { ats: "greenhouse", slug: "acme" },
    { ats: "greenhouse", slug: "beta" },
    { ats: "lever", slug: "gamma" },
  ]);
});

// Les fichiers publics mêlent tableaux de chaînes et tableaux d'objets.
test("les listes d'objets sont acceptées comme les listes de chaînes", async () => {
  const f = async (url) => {
    if (String(url).includes("ashby_companies")) return Response.json([{ slug: "alan" }, { name: "swile" }]);
    return Response.json([]);
  };
  assert.deepEqual(await slugsDesListes(f), [{ ats: "ashby", slug: "alan" }, { ats: "ashby", slug: "swile" }]);
});

test("une liste en panne ne fait pas tomber les autres", async () => {
  const f = async (url) => {
    if (String(url).includes("greenhouse_companies")) throw new Error("ECONNRESET");
    if (String(url).includes("lever_companies")) return Response.json(["gamma"]);
    return Response.json([]);
  };
  assert.deepEqual(await slugsDesListes(f), [{ ats: "lever", slug: "gamma" }]);
});

// `per_page` est plafonné à 25 par l'API : la pagination est obligatoire.
test("SIRENE est paginé jusqu'à épuisement", async () => {
  const pages = {
    1: { results: [{ nom_complet: "ALPHA", siren: "1" }, { nom_complet: "BETA", siren: "2" }], total_pages: 2 },
    2: { results: [{ nom_complet: "GAMMA", siren: "3" }], total_pages: 2 },
  };
  const f = async (url) => {
    const p = new URL(String(url)).searchParams.get("page");
    return Response.json(pages[p] ?? { results: [], total_pages: 2 });
  };
  const r = await entreprisesFrancaises(f, ["53"]);
  assert.deepEqual(r, [
    { nom: "ALPHA", siren: "1" },
    { nom: "BETA", siren: "2" },
    { nom: "GAMMA", siren: "3" },
  ]);
});

test("une tranche en panne ne fait pas tomber les autres", async () => {
  const f = async (url) => {
    const t = new URL(String(url)).searchParams.get("tranche_effectif_salarie");
    if (t === "52") throw new Error("ECONNRESET");
    return Response.json({ results: [{ nom_complet: "ALPHA", siren: "1" }], total_pages: 1 });
  };
  assert.deepEqual(await entreprisesFrancaises(f, ["52", "53"]), [{ nom: "ALPHA", siren: "1" }]);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/sources.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/sources.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/sources.mjs` :

```js
// Les deux sources de découverte de boards.
//
// A — les listes de slugs publiques (Common Crawl, via Feashliaa/job-board-aggregator).
//     Rendement français mesuré le 04/08/2026 sur 450 boards : greenhouse 2,0 %,
//     lever 2,7 %, ashby 0,7 %. Faible, parce que 98 % de ces boards sont
//     américains — mais le balayage complet coûte 1,6 Go et 5 minutes.
//
// B — les entreprises françaises de la base SIRENE. Seule voie vers
//     SmartRecruiters, qui n'a ni liste publique ni API d'énumération.
//
// ⚠️ Licence des listes de la source A : CC BY-NC 4.0, usage non commercial.
// Le jour d'une exploitation commerciale, cette source devra être remplacée par
// une régénération maison depuis Common Crawl. Tout est isolé dans
// `slugsDesListes` pour que ce remplacement ne touche rien d'autre.

const BASE_LISTES = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";

/** Pas de smartrecruiters : le répertoire `data/` du dépôt n'en contient pas. */
export const LISTES = {
  greenhouse: `${BASE_LISTES}/greenhouse_companies.json`,
  lever: `${BASE_LISTES}/lever_companies.json`,
  ashby: `${BASE_LISTES}/ashby_companies.json`,
};

/**
 * Tranches d'effectif INSEE retenues, de 200 salariés et plus. Comptes relevés
 * le 04/08/2026 : 3 125 + 6 007 + 2 952 + 1 473 + 831 + 174 + 89 = 14 651
 * entreprises actives.
 *
 * Les tranches 21 (50–99) et 22 (100–199) dépassent le plafond de pagination de
 * 10 000 résultats et exigeraient un découpage par département : hors périmètre.
 */
export const TRANCHES = ["31", "32", "41", "42", "51", "52", "53"];

const SIRENE = "https://recherche-entreprises.api.gouv.fr/search";

/** L'API refuse toute valeur supérieure. 14 651 entreprises = 587 pages. */
const PAR_PAGE = 25;

const TIMEOUT_MS = 15_000;

/** Un fichier de liste est soit un tableau de chaînes, soit un tableau d'objets. */
function extraireSlugs(brut) {
  const arr = Array.isArray(brut) ? brut : (brut?.companies ?? []);
  return arr
    .map((e) => (typeof e === "string" ? e : e?.slug ?? e?.name ?? e?.id ?? ""))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/** Tous les couples { ats, slug } des listes publiques. Une liste en panne est ignorée. */
export async function slugsDesListes(fetchImpl = fetch) {
  const out = [];

  for (const [ats, url] of Object.entries(LISTES)) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      for (const slug of extraireSlugs(await res.json())) out.push({ ats, slug });
    } catch {
      // Liste injoignable : les autres doivent quand même servir.
      console.warn(`Liste ${ats} injoignable, ignorée.`);
    }
  }

  return out;
}

/** Toutes les entreprises actives des tranches demandées. Une tranche en panne est ignorée. */
export async function entreprisesFrancaises(fetchImpl = fetch, tranches = TRANCHES) {
  const out = [];

  for (const tranche of tranches) {
    let page = 1;
    let total = 1;

    try {
      while (page <= total) {
        const url = `${SIRENE}?tranche_effectif_salarie=${tranche}&etat_administratif=A`
          + `&per_page=${PAR_PAGE}&page=${page}`;
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) break;

        const corps = await res.json();
        total = Number(corps?.total_pages ?? 1);
        for (const e of corps?.results ?? []) {
          if (e?.nom_complet) out.push({ nom: e.nom_complet, siren: String(e.siren ?? "") });
        }
        page += 1;
      }
    } catch {
      console.warn(`Tranche ${tranche} interrompue, on passe à la suivante.`);
    }
  }

  return out;
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/sources.test.mjs"
```

Attendu : `# pass 7`, `# fail 0`.

- [ ] **Step 5 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 6 : commit**

```bash
git add scripts/boards/sources.mjs scripts/boards/sources.test.mjs
git commit -m "feat(boards): énumération des listes publiques et des entreprises SIRENE"
```

- [ ] **Step 7 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 6 : l'orchestrateur, et le premier index réel (source A)

**Files:**
- Create: `scripts/boards/lot.mjs`
- Create: `scripts/boards/lot.test.mjs`
- Create: `scripts/build-boards-fr.mjs`
- Create: `web/src/lib/jobs/data/boards-fr.json` (produit par l'exécution)
- Create: `web/src/lib/jobs/data/boards-fr-testes.json` (produit par l'exécution)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: les deux fichiers de données, et une CLI
  `node scripts/build-boards-fr.mjs [--source=a|b|tout] [--complet]`.

- [ ] **Step 1 : écrire le test du plafond de concurrence**

Créer `scripts/boards/lot.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { enLot } from "./lot.mjs";

test("traite tous les éléments", async () => {
  const r = await enLot([1, 2, 3, 4, 5], 2, async (n) => n * 2);
  assert.deepEqual([...r].sort((a, b) => a - b), [2, 4, 6, 8, 10]);
});

// Ces APIs sont publiques et gratuites : dépasser le plafond risquerait un
// bannissement d'IP qui coûterait la brique entière.
test("ne dépasse jamais le plafond de tâches simultanées", async () => {
  let enCours = 0;
  let maxVu = 0;
  await enLot(Array.from({ length: 30 }, (_, i) => i), 4, async () => {
    enCours += 1;
    maxVu = Math.max(maxVu, enCours);
    await new Promise((r) => setTimeout(r, 5));
    enCours -= 1;
  });
  assert.ok(maxVu <= 4, `${maxVu} tâches simultanées, plafond 4`);
});

test("une tâche qui jette n'emporte pas le lot", async () => {
  const r = await enLot([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error("boum");
    return n;
  });
  assert.deepEqual([...r].filter((x) => x !== null).sort(), [1, 3]);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/lot.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/lot.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/lot.mjs` :

```js
/**
 * Exécute `travail` sur chaque élément, au plus `plafond` à la fois.
 *
 * Une tâche qui jette rend `null` plutôt que d'emporter le lot : un balayage de
 * 15 000 boards ne doit pas s'arrêter au premier serveur grognon.
 */
export async function enLot(items, plafond, travail) {
  const resultats = new Array(items.length).fill(null);
  let curseur = 0;

  const ouvrier = async () => {
    while (curseur < items.length) {
      const i = curseur++;
      try {
        resultats[i] = await travail(items[i], i);
      } catch {
        resultats[i] = null;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(plafond, items.length) }, ouvrier));
  return resultats;
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/lot.test.mjs"
```

Attendu : `# pass 3`, `# fail 0`.

- [ ] **Step 5 : écrire l'orchestrateur**

Créer `scripts/build-boards-fr.mjs` :

```js
// Construit l'index des boards ATS ayant au moins une offre en France.
//
// Usage : node scripts/build-boards-fr.mjs [--source=a|b|tout] [--complet]
//   --source=a      les listes de slugs publiques seulement (~5 min)
//   --source=b      les entreprises françaises SIRENE seulement (~20-40 min)
//   --source=tout   les deux (défaut)
//   --complet       ignore la TTL et reteste tout
//
// Produit : web/src/lib/jobs/data/boards-fr.json et boards-fr-testes.json
//
// ⚠️ Un `null` de compterFR n'est JAMAIS écrit : il signifie « on ne sait pas »
// (réseau, 5xx), et en conclure quoi que ce soit viderait l'index au premier
// incident réseau — commité, qui plus est.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ATS, compterFR } from "./boards/ats.mjs";
import { slugsCandidats } from "./boards/slugs.mjs";
import { slugsDesListes, entreprisesFrancaises } from "./boards/sources.mjs";
import { enLot } from "./boards/lot.mjs";
import { cle, mois, estFrais, nomDepuisSlug, trierMemo, fusionner } from "./boards/memo.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_INDEX = join(OUT_DIR, "boards-fr.json");
const F_MEMO = join(OUT_DIR, "boards-fr-testes.json");

const PLAFOND = 12;

const args = process.argv.slice(2);
const complet = args.includes("--complet");
const source = (args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "tout");

const maintenant = new Date();
const moisCourant = mois(maintenant);

function lire(chemin) {
  if (!existsSync(chemin)) return [];
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    console.warn(`${chemin} illisible, on repart de zéro.`);
    return [];
  }
}

const index = lire(F_INDEX);
const memo = lire(F_MEMO);
const memoParCle = new Map(memo.map((e) => [e.cle, e]));

/** Un couple ats+slug mérite-t-il d'être testé maintenant ? */
function aTester(ats, slug) {
  if (complet) return true;
  return !estFrais(memoParCle.get(cle(ats, slug))?.vuLe, maintenant);
}

/** Teste un couple et renvoie une trouvaille, ou null si la réponse est inexploitable. */
async function tester({ ats, slug, nom, siren }) {
  const n = await compterFR(ats, slug);
  if (n === null) return null;
  return {
    nom: nom ?? nomDepuisSlug(slug),
    ats,
    slug,
    offresFR: n,
    siren: siren ?? null,
    vuLe: moisCourant,
  };
}

const cibles = [];

// --- Source A : les listes publiques (pas de SmartRecruiters, il n'en existe pas)
if (source === "a" || source === "tout") {
  const couples = await slugsDesListes();
  console.log(`Source A : ${couples.length} slugs dans les listes publiques.`);
  for (const c of couples) if (aTester(c.ats, c.slug)) cibles.push(c);
}

// --- Source B : les entreprises françaises, contre les quatre ATS
if (source === "b" || source === "tout") {
  const entreprises = await entreprisesFrancaises();
  console.log(`Source B : ${entreprises.length} entreprises françaises.`);
  for (const e of entreprises) {
    for (const slug of slugsCandidats(e.nom)) {
      for (const ats of ATS) {
        if (aTester(ats, slug)) cibles.push({ ats, slug, nom: e.nom, siren: e.siren });
      }
    }
  }
}

console.log(`${cibles.length} couples à tester (${memo.length} déjà en mémoire).`);

const brut = await enLot(cibles, PLAFOND, tester);
const trouvailles = brut.filter(Boolean);

console.log(`${trouvailles.length} réponses exploitables, ${brut.length - trouvailles.length} indéterminées.`);

// L'index ne retient que les succès ; le mémo retient tout, échecs compris.
const nouvelIndex = fusionner(index, trouvailles);
for (const t of trouvailles) {
  memoParCle.set(cle(t.ats, t.slug), { cle: cle(t.ats, t.slug), offresFR: t.offresFR, vuLe: t.vuLe });
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(F_INDEX, `${JSON.stringify(nouvelIndex, null, 2)}\n`, "utf8");
writeFileSync(F_MEMO, `${JSON.stringify(trierMemo([...memoParCle.values()]), null, 2)}\n`, "utf8");

const offres = nouvelIndex.reduce((n, e) => n + e.offresFR, 0);
console.log(`OK — ${nouvelIndex.length} boards français, ${offres} offres FR, ${memoParCle.size} couples en mémoire.`);
```

- [ ] **Step 6 : exécuter la source A pour de vrai**

```bash
node scripts/build-boards-fr.mjs --source=a
```

Attendu : environ 5 minutes, puis une ligne `OK — N boards français, M offres FR, …`
avec **N > 0**. D'après le sondage du 04/08/2026, N devrait se situer autour de
200 à 400. Si N vaut 0, ne pas commiter : la chaîne est cassée, s'arrêter et
signaler.

- [ ] **Step 7 : vérifier la forme du fichier produit**

```bash
node -e "const a=require('./web/src/lib/jobs/data/boards-fr.json');console.log(a.length,'entrées');console.log(JSON.stringify(a.slice(0,3),null,2))"
```

Attendu : trois entrées complètes, avec `nom`, `ats`, `slug`, `offresFR` ≥ 1,
`siren: null` (la source A n'en connaît pas) et `vuLe` au format `AAAA-MM`.

- [ ] **Step 8 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 9 : commit**

```bash
git add scripts/boards/lot.mjs scripts/boards/lot.test.mjs scripts/build-boards-fr.mjs web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json
git commit -m "feat(boards): orchestrateur et premier index issu des listes publiques"
```

- [ ] **Step 10 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`, **en
inscrivant les chiffres réels** de l'exécution (nombre de boards, d'offres FR,
durée).

---

## Task 7 : test de cohérence de l'index et intégration CI

**Files:**
- Create: `web/src/lib/jobs/data/boards-fr.test.ts`
- Modify: `.github/workflows/web.yml` (étape « Tests des scripts de la boucle »)

**Interfaces:**
- Consumes: `web/src/lib/jobs/data/boards-fr.json` produit en Task 6.
- Produces: rien.

Le projet ne teste pas ses scripts de build ; il teste la **cohérence du fichier
produit** — c'est ce que fait `rome-data.test.ts`, dans le même répertoire. Même
convention ici. Le mémo, lui, n'est pas testé : rien ne le lit hors du script,
et le perdre ne coûte qu'un balayage.

- [ ] **Step 1 : écrire le test**

Créer `web/src/lib/jobs/data/boards-fr.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import boards from "./boards-fr.json";

const ATS_CONNUS = ["greenhouse", "lever", "ashby", "smartrecruiters"];

type Entree = {
  nom: string;
  ats: string;
  slug: string;
  offresFR: number;
  siren: string | null;
  vuLe: string;
};

const index = boards as Entree[];

describe("index des boards français", () => {
  it("n'est pas vide", () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it("expose les six champs sur chaque entrée", () => {
    for (const e of index) {
      expect(typeof e.nom, `nom de ${e.slug}`).toBe("string");
      expect(e.nom.length, `nom vide pour ${e.slug}`).toBeGreaterThan(0);
      expect(typeof e.slug).toBe("string");
      expect(ATS_CONNUS, `ats inconnu pour ${e.slug}`).toContain(e.ats);
      expect(e.siren === null || typeof e.siren === "string").toBe(true);
      expect(e.vuLe, `date mal formée pour ${e.slug}`).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  // Un zéro dans l'index est le symptôme d'une suppression manquée (spec §5) :
  // ce fichier ne doit contenir que des boards qui mènent quelque part.
  it("ne contient aucun board sans offre française", () => {
    for (const e of index) {
      expect(Number.isInteger(e.offresFR), `offresFR non entier pour ${e.slug}`).toBe(true);
      expect(e.offresFR, `${e.slug} est dans l'index avec 0 offre`).toBeGreaterThanOrEqual(1);
    }
  });

  it("ne contient aucun doublon ats+slug", () => {
    const cles = index.map((e) => `${e.ats}:${e.slug}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  // L'ordre doit être déterministe, sinon chaque rafraîchissement produit un
  // diff illisible et la contrainte globale tombe.
  it("est trié par nom puis par ats", () => {
    const attendu = [...index].sort(
      (a, b) => a.nom.localeCompare(b.nom, "fr") || a.ats.localeCompare(b.ats),
    );
    expect(index.map((e) => `${e.nom}/${e.ats}`)).toEqual(attendu.map((e) => `${e.nom}/${e.ats}`));
  });
});
```

- [ ] **Step 2 : lancer le test**

Depuis `web/` :

```bash
npx vitest run src/lib/jobs/data/boards-fr.test.ts
```

Attendu : PASS, 5 tests. Si « n'est pas vide » échoue, c'est que la Task 6 n'a
rien produit — revenir à la Task 6 plutôt que d'assouplir le test.

- [ ] **Step 3 : brancher les tests de script sur la CI**

Dans `.github/workflows/web.yml`, remplacer l'étape existante :

```yaml
      - name: Tests des scripts de la boucle
        working-directory: .
        run: node --test "boucle/bin/*.test.mjs"
```

par :

```yaml
      - name: Tests des scripts de la boucle
        working-directory: .
        run: node --test "boucle/bin/*.test.mjs"

      - name: Tests des scripts de l'index des boards
        working-directory: .
        run: node --test "scripts/boards/*.test.mjs"
```

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 4 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/jobs/data/boards-fr.test.ts .github/workflows/web.yml
git commit -m "test(boards): cohérence de l'index et tests de script en CI"
```

- [ ] **Step 6 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 8 : la source B, le rafraîchissement hebdomadaire et la documentation

**Files:**
- Create: `.github/workflows/boards-fr.yml`
- Modify: `web/src/lib/jobs/data/boards-fr.json` (enrichi par l'exécution)
- Modify: `web/src/lib/jobs/data/boards-fr-testes.json` (enrichi par l'exécution)
- Modify: `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md` (section « Réserves »)
- Modify: `PROJECT_INDEX.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien de nouveau.

- [ ] **Step 1 : exécuter la source B pour de vrai**

```bash
node scripts/build-boards-fr.mjs --source=b
```

Attendu : 20 à 40 minutes. La sortie annonce d'abord `Source B : N entreprises
françaises.` avec N proche de 14 651, puis se termine sur `OK — …`. Le nombre de
boards doit être **supérieur ou égal** à celui de la Task 6, et l'index doit
désormais contenir des entrées `smartrecruiters` — c'est le seul chemin qui y
mène, et donc le signe que la source B a réellement fonctionné.

- [ ] **Step 2 : vérifier que SmartRecruiters est bien apparu**

```bash
node -e "const a=require('./web/src/lib/jobs/data/boards-fr.json');const p={};for(const e of a)p[e.ats]=(p[e.ats]||0)+1;console.log(p);console.log('avec SIREN :',a.filter(e=>e.siren).length)"
```

Attendu : un décompte par ATS incluant `smartrecruiters`, et un nombre non nul
d'entrées portant un SIREN. Si `smartrecruiters` est absent, ne pas commiter :
s'arrêter et signaler.

- [ ] **Step 3 : inscrire les chiffres réels dans la spec**

Dans `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`, section
`## Réserves`, remplacer le paragraphe qui commence par
`**Le rendement de la source B est une extrapolation, pas une mesure.**` par le
rendement **réellement constaté** : nombre d'entreprises testées, nombre de
boards trouvés, pourcentage, et répartition par ATS. Ne rien changer d'autre
dans ce fichier.

- [ ] **Step 4 : écrire le workflow hebdomadaire**

Créer `.github/workflows/boards-fr.yml` :

```yaml
name: Index des boards français

on:
  schedule:
    # Lundi 03:00 UTC. Hebdomadaire : c'est l'index des boards, pas les offres —
    # une entreprise ne change pas d'ATS en une semaine.
    - cron: "0 3 * * 1"
  workflow_dispatch:

# Même groupe que la boucle autonome : les deux workflows commitent sur `main`,
# et sans ce verrou partagé un push simultané échoue ou écrase.
concurrency:
  group: boucle-autonome
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  index:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.LOOP_GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Tests des modules de l'index
        run: node --test "scripts/boards/*.test.mjs"

      - name: Rafraîchir l'index
        run: node scripts/build-boards-fr.mjs --source=tout

      - name: Commiter si l'index a changé
        run: |
          if git diff --quiet -- web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json; then
            echo "Aucun changement."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json
          git commit -m "chore(boards): rafraîchissement hebdomadaire de l'index"
          git pull --rebase
          git push
```

- [ ] **Step 5 : documenter la brique**

Dans `PROJECT_INDEX.md`, juste **après** le paragraphe existant :

> Le référentiel ROME 4.0 est embarqué (`lib/jobs/data/`, régénérable par
> `scripts/build-rome.mjs`). Le code ROME sert surtout de filtre anti-bruit.

insérer un paragraphe décrivant la nouvelle brique. Il doit dire, en trois à
cinq phrases : que `web/src/lib/jobs/data/boards-fr.json` liste les entreprises
dont le board ATS public a au moins une offre en France ; qu'il est régénérable
par `node scripts/build-boards-fr.mjs` et rafraîchi chaque lundi par
`.github/workflows/boards-fr.yml` ; que `boards-fr-testes.json` est la mémoire
des couples déjà testés et que rien d'autre ne le lit ; et que **la brique 2 —
moisser les offres depuis ces boards et les afficher dans « Offres » — n'est pas
faite**, l'index ne servant encore à rien dans l'app. Renvoyer vers
`docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`.

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 6 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 7 : commit**

```bash
git add .github/workflows/boards-fr.yml web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json docs/superpowers/specs/2026-08-04-marche-cache-index-design.md PROJECT_INDEX.md
git commit -m "feat(boards): source SIRENE, rafraîchissement hebdomadaire et documentation"
```

- [ ] **Step 8 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`, avec les
chiffres réels, et mettre à jour « Prochaine étape suggérée » vers la brique 2
(moisson des offres depuis les boards indexés).

---

## Rappel de fin de plan

- **Aucun `git push`** n'est fait par l'agent d'exécution, à aucune task. Le
  workflow de la Task 8 pousse depuis GitHub Actions, ce qui est différent : il
  ne s'exécute que lorsque l'humain aura poussé le dépôt.
- Le rapport final suit le format imposé par `web/CADRAGE_EXECUTION.md` §5, une
  section par task.

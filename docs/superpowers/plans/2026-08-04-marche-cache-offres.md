# Marché caché — Brique 2 : moissonner les offres — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** faire apparaître les offres des 448 boards de `boards-fr.json` dans
l'onglet « Offres », comme une quatrième source (« Marché caché ») au même
titre que France Travail, Adzuna et JSearch.

**Architecture :** un harvest léger hebdomadaire (script `.mjs`, même patron
que Brique 1) produit un index d'offres SANS texte, committé. Au moment d'une
recherche, le texte complet n'est récupéré en direct que pour les offres dont
le titre matche déjà les mots-clés du profil. Détail des décisions et des
champs réels vérifiés en direct le 04/08/2026 :
`docs/superpowers/specs/2026-08-04-marche-cache-offres-design.md`.

**Tech Stack :** identique à Brique 1 côté script (Node 22 ESM, `fetch`
natif, `node --test`), plus TypeScript/Vitest côté app pour le nouveau module
source `web/src/lib/jobs/boardsFr.ts`, calqué sur `adzuna.ts`.

**Contrat d'exécution :** `web/CADRAGE_EXECUTION.md` — à lire en entier avant
la première ligne de code. **PUSH STRICTEMENT INTERDIT.**

## Global Constraints

- **Aucune dépendance npm ajoutée ou mise à jour.**
- Aucun secret : les quatre ATS restent publics et sans clé, comme en Brique 1.
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.**
- `null` gardé le même sens qu'en Brique 1 : « on ne sait pas » (réseau, 5xx,
  JSON illisible) — jamais confondu avec une liste vide.
- Le plafond de 60 offres à texte complet par recherche (spec §6) est un
  nombre de départ, pas mesuré sur un usage réel — ne pas le retirer, mais ne
  pas non plus le durcir sans le signaler dans le rapport final.
- Commentaires et identifiants en français dans `scripts/boards/` (suite de
  `scripts/build-rome.mjs`) ; TypeScript/anglais technique standard du reste
  de `web/src/lib/jobs/` (suite de `adzuna.ts`, `dedupe.ts`…).

## Protocole de vérification (après CHAQUE task)

Depuis la racine :

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

Une vérification rouge = task NON LIVRÉE.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `scripts/boards/offres.mjs` | lister les offres FR légères d'un board (sans texte) |
| `scripts/build-boards-offres.mjs` | orchestration, produit `boards-offres.json` |
| `web/src/lib/jobs/data/boards-offres.json` | l'index léger des offres — produit, committé |
| `web/src/lib/jobs/data/boards-offres.test.ts` | cohérence du fichier produit (Vitest) |
| `.github/workflows/boards-fr.yml` | ajout d'une étape de harvest léger |
| `web/src/lib/jobs/boardsFr.ts` | quatrième source : `searchBoards(profile)` |
| `web/src/lib/jobs/boardsFr.test.ts` | tests unitaires (fauxFetch) |
| `web/src/lib/jobs/offer.ts` | `SourceId` +`"boards"` |
| `web/src/lib/jobs/sources.ts` | `SOURCES`/`DEFAULT_SOURCES` +`"boards"` |
| `web/src/lib/jobs/dedupe.ts` | `PRIORITY` +`"boards"` |
| `web/src/app/api/jobs/search/route.ts` | runner `boards` |
| `web/src/components/jobs/JobsView.tsx` | groupe de scan dédié |
| `web/src/components/jobs/SourcePicker.tsx` | `SOURCE_DOMAIN.boards` |

---

## Task 1 : lister les offres françaises légères d'un board

**Files:**
- Create: `scripts/boards/offres.mjs`
- Create: `scripts/boards/offres.test.mjs`

**Interfaces:**
- Consumes: `estFrancais(lieu, paysIso)` de `./france.mjs`.
- Produces: `listerOffresFR(ats, slug, fetchImpl?): Promise<OffreLegere[] | null>`.

**Pourquoi un module séparé d'`ats.mjs`.** `ats.mjs` (Brique 1) ne fait que
COMPTER (`compterFR`) et reste tel quel — déjà testé, déjà utilisé chaque
lundi pour rafraîchir `boards-fr.json`. Ce module LISTE (titre, url, date par
offre) : les deux responsabilités divergent assez pour ne pas forcer un
partage d'abstraction, et toucher `ats.mjs` risquerait une régression sur un
module qui fonctionne déjà en production.

**Champs vérifiés en direct le 04/08/2026** (voir design spec §3) :

| ATS | id | titre | lieu | url | date |
|---|---|---|---|---|---|
| Greenhouse | `id` | `title` | `location.name` | `absolute_url` | `updated_at` (ISO) |
| Lever | `id` | `text` | `categories.location` | `hostedUrl` | `createdAt` (**epoch ms**) |
| Ashby | `id` | `title` | `location` | `jobUrl` | `publishedAt` (ISO) |
| SmartRecruiters | `id` | `name` | `location.fullLocation` | *(construite)* | `releasedDate` (ISO) |

SmartRecruiters n'a pas d'URL publique dans la liste : `https://jobs.smartrecruiters.com/{slug}/{id}`
a été vérifiée en direct (curl, code 200) et remplace `ref` (URL d'API, pas
une page candidat). SmartRecruiters expose aussi des coordonnées
(`location.latitude`/`longitude`, en chaînes) — repris quand présents et
numériques, aucun autre ATS ne les donne.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `scripts/boards/offres.test.mjs` :

```js
import test from "node:test";
import assert from "node:assert/strict";
import { listerOffresFR } from "./offres.mjs";

/** `fetch` factice : une réponse par fragment d'URL, 404 pour tout le reste. */
function fauxFetch(reponses) {
  return async (url) => {
    const u = String(url);
    const cle = Object.keys(reponses).find((k) => u.includes(k));
    if (!cle) return new Response("", { status: 404 });
    const r = reponses[cle];
    if (typeof r === "number") return new Response("", { status: r });
    if (typeof r === "function") return r(u);
    return new Response(JSON.stringify(r), { status: 200 });
  };
}

test("Greenhouse : mappe id/titre/lieu/url/date, filtre la France", async () => {
  const f = fauxFetch({
    "boards-api.greenhouse.io": {
      jobs: [
        { id: 111, title: "Ingénieur Logiciel", location: { name: "Paris" }, absolute_url: "https://boards.greenhouse.io/onrunning/jobs/111", updated_at: "2026-07-31T20:18:06-04:00" },
        { id: 222, title: "Engineer", location: { name: "Berlin, Berlin, Germany" }, absolute_url: "https://boards.greenhouse.io/onrunning/jobs/222", updated_at: "2026-07-31T20:18:06-04:00" },
      ],
    },
  });
  const r = await listerOffresFR("greenhouse", "onrunning", f);
  assert.equal(r.length, 1);
  assert.deepEqual(
    { id: r[0].id, titre: r[0].titre, lieu: r[0].lieu, url: r[0].url },
    { id: "111", titre: "Ingénieur Logiciel", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/111" },
  );
  assert.equal(r[0].publieLe, new Date("2026-07-31T20:18:06-04:00").toISOString());
});

test("Lever : text→titre, hostedUrl→url, createdAt (epoch ms)→ISO, country prime", async () => {
  const f = fauxFetch({
    "api.lever.co": [
      { id: "abc", text: "Product Manager", categories: { location: "Paris Area, France" }, country: "FR", hostedUrl: "https://jobs.lever.co/contentsquare/abc", createdAt: 1784812558213 },
      { id: "def", text: "Manager", categories: { location: "Riyadh" }, country: "SA", hostedUrl: "https://jobs.lever.co/contentsquare/def", createdAt: 1784812558213 },
    ],
  });
  const r = await listerOffresFR("lever", "contentsquare", f);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "abc");
  assert.equal(r[0].url, "https://jobs.lever.co/contentsquare/abc");
  assert.equal(r[0].publieLe, new Date(1784812558213).toISOString());
});

test("Ashby : mappe id/title/location/jobUrl/publishedAt", async () => {
  const f = fauxFetch({
    "api.ashbyhq.com": { jobs: [
      { id: "xyz", title: "CTO Founder Associate", location: "Paris, France", jobUrl: "https://jobs.ashbyhq.com/alan/xyz", publishedAt: "2026-08-03T08:33:52.099+00:00" },
      { id: "uvw", title: "Support", location: "Madrid, Spain", jobUrl: "https://jobs.ashbyhq.com/alan/uvw", publishedAt: "2026-08-03T08:33:52.099+00:00" },
    ] },
  });
  const r = await listerOffresFR("ashby", "alan", f);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "xyz");
  assert.equal(r[0].url, "https://jobs.ashbyhq.com/alan/xyz");
});

test("SmartRecruiters : URL construite (jobs.smartrecruiters.com), lat/lng repris, pagination", async () => {
  // totalFound=150 avec limit=100 exige deux pages (ceil(150/100)=2) — un
  // totalFound de 2 tiendrait sur une seule page et ne testerait rien.
  const page1 = {
    totalFound: 150,
    content: [{ id: "1", name: "Guest Relation", location: { fullLocation: "Bagnolet, IDF, France", country: "fr", latitude: "48.87", longitude: "2.42" }, releasedDate: "2026-08-04T12:48:52.037Z" }],
  };
  const page2 = {
    totalFound: 150,
    content: [{ id: "2", name: "Réceptionniste", location: { fullLocation: "Lyon, France", country: "fr" }, releasedDate: "2026-08-04T12:48:52.037Z" }],
  };
  const f = fauxFetch({
    "api.smartrecruiters.com": (u) => new Response(JSON.stringify(u.includes("page=1") ? page2 : page1), { status: 200 }),
  });
  const r = await listerOffresFR("smartrecruiters", "accor", f);
  assert.equal(r.length, 2);
  assert.equal(r[0].url, "https://jobs.smartrecruiters.com/accor/1");
  assert.equal(r[0].lat, 48.87);
  assert.equal(r[0].lng, 2.42);
  assert.equal(r[1].lat, undefined);
});

test("un board absent (404) vaut une liste vide, pas une erreur", async () => {
  assert.deepEqual(await listerOffresFR("greenhouse", "boulangerie-durand", fauxFetch({})), []);
});

test("un 500 vaut null, pas une liste vide", async () => {
  assert.equal(await listerOffresFR("ashby", "alan", fauxFetch({ "api.ashbyhq.com": 500 })), null);
});

test("une erreur réseau vaut null", async () => {
  const f = async () => { throw new Error("ECONNRESET"); };
  assert.equal(await listerOffresFR("lever", "contentsquare", f), null);
});

test("un JSON illisible vaut null", async () => {
  const f = async () => new Response("<html>maintenance</html>", { status: 200 });
  assert.equal(await listerOffresFR("greenhouse", "onrunning", f), null);
});

test("SmartRecruiters : une page en échec en cours de pagination vaut null (pas de résultat partiel)", async () => {
  let appel = 0;
  const f = async () => {
    appel += 1;
    if (appel === 1) return new Response(JSON.stringify({ totalFound: 200, content: [{ id: "1", name: "A", location: { fullLocation: "Paris" }, releasedDate: "2026-08-04T12:00:00Z" }] }), { status: 200 });
    return new Response("", { status: 500 });
  };
  assert.equal(await listerOffresFR("smartrecruiters", "accor", f), null);
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
node --test "scripts/boards/offres.test.mjs"
```

Attendu : ÉCHEC, `Cannot find module .../scripts/boards/offres.mjs`.

- [ ] **Step 3 : écrire l'implémentation**

Créer `scripts/boards/offres.mjs` :

```js
// Lister les offres françaises LÉGÈRES d'un board ATS — sans texte.
//
// Complète ats.mjs (Brique 1, qui ne fait que COMPTER) sans le modifier : la
// duplication des URLs est assumée pour ne prendre aucun risque de régression
// sur `compterFR`, déjà en production chaque lundi.
//
// Champs vérifiés en direct le 04/08/2026 (curl réel sur onrunning/greenhouse,
// contentsquare/lever, alan/ashby, accor/smartrecruiters) — détail et
// justification dans docs/superpowers/specs/2026-08-04-marche-cache-offres-design.md §3.

import { estFrancais } from "./france.mjs";

const TIMEOUT_MS = 15_000;

/** ISO 8601 si `v` est une date exploitable (chaîne ou epoch ms), "" sinon. */
function dateOuVide(v) {
  if (v === undefined || v === null || v === "") return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Nombre fini si `v` est un nombre ou une chaîne numérique, undefined sinon. */
function nombreOuAbsent(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

const ENDPOINTS = {
  greenhouse: {
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    offres: (c) => (c?.jobs ?? []).map((j) => ({
      id: String(j?.id ?? ""),
      titre: j?.title ?? "",
      lieu: j?.location?.name ?? "",
      pays: "",
      url: j?.absolute_url ?? "",
      publieLe: dateOuVide(j?.updated_at),
    })),
  },
  lever: {
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    offres: (c) => (Array.isArray(c) ? c : []).map((j) => ({
      id: String(j?.id ?? ""),
      titre: j?.text ?? "",
      lieu: j?.categories?.location ?? "",
      pays: j?.country ?? "",
      url: j?.hostedUrl ?? "",
      publieLe: dateOuVide(j?.createdAt),
    })),
  },
  ashby: {
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    offres: (c) => (c?.jobs ?? []).map((j) => ({
      id: String(j?.id ?? ""),
      titre: j?.title ?? "",
      lieu: j?.location ?? "",
      pays: "",
      url: j?.jobUrl ?? "",
      publieLe: dateOuVide(j?.publishedAt),
    })),
  },
};

/** SmartRecruiters : pas de texte dans la liste, `limit` plafonné à 100 par l'API. */
const smartRecruitersUrl = (s, page) =>
  `https://api.smartrecruiters.com/v1/companies/${s}/postings?country=fr&limit=100&page=${page}`;

/** ⚠️ Pas d'URL publique dans la liste : construite et vérifiée en direct (200). */
function offresSmartRecruiters(corps, slug) {
  return (corps?.content ?? []).map((j) => {
    const lat = nombreOuAbsent(j?.location?.latitude);
    const lng = nombreOuAbsent(j?.location?.longitude);
    return {
      id: String(j?.id ?? ""),
      titre: j?.name ?? "",
      lieu: j?.location?.fullLocation ?? "",
      pays: j?.location?.country ?? "",
      url: `https://jobs.smartrecruiters.com/${slug}/${j?.id ?? ""}`,
      publieLe: dateOuVide(j?.releasedDate),
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
    };
  });
}

async function listerSmartRecruiters(slug, fetchImpl) {
  const out = [];
  let page = 0;
  let total = 1;
  while (page < total) {
    const res = await fetchImpl(smartRecruitersUrl(slug, page), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (page === 0 && res.status === 404) return [];
    if (!res.ok) throw new Error(`smartrecruiters ${slug} page ${page} : ${res.status}`);
    const corps = await res.json();
    total = Math.max(1, Math.ceil((corps?.totalFound ?? 0) / 100));
    out.push(...offresSmartRecruiters(corps, slug).filter((o) => estFrancais(o.lieu, o.pays)));
    page += 1;
  }
  return out;
}

/**
 * Offres françaises légères d'un board — même garantie que `compterFR` :
 * une réponse inexploitable (réseau, 5xx, JSON illisible, page en échec en
 * cours de pagination) rend `null`, jamais un résultat partiel.
 */
export async function listerOffresFR(ats, slug, fetchImpl = fetch) {
  try {
    if (ats === "smartrecruiters") return await listerSmartRecruiters(slug, fetchImpl);

    const e = ENDPOINTS[ats];
    const res = await fetchImpl(e.url(slug), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const corps = await res.json();
    return e.offres(corps).filter((o) => estFrancais(o.lieu, o.pays));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
node --test "scripts/boards/offres.test.mjs"
```

Attendu : `# pass 9`, `# fail 0`.

- [ ] **Step 5 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 6 : commit**

```bash
git add scripts/boards/offres.mjs scripts/boards/offres.test.mjs
git commit -m "feat(boards): listage léger des offres françaises par board"
```

- [ ] **Step 7 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 2 : l'orchestrateur, l'index léger réel, et le rafraîchissement hebdomadaire

**Files:**
- Create: `scripts/build-boards-offres.mjs`
- Create: `web/src/lib/jobs/data/boards-offres.json` (produit par l'exécution)
- Create: `web/src/lib/jobs/data/boards-offres.test.ts`
- Modify: `.github/workflows/boards-fr.yml`

**Interfaces:**
- Consumes: `web/src/lib/jobs/data/boards-fr.json` (448 boards), `listerOffresFR`
  (Task 1), `enLot` de `scripts/boards/lot.mjs` (Brique 1, inchangé).
- Produces: `web/src/lib/jobs/data/boards-offres.json`.

Même patron que `scripts/build-boards-fr.mjs` (Brique 1, Task 6), en plus
simple : pas de mémo, pas de TTL — chaque passage hebdomadaire réécrit
entièrement le fichier à partir des boards de `boards-fr.json` (spec §8).

- [ ] **Step 1 : écrire l'orchestrateur**

Créer `scripts/build-boards-offres.mjs` :

```js
// Construit l'index LÉGER des offres françaises (sans texte) des boards déjà
// connus de boards-fr.json.
//
// Usage : node scripts/build-boards-offres.mjs
//
// Produit : web/src/lib/jobs/data/boards-offres.json
//
// Contrairement à build-boards-fr.mjs, pas de mémo ni de TTL : ce fichier est
// entièrement réécrit à chaque passage — un board retombé à zéro (donc sorti
// de boards-fr.json) sort aussi de celui-ci.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listerOffresFR } from "./boards/offres.mjs";
import { enLot } from "./boards/lot.mjs";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_INDEX = join(DATA_DIR, "boards-fr.json");
const F_OFFRES = join(DATA_DIR, "boards-offres.json");

const PLAFOND = 12;

if (!existsSync(F_INDEX)) {
  console.error(`${F_INDEX} introuvable — lancer build-boards-fr.mjs d'abord.`);
  process.exit(1);
}
const boards = JSON.parse(readFileSync(F_INDEX, "utf8"));

console.log(`${boards.length} boards à moissonner.`);

const brut = await enLot(boards, PLAFOND, async (b) => {
  const offres = await listerOffresFR(b.ats, b.slug);
  return offres === null ? null : { board: b, offres };
});

const resultats = brut.filter(Boolean);
console.log(`${resultats.length} boards exploitables, ${brut.length - resultats.length} indéterminés.`);

const index = [];
for (const { board, offres } of resultats) {
  for (const o of offres) {
    index.push({ ats: board.ats, slug: board.slug, entreprise: board.nom, ...o });
  }
}

index.sort(
  (a, b) => a.ats.localeCompare(b.ats) || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
);

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(F_OFFRES, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(`OK — ${index.length} offres légères écrites dans ${F_OFFRES}.`);
```

- [ ] **Step 2 : exécuter pour de vrai**

```bash
node scripts/build-boards-offres.mjs
```

Attendu : quelques minutes (448 boards, plus la pagination SmartRecruiters),
puis `OK — N offres légères écrites…` avec **N proche de 9 714** (le compte
d'offres FR mesuré en Brique 1 — un écart raisonnable est normal, ce sont deux
mesures à des instants différents). Si N vaut 0, ne pas commiter : s'arrêter
et signaler.

- [ ] **Step 3 : vérifier la forme du fichier produit**

```bash
node -e "const a=require('./web/src/lib/jobs/data/boards-offres.json');console.log(a.length,'entrées');console.log(JSON.stringify(a.slice(0,2),null,2))"
```

Attendu : deux entrées avec `ats`, `slug`, `entreprise`, `id`, `titre`, `lieu`,
`url`, `publieLe` (ISO ou `""`), et `lat`/`lng` seulement sur des entrées
SmartRecruiters.

- [ ] **Step 4 : test de cohérence**

Créer `web/src/lib/jobs/data/boards-offres.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import offres from "./boards-offres.json";

const ATS_CONNUS = ["greenhouse", "lever", "ashby", "smartrecruiters"];

type Entree = {
  ats: string;
  slug: string;
  entreprise: string;
  id: string;
  titre: string;
  lieu: string;
  url: string;
  publieLe: string;
  lat?: number;
  lng?: number;
};

const index = offres as Entree[];

describe("index léger des offres des boards", () => {
  it("n'est pas vide", () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it("expose les champs obligatoires sur chaque entrée", () => {
    for (const o of index) {
      expect(ATS_CONNUS, `ats inconnu pour ${o.slug}/${o.id}`).toContain(o.ats);
      expect(o.slug.length).toBeGreaterThan(0);
      expect(o.entreprise.length, `entreprise vide pour ${o.ats}/${o.slug}`).toBeGreaterThan(0);
      expect(o.id.length, `id vide pour ${o.ats}/${o.slug}`).toBeGreaterThan(0);
      expect(o.titre.length, `titre vide pour ${o.ats}/${o.slug}/${o.id}`).toBeGreaterThan(0);
      expect(o.url.startsWith("http"), `url invalide pour ${o.ats}/${o.slug}/${o.id}`).toBe(true);
      if (o.publieLe !== "") expect(() => new Date(o.publieLe).toISOString()).not.toThrow();
    }
  });

  it("lat/lng n'apparaissent que sur des entrées SmartRecruiters", () => {
    for (const o of index) {
      if (o.lat !== undefined || o.lng !== undefined) expect(o.ats).toBe("smartrecruiters");
    }
  });

  it("ne contient aucun doublon ats+slug+id", () => {
    const cles = index.map((o) => `${o.ats}:${o.slug}:${o.id}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("est trié par ats puis slug puis id", () => {
    const attendu = [...index].sort(
      (a, b) => a.ats.localeCompare(b.ats) || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
    );
    expect(index.map((o) => `${o.ats}:${o.slug}:${o.id}`)).toEqual(
      attendu.map((o) => `${o.ats}:${o.slug}:${o.id}`),
    );
  });
});
```

```bash
npx vitest run src/lib/jobs/data/boards-offres.test.ts
```

Attendu : PASS, 5 tests. Si « n'est pas vide » échoue, revenir au Step 2.

- [ ] **Step 5 : brancher le harvest léger sur le rafraîchissement hebdomadaire**

Dans `.github/workflows/boards-fr.yml`, entre l'étape « Rafraîchir l'index »
et « Commiter si l'index a changé », insérer :

```yaml
      - name: Moissonner les offres légères
        run: node scripts/build-boards-offres.mjs
```

Et étendre l'étape de commit pour inclure le nouveau fichier — remplacer :

```yaml
      - name: Commiter si l'index a changé
        run: |
          if git diff --quiet -- web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json; then
```

par :

```yaml
      - name: Commiter si l'index a changé
        run: |
          if git diff --quiet -- web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json web/src/lib/jobs/data/boards-offres.json; then
```

et dans le même bloc, `git add` :

```yaml
          git add web/src/lib/jobs/data/boards-fr.json web/src/lib/jobs/data/boards-fr-testes.json web/src/lib/jobs/data/boards-offres.json
```

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 6 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 7 : commit**

```bash
git add scripts/build-boards-offres.mjs web/src/lib/jobs/data/boards-offres.json web/src/lib/jobs/data/boards-offres.test.ts .github/workflows/boards-fr.yml
git commit -m "feat(boards): index léger des offres et rafraîchissement hebdomadaire"
```

- [ ] **Step 8 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`, **en
inscrivant le nombre réel d'offres légères écrites**.

---

## Task 3 : récupérer le texte complet — un fetcher par ATS

**Files:**
- Create: `web/src/lib/jobs/boardsText.ts`
- Create: `web/src/lib/jobs/boardsText.test.ts`

**Interfaces:**
- Consumes: rien (fonctions pures côté réseau, testées avec un `fetch` factice).
- Produces: `texteGreenhouse`, `texteSmartRecruiters`, `textesLever`,
  `textesAshby`, et `obtenirTextes(offres, fetchImpl?)` qui les orchestre.

**Stratégie par ATS** (spec §4) : Greenhouse et SmartRecruiters ont un vrai
endpoint par offre (1 appel/offre). Lever et Ashby n'en ont pas : leur endpoint
liste contient déjà tout le texte, donc on le refait une fois **par board
touché**, jamais par offre — plusieurs offres candidates du même board Lever
ne coûtent qu'un seul appel.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `web/src/lib/jobs/boardsText.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { obtenirTextes, type FetchLike } from "./boardsText";
import type { OffreLegere } from "./boardsFr";

function offre(partial: Partial<OffreLegere>): OffreLegere {
  return { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "1", titre: "T", lieu: "Paris", url: "https://x", publieLe: "", ...partial };
}

/** `fetch` factice : une réponse par fragment d'URL. */
function fauxFetch(reponses: Record<string, unknown>): FetchLike {
  return async (url: string) => {
    const cle = Object.keys(reponses).find((k) => url.includes(k));
    if (!cle) return new Response("", { status: 404 });
    return new Response(JSON.stringify(reponses[cle]), { status: 200 });
  };
}

describe("obtenirTextes", () => {
  it("Greenhouse : un appel par offre, endpoint par id avec content=true", async () => {
    let appels = 0;
    const f: FetchLike = async (url) => {
      appels += 1;
      expect(url).toContain("jobs/1?content=true");
      return new Response(JSON.stringify({ content: "<p>Description complète</p>" }), { status: 200 });
    };
    const r = await obtenirTextes([offre({ ats: "greenhouse", id: "1" })], f);
    expect(r.get("greenhouse:onrunning:1")).toContain("Description complète");
    expect(appels).toBe(1);
  });

  it("SmartRecruiters : un appel par offre, sections concaténées", async () => {
    const f = fauxFetch({
      "postings/1": { jobAd: { sections: { companyDescription: { text: "À propos" }, jobDescription: { text: "Le poste" }, qualifications: { text: "Profil" } } } },
    });
    const r = await obtenirTextes([offre({ ats: "smartrecruiters", slug: "accor", id: "1" })], f);
    const texte = r.get("smartrecruiters:accor:1") ?? "";
    expect(texte).toContain("À propos");
    expect(texte).toContain("Le poste");
    expect(texte).toContain("Profil");
  });

  it("Lever : un seul appel pour deux offres du même board", async () => {
    let appels = 0;
    const f: FetchLike = async () => {
      appels += 1;
      return new Response(JSON.stringify([
        { id: "a", descriptionPlain: "Texte A" },
        { id: "b", descriptionPlain: "Texte B" },
      ]), { status: 200 });
    };
    const r = await obtenirTextes(
      [offre({ ats: "lever", slug: "contentsquare", id: "a" }), offre({ ats: "lever", slug: "contentsquare", id: "b" })],
      f,
    );
    expect(r.get("lever:contentsquare:a")).toBe("Texte A");
    expect(r.get("lever:contentsquare:b")).toBe("Texte B");
    expect(appels).toBe(1);
  });

  it("Ashby : un seul appel pour deux offres du même board", async () => {
    let appels = 0;
    const f: FetchLike = async () => {
      appels += 1;
      return new Response(JSON.stringify({ jobs: [
        { id: "x", descriptionPlain: "Texte X" },
        { id: "y", descriptionPlain: "Texte Y" },
      ] }), { status: 200 });
    };
    const r = await obtenirTextes(
      [offre({ ats: "ashby", slug: "alan", id: "x" }), offre({ ats: "ashby", slug: "alan", id: "y" })],
      f,
    );
    expect(r.get("ashby:alan:x")).toBe("Texte X");
    expect(r.get("ashby:alan:y")).toBe("Texte Y");
    expect(appels).toBe(1);
  });

  it("une offre en échec réseau est absente du résultat, les autres restent servies", async () => {
    const f: FetchLike = async (url) => {
      if (url.includes("greenhouse")) throw new Error("ECONNRESET");
      return new Response(JSON.stringify({ jobAd: { sections: { jobDescription: { text: "OK" } } } }), { status: 200 });
    };
    const r = await obtenirTextes(
      [offre({ ats: "greenhouse", id: "1" }), offre({ ats: "smartrecruiters", slug: "accor", id: "2" })],
      f,
    );
    expect(r.has("greenhouse:onrunning:1")).toBe(false);
    expect(r.get("smartrecruiters:accor:2")).toContain("OK");
  });
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
npx vitest run src/lib/jobs/boardsText.test.ts
```

Attendu : ÉCHEC, module introuvable.

- [ ] **Step 3 : écrire l'implémentation**

Créer `web/src/lib/jobs/boardsText.ts` :

```ts
/**
 * Texte complet d'une offre de board, récupéré en direct au moment d'une
 * recherche — jamais committé (spec `2026-08-04-marche-cache-offres-design.md` §4).
 *
 * Greenhouse et SmartRecruiters ont un endpoint par offre : un appel chacun.
 * Lever et Ashby n'en ont pas — leur endpoint liste contient déjà tout le
 * texte (`descriptionPlain`), donc on le refait une fois PAR BOARD TOUCHÉ,
 * jamais par offre : plusieurs candidates du même board ne coûtent qu'un appel.
 */

import { parVagues, fetchDelai } from "./reseau";
import type { OffreLegere } from "./boardsFr";

/**
 * Signature minimale utilisée ici — plus étroite que `typeof fetch` (qui
 * accepte `RequestInfo | URL`) pour que `fetchDelai` (`(url: string, init?) =>
 * Promise<Response>`) soit assignable telle quelle en valeur par défaut, et
 * qu'un `fetch` factice de test n'ait besoin d'aucun cast.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Clé stable d'une offre dans la map de résultats. */
function cleOffre(o: Pick<OffreLegere, "ats" | "slug" | "id">): string {
  return `${o.ats}:${o.slug}:${o.id}`;
}

async function texteGreenhouse(o: OffreLegere, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const res = await fetchImpl(`https://boards-api.greenhouse.io/v1/boards/${o.slug}/jobs/${o.id}?content=true`);
    if (!res.ok) return null;
    const corps = (await res.json()) as { content?: string };
    return corps.content ?? "";
  } catch {
    return null;
  }
}

async function texteSmartRecruiters(o: OffreLegere, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const res = await fetchImpl(`https://api.smartrecruiters.com/v1/companies/${o.slug}/postings/${o.id}`);
    if (!res.ok) return null;
    const corps = (await res.json()) as {
      jobAd?: { sections?: Record<string, { text?: string } | undefined> };
    };
    const sections = corps.jobAd?.sections ?? {};
    return Object.values(sections)
      .map((s) => s?.text ?? "")
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return null;
  }
}

/** Un seul appel liste pour toutes les offres candidates d'un même board Lever. */
async function textesLever(slug: string, ids: Set<string>, fetchImpl: FetchLike): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetchImpl(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!res.ok) return out;
    const corps = (await res.json()) as { id?: string; descriptionPlain?: string }[];
    for (const j of corps ?? []) {
      if (j.id && ids.has(j.id)) out.set(j.id, j.descriptionPlain ?? "");
    }
  } catch {
    // Board injoignable : les offres de ce board resteront sans texte, écartées en aval.
  }
  return out;
}

/** Un seul appel liste pour toutes les offres candidates d'un même board Ashby. */
async function textesAshby(slug: string, ids: Set<string>, fetchImpl: FetchLike): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetchImpl(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (!res.ok) return out;
    const corps = (await res.json()) as { jobs?: { id?: string; descriptionPlain?: string }[] };
    for (const j of corps.jobs ?? []) {
      if (j.id && ids.has(j.id)) out.set(j.id, j.descriptionPlain ?? "");
    }
  } catch {
    // Board injoignable : idem.
  }
  return out;
}

/**
 * Texte complet des offres candidates. Une offre en échec est absente du
 * résultat (jamais une chaîne vide qui se ferait passer pour un texte réel) —
 * le tri par mots interdits (§5 de la spec) l'ignorera simplement.
 */
export async function obtenirTextes(
  offres: OffreLegere[],
  fetchImpl: FetchLike = fetchDelai,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const parId = offres.filter((o) => o.ats === "greenhouse" || o.ats === "smartrecruiters");
  const resultatsParId = await parVagues(parId, async (o) => {
    const texte = o.ats === "greenhouse"
      ? await texteGreenhouse(o, fetchImpl)
      : await texteSmartRecruiters(o, fetchImpl);
    return texte === null ? null : { cle: cleOffre(o), texte };
  });
  for (const r of resultatsParId) if (r) out.set(r.cle, r.texte);

  for (const ats of ["lever", "ashby"] as const) {
    const parBoard = new Map<string, Set<string>>();
    for (const o of offres) {
      if (o.ats !== ats) continue;
      if (!parBoard.has(o.slug)) parBoard.set(o.slug, new Set());
      parBoard.get(o.slug)!.add(o.id);
    }
    const boards = [...parBoard.entries()];
    const resultats = await parVagues(boards, ([slug, ids]) =>
      ats === "lever" ? textesLever(slug, ids, fetchImpl) : textesAshby(slug, ids, fetchImpl),
    );
    boards.forEach(([slug], i) => {
      for (const [id, texte] of resultats[i]) out.set(cleOffre({ ats, slug, id }), texte);
    });
  }

  return out;
}
```

⚠️ Ce fichier importe `OffreLegere` de `./boardsFr`, créé à la Task 4. Task 3
ne compile donc entièrement qu'une fois la Task 4 commencée — c'est attendu :
créer d'abord un type minimal dans `boardsFr.ts` (juste l'interface, sans
`searchBoards`) fait partie du Step 3 ci-dessus si besoin, ou traiter Tasks 3
et 4 comme un seul commit si plus simple à la vérification. Le rapport final
doit refléter ce qui a réellement été fait.

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
npx vitest run src/lib/jobs/boardsText.test.ts
```

Attendu : PASS, 5 tests.

- [ ] **Step 5 : vérification complète, commit, journal** — reportés à la fin
  de la Task 4 (même livraison logique).

---

## Task 4 : la quatrième source — `searchBoards`

**Files:**
- Create: `web/src/lib/jobs/boardsFr.ts` (avec l'interface `OffreLegere` utilisée par Task 3)
- Create: `web/src/lib/jobs/boardsFr.test.ts`

**Interfaces:**
- Consumes: `web/src/lib/jobs/data/boards-offres.json`, `obtenirTextes` (Task 3),
  `isExcludedText` de `./exclude.ts`, `yearlySalaryLabel`/`JobOffer` de `./offer.ts`.
- Produces: `OffreLegere` (type), `searchBoards(profile): Promise<{ offers: JobOffer[]; calls: number }>`.

Filtrage en deux passes (spec §5) : titre + mots exclus + ancienneté AVANT
le fetch (sur l'index léger seul, aucun appel réseau) ; mots exclus revérifiés
sur titre+texte APRÈS le fetch. Plafond de 60 candidates (spec §6).

- [ ] **Step 1 : écrire le test qui échoue**

Créer `web/src/lib/jobs/boardsFr.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { searchBoards } from "./boardsFr";
import { EMPTY_PROFILE } from "./profile";

vi.mock("./data/boards-offres.json", () => ({
  default: [
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "1", titre: "Ingénieur Logiciel Backend", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/1", publieLe: new Date().toISOString() },
    { ats: "lever", slug: "contentsquare", entreprise: "Contentsquare", id: "2", titre: "Alternance Marketing", lieu: "Paris", url: "https://jobs.lever.co/contentsquare/2", publieLe: new Date().toISOString() },
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "3", titre: "Comptable", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/3", publieLe: "2020-01-01T00:00:00.000Z" },
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "4", titre: "Chargé de Communication", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/4", publieLe: new Date().toISOString() },
  ],
}));

vi.mock("./boardsText", () => ({
  obtenirTextes: vi.fn(async () => new Map([
    ["greenhouse:onrunning:1", "Nous cherchons un ingénieur backend Node.js expérimenté."],
    ["lever:contentsquare:2", "Stage de 6 mois en marketing digital."],
    // Titre propre, mais le texte revient sur un stage — doit être écarté après fetch.
    ["greenhouse:onrunning:4", "Une offre de stage de 6 mois, encadrée par un tuteur."],
  ])),
}));

describe("searchBoards", () => {
  it("aucun mot-clé → aucun appel, liste vide", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: [] });
    expect(r).toEqual({ offers: [], calls: 0 });
  });

  it("ne garde que les titres qui matchent un mot-clé du profil", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers).toHaveLength(1);
    expect(r.offers[0].title).toBe("Ingénieur Logiciel Backend");
    expect(r.offers[0].company).toBe("On Running");
    expect(r.offers[0].source).toBe("boards");
    expect(r.offers[0].jobText).toContain("Node.js");
  });

  it("exclut un titre qui contient un mot interdit avant même le fetch", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["alternance"], excludedWords: ["alternan"] });
    expect(r.offers).toHaveLength(0);
  });

  it("exclut une offre dont le texte (pas le titre) révèle un mot interdit", async () => {
    // "Chargé de Communication" (id 4) passe le pré-filtre titre sans encombre
    // (aucun mot exclu dedans) ; c'est son texte, connu seulement après fetch,
    // qui contient "stage" en mot isolé — la règle intégrée d'isExcludedText.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["communication"], excludedWords: [] });
    expect(r.offers).toHaveLength(0);
  });

  it("écarte une offre trop ancienne quand une date est connue", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["comptable"], maxAgeDays: 30 });
    expect(r.offers).toHaveLength(0);
  });

  it("id préfixé par la source, url et entreprise repris tels quels", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers[0].id).toBe("boards-greenhouse-onrunning-1");
    expect(r.offers[0].url).toBe("https://boards.greenhouse.io/onrunning/jobs/1");
  });
});
```

- [ ] **Step 2 : lancer le test pour le voir échouer**

```bash
npx vitest run src/lib/jobs/boardsFr.test.ts
```

Attendu : ÉCHEC, module introuvable.

- [ ] **Step 3 : écrire l'implémentation**

Créer `web/src/lib/jobs/boardsFr.ts` :

```ts
/**
 * Quatrième source d'offres : le « marché caché » des boards ATS publics
 * indexés en Brique 1. Contrairement aux trois autres, aucune requête ne part
 * vers un serveur de recherche : on filtre un index local (`boards-offres.json`,
 * rafraîchi chaque lundi) puis on ne va chercher le texte complet, en direct,
 * que pour les offres dont le titre matche déjà — voir
 * `docs/superpowers/specs/2026-08-04-marche-cache-offres-design.md`.
 */

import type { JobSearchProfile } from "./profile";
import type { JobOffer } from "./offer";
import { isExcludedText } from "./exclude";
import { obtenirTextes } from "./boardsText";
import { hostnameOf } from "./board";
import boardsOffresData from "./data/boards-offres.json";

export interface OffreLegere {
  ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters";
  slug: string;
  entreprise: string;
  id: string;
  titre: string;
  lieu: string;
  url: string;
  publieLe: string;
  lat?: number;
  lng?: number;
}

const boardsOffres = boardsOffresData as OffreLegere[];

/** Combien d'offres verront leur texte récupéré en direct — spec §6. */
const PLAFOND_CANDIDATES = 60;

const NOMS_ATS: Record<OffreLegere["ats"], string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Un des mots-clés du profil apparaît-il dans le titre ? Liste vide → aucun résultat. */
function matchTitre(titre: string, keywords: string[]): boolean {
  const hay = normalize(titre);
  return keywords.some((k) => k.trim() !== "" && hay.includes(normalize(k)));
}

function dansLage(publieLe: string, maxAgeDays: number): boolean {
  if (!publieLe) return true; // absence de date ≠ preuve d'ancienneté (spec §5)
  const jours = (Date.now() - new Date(publieLe).getTime()) / 86_400_000;
  return jours <= maxAgeDays;
}

function cleOffre(o: Pick<OffreLegere, "ats" | "slug" | "id">): string {
  return `${o.ats}:${o.slug}:${o.id}`;
}

export async function searchBoards(
  profile: JobSearchProfile,
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const candidates = boardsOffres
    .filter((o) => matchTitre(o.titre, profile.keywords))
    .filter((o) => !isExcludedText(o.titre, profile.excludedWords))
    .filter((o) => dansLage(o.publieLe, profile.maxAgeDays))
    .slice(0, PLAFOND_CANDIDATES);

  if (candidates.length === 0) return { offers: [], calls: 0 };

  const textes = await obtenirTextes(candidates);

  const offers: JobOffer[] = [];
  for (const o of candidates) {
    const texte = textes.get(cleOffre(o));
    if (texte === undefined) continue; // fetch en échec pour cette offre : on ne l'affiche pas à moitié
    if (isExcludedText(`${o.titre} ${texte}`, profile.excludedWords)) continue;

    offers.push({
      id: `boards-${o.ats}-${o.slug}-${o.id}`,
      source: "boards",
      title: o.titre,
      company: o.entreprise,
      location: o.lieu,
      commuteDestination: o.lieu,
      url: o.url,
      jobText: texte.slice(0, profile.maxDescriptionChars),
      publishedAt: o.publieLe,
      logoUrl: "",
      boardDomain: hostnameOf(o.url),
      boardName: NOMS_ATS[o.ats],
      contractLabel: "",
      salaryLabel: "",
      ...(o.lat !== undefined ? { lat: o.lat } : {}),
      ...(o.lng !== undefined ? { lng: o.lng } : {}),
    });
  }

  return { offers, calls: candidates.length };
}
```

- [ ] **Step 4 : lancer le test pour le voir passer**

```bash
npx vitest run src/lib/jobs/boardsFr.test.ts src/lib/jobs/boardsText.test.ts
```

Attendu : PASS, 11 tests au total (6 + 5).

- [ ] **Step 5 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/` : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

- [ ] **Step 6 : commit**

```bash
git add web/src/lib/jobs/boardsText.ts web/src/lib/jobs/boardsText.test.ts web/src/lib/jobs/boardsFr.ts web/src/lib/jobs/boardsFr.test.ts
git commit -m "feat(jobs): quatrième source, le marché caché des boards indexés"
```

- [ ] **Step 7 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`.

---

## Task 5 : intégration au pipeline « Offres » et vérification finale

**Files:**
- Modify: `web/src/lib/jobs/offer.ts`
- Modify: `web/src/lib/jobs/sources.ts`
- Modify: `web/src/lib/jobs/dedupe.ts`
- Modify: `web/src/app/api/jobs/search/route.ts`
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/components/jobs/SourcePicker.tsx`
- Modify: `PROJECT_INDEX.md` (section 8)

- [ ] **Step 1 : `SourceId`**

Dans `web/src/lib/jobs/offer.ts` :

```ts
export type SourceId = "francetravail" | "adzuna" | "jsearch" | "boards";
```

Ne rien changer d'autre dans ce fichier.

- [ ] **Step 2 : `SOURCES`/`DEFAULT_SOURCES`**

Dans `web/src/lib/jobs/sources.ts` :

```ts
export const SOURCES: ReadonlyArray<{ id: SourceId; label: string; monthlyQuota: number | null }> = [
  { id: "francetravail", label: "France Travail", monthlyQuota: null },
  { id: "jsearch", label: "Google for Jobs", monthlyQuota: 200 },
  { id: "adzuna", label: "Adzuna", monthlyQuota: 1000 },
  { id: "boards", label: "Marché caché", monthlyQuota: null },
];
```

```ts
export const DEFAULT_SOURCES: SourceToggles = {
  francetravail: true,
  adzuna: false,
  jsearch: false,
  boards: false,
};
```

- [ ] **Step 3 : `dedupe.ts`**

```ts
const PRIORITY: Record<SourceId, number> = { francetravail: 0, boards: 1, jsearch: 2, adzuna: 3 };
```

- [ ] **Step 4 : la route de recherche**

Dans `web/src/app/api/jobs/search/route.ts` :

```ts
import { searchBoards } from "@/lib/jobs/boardsFr";
```

```ts
const ZERO_CALLS: Record<SourceId, number> = { francetravail: 0, adzuna: 0, jsearch: 0, boards: 0 };
```

Dans `runners`, ajouter — **aucune clé requise**, donc rien à ajouter au bloc
`missing` juste au-dessus :

```ts
    boards: () => searchBoards(profile),
```

- [ ] **Step 5 : `JobsView.tsx`**

Étendre l'état d'usage (ligne ~47) :

```ts
const [usage, setUsage] = useState<Record<SourceId, number>>({ francetravail: 0, adzuna: 0, jsearch: 0, boards: 0 });
```

Le groupement en deux vagues (lignes ~305-311) devient trois : FT+Adzuna
(rapide), JSearch (lent, quota), boards (lent, sans quota — profil de latence
différent, ne doit pas retarder JSearch ni l'inverse) :

```ts
        { francetravail: p.sources.francetravail, adzuna: p.sources.adzuna, jsearch: false, boards: false },
        { francetravail: false, adzuna: false, jsearch: p.sources.jsearch, boards: false },
        { francetravail: false, adzuna: false, jsearch: false, boards: p.sources.boards },
      ].filter((s) => s.francetravail || s.adzuna || s.jsearch || s.boards);
```

Vérifier le type du paramètre `sources` de `scanGroupe` (ligne ~225) : s'il
type explicitement les clés (`Pick<SourceToggles, ...>` ou objet littéral), y
ajouter `boards` de la même façon que `jsearch`. Lire la fonction avant de la
modifier — ne pas deviner sa signature exacte.

- [ ] **Step 6 : `SourcePicker.tsx`**

```ts
export const SOURCE_DOMAIN: Record<SourceId, string> = {
  francetravail: "francetravail.fr",
  jsearch: "google.com",
  adzuna: "adzuna.fr",
  boards: "",
};
```

Vérifier dans `BoardIcon` (`web/src/components/jobs/BoardIcon.tsx`) qu'un
domaine vide `""` retombe bien sur l'initiale sans lever d'erreur (c'est déjà
le comportement documenté pour toute entreprise sans logo résolu, PROJECT_INDEX
§8) ; si ce n'est pas le cas, **s'arrêter et signaler** plutôt que de modifier
`BoardIcon` à l'aveugle (hors périmètre de cette task).

- [ ] **Step 7 : documentation**

Dans `PROJECT_INDEX.md`, section 8, remplacer le paragraphe :

```
L'index des boards français (`lib/jobs/data/boards-fr.json`) liste les
entreprises dont le board ATS public a au moins une offre en France — le
répertoire du « marché caché ». Régénérable par `node scripts/build-boards-fr.mjs`
et rafraîchi chaque lundi par `.github/workflows/boards-fr.yml`.
`boards-fr-testes.json` est la mémoire des couples déjà testés (échecs compris) ;
rien d'autre ne le lit. **La brique 2 — moissonner les offres depuis ces boards et
les afficher dans « Offres » — n'est pas faite** : l'index ne sert encore à rien
dans l'app. Voir `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`.
```

par :

```
L'index des boards français (`lib/jobs/data/boards-fr.json`) liste les
entreprises dont le board ATS public a au moins une offre en France — le
répertoire du « marché caché ». Régénérable par `node scripts/build-boards-fr.mjs`
et rafraîchi chaque lundi par `.github/workflows/boards-fr.yml`.
`boards-fr-testes.json` est la mémoire des couples déjà testés (échecs compris) ;
rien d'autre ne le lit. Voir `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`.

**Brique 2 — quatrième source « Marché caché »** (`lib/jobs/boardsFr.ts`,
décochée par défaut) : lit l'index léger `lib/jobs/data/boards-offres.json`
(titre/entreprise/lieu/url/date, sans texte, rafraîchi chaque lundi par le même
workflow), ne garde que les offres dont le titre matche les mots-clés du
profil, puis récupère le texte complet **en direct** pour ces seules offres
(plafond de 60 par recherche) — jamais de texte committé, pour ne pas faire
grossir le dépôt à chaque rafraîchissement hebdomadaire. Détail par ATS :
`docs/superpowers/specs/2026-08-04-marche-cache-offres-design.md`.
```

- [ ] **Step 8 : vérification complète**

```bash
node --test "scripts/boards/*.test.mjs"
```

Puis depuis `web/`, en collant la sortie intégrale :

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```

- [ ] **Step 9 : test manuel navigateur**

`npm run dev`, onglet Offres, ouvrir « Plus de filtres » → « Où chercher »,
cocher **uniquement** « Marché caché », saisir un intitulé de poste courant
(ex. « développeur »), lancer la recherche. Attendu : des offres apparaissent
avec la pastille source « Marché caché », un lien qui pointe vers un vrai
board (greenhouse.io / lever.co / ashbyhq.com / smartrecruiters.com), et un
score ATS calculable (le texte n'est pas vide). Documenter dans le rapport
final le poste testé et le nombre d'offres obtenues.

- [ ] **Step 10 : commit**

```bash
git add web/src/lib/jobs/offer.ts web/src/lib/jobs/sources.ts web/src/lib/jobs/dedupe.ts web/src/app/api/jobs/search/route.ts web/src/components/jobs/JobsView.tsx web/src/components/jobs/SourcePicker.tsx PROJECT_INDEX.md
git commit -m "feat(jobs): brancher le marché caché comme quatrième source d'offres"
```

- [ ] **Step 11 : journal**

Ajouter l'entrée datée en tête de `## Journal` dans `WORK_HISTORY.md`, avec les
chiffres réels du test manuel (Step 9), et mettre à jour la ligne
« Prochaine étape suggérée » de la section « État actuel ».

---

## Points d'arrêt attendus (à signaler, pas à deviner)

- Si `listerOffresFR("smartrecruiters", ...)` renvoie un nombre d'offres très
  différent du `offresFR` déjà connu dans `boards-fr.json` pour le même board
  (Task 2, Step 2) — signe possible d'une pagination mal calée.
- Si `BoardIcon` ne gère pas un domaine vide `""` sans erreur (Task 5, Step 6).
- Si le type exact des paramètres de `scanGroupe` dans `JobsView.tsx` ne se
  déduit pas sans ambiguïté de sa lecture (Task 5, Step 5).

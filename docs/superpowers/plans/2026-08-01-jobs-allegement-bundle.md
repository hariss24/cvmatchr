# Alléger le poids JS initial de `/jobs` — Plan d'implémentation

> **Pour les agents d'exécution :** ce plan se lit avec `web/CADRAGE_EXECUTION.md`
> (le contrat, qui prime en cas de conflit), `.agents/rules/cadrage.md` et
> `docs/superpowers/specs/2026-08-01-jobs-allegement-bundle-design.md` (la spec,
> qui justifie chaque choix par une mesure réelle du 01/08/2026).
> Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**But :** faire passer `rome-competences.json` (1,43 Mo, 60 % du poids
mesuré) et `zod` (288 Ko, via `profileSchema.ts`) d'un import statique — donc
téléchargés par tout visiteur de `/jobs`, même sans lancer de recherche — à un
`import()` dynamique déclenché seulement au moment de l'usage réel (premier
scan pour l'un, complétion d'un profil persisté pour l'autre).

**Architecture :** `buildRomeTargets` (`lib/jobs/rome.ts`) et `buildRankContext`
(`lib/jobs/rank/index.ts`) passent d'une signature synchrone à `async`, avec un
cache mémoire au niveau module pour ne charger le JSON qu'une fois par session
navigateur. Tous les autres consommateurs du classement (`rankOffer`,
`metierPoints`, `romeLabel`, etc.) restent synchrones : ils ne lisent le
contexte qu'après sa résolution, jamais avant, dans tout le code de
production. `profileSchema.ts` passe d'un import statique à un `import()` au
point d'usage dans `JobsView.tsx`.

**Stack :** TypeScript strict, Vitest, Next.js 16 (App Router), Turbopack.
Aucune dépendance npm ajoutée ou modifiée.

## Contraintes globales

Ces règles s'appliquent à **toutes** les tâches, sans être répétées à chaque fois.

- **Aucune dépendance npm ajoutée ou mise à jour.**
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.**
  TypeScript strict doit compiler.
- **Jamais `alert`/`confirm`/`prompt` natifs** → `uiAlert`/`uiConfirm`/
  `uiPrompt`/`toast` de `@/state/uiStore` (aucune tâche de ce plan n'y touche,
  rappel du cadrage général).
- **PUSH STRICTEMENT INTERDIT sur `main`.** Un push déploie la production
  Vercel. Travaille sur une branche `claude/…`, jamais sur `main`. Commit local
  par tâche.
- **Vérification après CHAQUE tâche**, depuis `web/`, dans cet ordre, sortie
  collée dans le rapport :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  npm run build
  ```
- **Une vérification rouge = tâche NON LIVRÉE.** On corrige avant de continuer.
- **Tu ne modifies pas une assertion de test existante pour la faire passer**,
  seule la signature (async/await) change dans ce plan — si une assertion
  doit changer, c'est que le code est faux, pas le test.
- **Journal obligatoire** après chaque tâche : entrée datée en tête de la
  section `## Journal` de `WORK_HISTORY.md` (racine) + mise à jour de la ligne
  « Prochaine étape suggérée ».

---

## Vue d'ensemble des fichiers

| Fichier | Sort |
|---|---|
| `web/src/lib/jobs/rome.ts` | Modifié — `buildRomeTargets` devient `async`, chargement paresseux mis en cache |
| `web/src/lib/jobs/rome.test.ts` | Modifié — tests adaptés à l'async, un test ajouté |
| `web/src/lib/jobs/rank/index.ts` | Modifié — `buildRankContext` devient `async` |
| `web/src/lib/jobs/rank/index.test.ts` | Modifié — tests adaptés à l'async |
| `web/src/lib/jobs/rank/criteria.test.ts` | Modifié — helper `ctx()` adapté à l'async |
| `web/src/components/jobs/JobsView.tsx` | Modifié — `await buildRankContext`, type de `ctx`, `parseProfile` en `import()` dynamique |
| `web/src/components/jobs/JobsView.scan.test.ts` | Modifié — `ctx` résolu dans un `beforeAll` |

---

## Task 1 : Chargement paresseux du référentiel ROME

**Files:**
- Modify: `web/src/lib/jobs/rome.ts`
- Modify: `web/src/lib/jobs/rome.test.ts`
- Modify: `web/src/lib/jobs/rank/criteria.test.ts` (helper `ctx()`, dépend directement de `buildRomeTargets`)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces:
  ```ts
  export function buildRomeTargets(romeCodes: string[]): Promise<RomeTargets>  // était synchrone
  export function romeLabel(code: string): string                              // inchangé, reste synchrone
  ```

**Contexte.** `rome.ts` importe aujourd'hui `data/rome-competences.json`
(1 459 020 o) en tête de fichier (`import data from "./data/rome-competences.json"`).
Comme ce module est importé, via `rank/index.ts`, par le composant client
`JobsView.tsx`, ce JSON entier finit dans le chunk le plus lourd chargé par
`/jobs` — 1,43 Mo, vérifié aujourd'hui par inspection directe des chunks de
build (spec §2.2), alors que `buildRomeTargets` n'est appelé qu'au moment d'un
scan, jamais au chargement de la page.

- [ ] **Step 1 : Adapter le test existant à la signature asynchrone**

Dans `web/src/lib/jobs/rome.test.ts`, chaque `it` qui appelle
`buildRomeTargets` devient `async` et `await`e l'appel — aucune assertion ne
change. Remplacer tout le contenu du bloc `describe("buildRomeTargets", ...)`
par :

```ts
describe("buildRomeTargets", () => {
  it("renvoie des ensembles vides sans code cible", async () => {
    const t = await buildRomeTargets([]);
    expect(t.cibles.size).toBe(0);
    expect(t.voisins.size).toBe(0);
    expect(t.attendues.size).toBe(0);
  });

  it("classe les cibles et leurs voisins officiels", async () => {
    const t = await buildRomeTargets(["M1855"]);
    expect(t.cibles.has("M1855")).toBe(true);
    expect(t.voisins.size).toBeGreaterThan(0);
    for (const v of t.voisins) expect(t.cibles.has(v)).toBe(false);
  });

  it("agrège les compétences attendues en gardant le poids le plus fort", async () => {
    const t = await buildRomeTargets(["M1855", "M1886"]);
    expect(t.attendues.size).toBeGreaterThan(10);
    for (const p of t.attendues.values()) expect([1, 2]).toContain(p);
  });

  it("ignore un code inconnu sans planter", async () => {
    const t = await buildRomeTargets(["M1855", "ZZZZZ"]);
    expect(t.cibles.has("M1855")).toBe(true);
    expect(t.cibles.has("ZZZZZ")).toBe(true);
    expect(t.attendues.size).toBeGreaterThan(0);
  });

  it("ne charge la table qu'une seule fois même avec des appels concurrents", async () => {
    const [a, b] = await Promise.all([buildRomeTargets(["M1855"]), buildRomeTargets(["M1834"])]);
    expect(a.cibles.has("M1855")).toBe(true);
    expect(b.cibles.has("M1834")).toBe(true);
  });
});
```

Le bloc `describe("romeLabel", ...)` ne change pas (il reste synchrone) : par
construction, ces tests s'exécutent après ceux de `buildRomeTargets` dans le
même fichier, qui ont déjà déclenché et résolu le chargement une fois — le
cache module reste peuplé pour le reste du fichier.

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/rome.test.ts
```

Attendu : ÉCHEC — `buildRomeTargets(...)` renvoie une `Promise`, pas l'objet
attendu par les assertions (`t.cibles` est `undefined` sur une Promise).

- [ ] **Step 3 : Réécrire `rome.ts`**

Remplacer les lignes 15-23 et 34-50 (l'import statique, `TABLE`, et
`buildRomeTargets`) par :

```ts
interface Fiche {
  i: string;                    // intitulé officiel
  c: Record<string, number>;    // code_ogr → 2 (cœur de métier) ou 1
  v: string[];                  // codes ROME voisins (mobilités officielles)
}

let table: Record<string, Fiche> | null = null;
let loading: Promise<Record<string, Fiche>> | null = null;

/**
 * Charge le référentiel (1,43 Mo) à la demande, une seule fois par session
 * navigateur — jamais en import statique : cela mettait tout le référentiel
 * dans le bundle initial de /jobs, chargé même par un visiteur qui ne lance
 * aucun scan (spec 2026-08-01, §2.2).
 */
async function loadTable(): Promise<Record<string, Fiche>> {
  if (table) return table;
  if (!loading) {
    loading = import("./data/rome-competences.json").then((m) => {
      table = m.default as Record<string, Fiche>;
      return table;
    });
  }
  return loading;
}

export interface RomeTargets {
  /** Codes visés par le candidat. */
  cibles: Set<string>;
  /** Métiers voisins officiels des cibles, cibles exclues. */
  voisins: Set<string>;
  /** Compétences attendues, agrégées sur les cibles : code_ogr → poids. */
  attendues: Map<string, number>;
}

/** Prépare une fois par scan les ensembles utilisés par le classement. */
export async function buildRomeTargets(romeCodes: string[]): Promise<RomeTargets> {
  const t = await loadTable();
  const cibles = new Set(romeCodes.filter(Boolean));
  const voisins = new Set<string>();
  const attendues = new Map<string, number>();

  for (const code of cibles) {
    const fiche = t[code];
    if (!fiche) continue; // code déclaré mais absent du référentiel : toléré
    for (const v of fiche.v) if (!cibles.has(v)) voisins.add(v);
    for (const [ogr, poids] of Object.entries(fiche.c)) {
      attendues.set(ogr, Math.max(attendues.get(ogr) ?? 0, poids));
    }
  }

  return { cibles, voisins, attendues };
}

/** Intitulé officiel d'un code ROME ; le code brut si inconnu ou pas encore chargé. */
export function romeLabel(code: string): string {
  return table?.[code]?.i || code;
}
```

Le commentaire de tête du fichier (lignes 1-13) ne change pas.

- [ ] **Step 4 : Adapter `criteria.test.ts`**

`web/src/lib/jobs/rank/criteria.test.ts` importe `buildRomeTargets` directement
(ligne 6) et l'utilise dans un helper local `ctx()` (lignes 16-19), appelé sans
`await` à des dizaines de sites dans ce fichier. Rendre le helper asynchrone :

```ts
// avant (lignes 16-19)
const ctx = (romeCodes: string[] = [], home: { lat: number; lng: number } | null = null) => ({
  rome: buildRomeTargets(romeCodes),
  home,
});

// après
const ctx = async (romeCodes: string[] = [], home: { lat: number; lng: number } | null = null) => ({
  rome: await buildRomeTargets(romeCodes),
  home,
});
```

Puis, dans **tout le reste du fichier**, transformer chaque site d'appel
`ctx(...)` en `await ctx(...)`, et chaque `it("...", () => { ... })` qui en
contient un en `it("...", async () => { ... })`. Exemple représentatif :

```ts
// avant
it("donne le maximum sur un code ROME visé", () => {
  const l = metierPoints(offre({ romeCode: "M1855" }), EMPTY_PROFILE, ctx(["M1855"]));
  expect(l.points).toBe(MAX.metier);
  expect(l.reason).toMatch(/cible/i);
});

// après
it("donne le maximum sur un code ROME visé", async () => {
  const l = metierPoints(offre({ romeCode: "M1855" }), EMPTY_PROFILE, await ctx(["M1855"]));
  expect(l.points).toBe(MAX.metier);
  expect(l.reason).toMatch(/cible/i);
});
```

Appliquer la même transformation mécanique à chaque site d'appel de `ctx(...)`
du fichier (une quinzaine, dans les blocs `describe("metierPoints", ...)`,
`describe("distanceLigne", ...)`, `describe("malusHorsSujet", ...)` et
ailleurs — chercher `ctx(` dans le fichier pour les repérer tous). Ne toucher
à aucune assertion.

⚠️ Un site utilise `buildRomeTargets` directement, hors du helper `ctx()`
(section « donne une note partielle sur un métier voisin ») :

```ts
// avant
const t = buildRomeTargets(["M1855"]);

// après
const t = await buildRomeTargets(["M1855"]);
```

- [ ] **Step 5 : Vérifier que tous les tests passent**

```bash
cd web && npx vitest run src/lib/jobs/rome.test.ts src/lib/jobs/rank/criteria.test.ts
```

Attendu : tous verts, même nombre de tests qu'avant cette tâche.

- [ ] **Step 6 : Vérification complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Attendu : tout vert. `npx tsc --noEmit` doit signaler toute erreur de type
restante côté `rank/index.ts` (Task 2, pas encore fait) — si c'est le cas,
c'est normal à ce stade, continuer vers la Task 2 avant de considérer cette
vérification bloquante ; sinon (`rank/index.ts` compile déjà tel quel car
TypeScript infère `Promise<RomeTargets>` pour `ctx.rome` sans lever d'erreur
immédiate), tout doit être vert dès cette étape.

- [ ] **Step 7 : Commit**

```bash
git add web/src/lib/jobs/rome.ts web/src/lib/jobs/rome.test.ts web/src/lib/jobs/rank/criteria.test.ts
git commit -m "perf(offres): charger le référentiel ROME à la demande

rome-competences.json (1,43 Mo) était importé statiquement et finissait dans
le bundle initial de /jobs, chargé même par un visiteur qui ne lance aucun
scan — vérifié le 01/08/2026 : ce fichier est le plus gros chunk chargé par
la page, 60 % de son poids total. buildRomeTargets charge désormais le JSON
via import() dynamique, mis en cache en mémoire, déclenché seulement au
premier scan."
```

---

## Task 2 : Propager l'asynchrone dans `buildRankContext`

**Files:**
- Modify: `web/src/lib/jobs/rank/index.ts`
- Modify: `web/src/lib/jobs/rank/index.test.ts`

**Interfaces:**
- Consumes: `buildRomeTargets` async (Task 1).
- Produces:
  ```ts
  export function buildRankContext(profile: JobSearchProfile, home: LatLng | null): Promise<RankContext>  // était synchrone
  ```
  `rankOffer`, `shouldPersist`, `gradeOf` restent inchangés (synchrones).

- [ ] **Step 1 : Adapter les tests**

Dans `web/src/lib/jobs/rank/index.test.ts`, le helper local `const ctx = () =>
buildRankContext(profilWeb, { lat: 48.85, lng: 2.35 });` (ligne 46) devient
asynchrone :

```ts
// avant
const ctx = () => buildRankContext(profilWeb, { lat: 48.85, lng: 2.35 });

// après
const ctx = async () => buildRankContext(profilWeb, { lat: 48.85, lng: 2.35 });
```

Puis, comme en Task 1 Step 4, transformer chaque site d'appel `ctx()` du
fichier en `await ctx()`, et chaque `it("...", () => {...})` englobant en
`async`. Exemple :

```ts
// avant
it("borne le score entre 0 et 100", () => {
  const bas = rankOffer(offre({ title: "Comptable", jobText: "Bilans.", romeCode: "M1203" }), profilWeb, ctx(), T0);
  ...
});

// après
it("borne le score entre 0 et 100", async () => {
  const bas = rankOffer(offre({ title: "Comptable", jobText: "Bilans.", romeCode: "M1203" }), profilWeb, await ctx(), T0);
  ...
});
```

Chercher `ctx()` dans le fichier pour repérer tous les sites (une vingtaine,
dans les blocs `describe("rankOffer", ...)` et au-delà).

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/rank/index.test.ts
```

Attendu : ÉCHEC — `rankOffer` reçoit une `Promise<RankContext>` au lieu d'un
`RankContext`, les assertions sur `breakdown`/`score` échouent.

- [ ] **Step 3 : Modifier `buildRankContext`**

Dans `web/src/lib/jobs/rank/index.ts`, remplacer (lignes 38-41) :

```ts
/** Prépare une fois par scan le contexte utilisé par le classement (le référentiel ROME est lourd). */
export function buildRankContext(profile: JobSearchProfile, home: LatLng | null): RankContext {
  return { rome: buildRomeTargets(profile.romeCodes), home };
}
```

par :

```ts
/** Prépare une fois par scan le contexte utilisé par le classement (le référentiel ROME est lourd, chargé à la demande). */
export async function buildRankContext(profile: JobSearchProfile, home: LatLng | null): Promise<RankContext> {
  return { rome: await buildRomeTargets(profile.romeCodes), home };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd web && npx vitest run src/lib/jobs/rank/index.test.ts
```

Attendu : tous verts, même nombre de tests qu'avant cette tâche.

- [ ] **Step 5 : Vérification complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Attendu : `npx tsc --noEmit` signale probablement une erreur dans
`web/src/components/jobs/JobsView.tsx` (`buildRankContext` renvoie maintenant
une `Promise`, pas encore consommée avec `await`) — normal, traité en Task 3.
Si c'est la seule erreur de type restante, continuer vers la Task 3.

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/jobs/rank/index.ts web/src/lib/jobs/rank/index.test.ts
git commit -m "perf(offres): buildRankContext devient asynchrone

Suite du chargement à la demande du référentiel ROME (commit précédent) :
buildRankContext propage l'attente vers son seul appelant, JobsView.tsx
(prochain commit). rankOffer et les critères restent synchrones, ils ne
lisent le contexte qu'une fois résolu."
```

---

## Task 3 : Propager dans `JobsView.tsx` + charger `profileSchema` à la demande

**Files:**
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/components/jobs/JobsView.scan.test.ts`

**Interfaces:**
- Consumes: `buildRankContext` async (Task 2).
- Produces: rien de nouveau, comportement observable inchangé.

**Contexte.** `JobsView.tsx` importe `parseProfile` de `profileSchema.ts`
(zod, 288 Ko) statiquement en tête de fichier (ligne 11) pour un seul usage,
au montage (lignes 59-66) : compléter un profil persisté avec les valeurs par
défaut si un champ manque. Le passer en `import()` dynamique au point d'usage
retire zod du bundle initial de `/jobs` — vérifié spec §2.3.

- [ ] **Step 1 : Adapter `JobsView.scan.test.ts`**

`web/src/components/jobs/JobsView.scan.test.ts` calcule `ctx` une fois par
`describe` (ligne 28) et le réutilise dans plusieurs `it`. Passer par un
`beforeAll` :

```ts
// avant
import { describe, it, expect } from "vitest";
...
describe("logique de scan", () => {
  const ctx = buildRankContext(profil, { lat: 48.85, lng: 2.35 });

  const lot = [ ... ];

  it("classe toutes les offres sans en écarter aucune", () => {
    const notees = lot.map((o) => ({ o, r: rankOffer(o, profil, ctx, T0) }));
    ...
  });
  ...
});

// après
import { describe, it, expect, beforeAll } from "vitest";
...
describe("logique de scan", () => {
  let ctx: Awaited<ReturnType<typeof buildRankContext>>;
  beforeAll(async () => {
    ctx = await buildRankContext(profil, { lat: 48.85, lng: 2.35 });
  });

  const lot = [ ... ];  // inchangé

  it("classe toutes les offres sans en écarter aucune", () => {
    const notees = lot.map((o) => ({ o, r: rankOffer(o, profil, ctx, T0) }));
    ...
  });
  ...
});
```

Les quatre `it` du fichier restent synchrones et inchangés dans leur corps :
`ctx` est déjà résolu par `beforeAll` avant qu'aucun ne s'exécute.

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/components/jobs/JobsView.scan.test.ts
```

Attendu : ÉCHEC tant que `buildRankContext` renvoie une Promise non attendue
dans l'ancienne forme — après le Step 1 ci-dessus, ce test doit au contraire
déjà passer une fois lui seul modifié. Si l'étape précédente (Task 2) est
committée, ce test échoue avant le Step 1 de cette tâche (Promise non
résolue) puis passe après.

- [ ] **Step 3 : Modifier `JobsView.tsx` — propager l'attente de `buildRankContext`**

Ligne 173, changer le type du paramètre `ctx` de `scanGroupe` :

```ts
// avant
async function scanGroupe(
  p: JobSearchProfile,
  sources: JobSearchProfile["sources"],
  ctx: ReturnType<typeof buildRankContext>,
  vues: Set<string>,
): Promise<number> {

// après
async function scanGroupe(
  p: JobSearchProfile,
  sources: JobSearchProfile["sources"],
  ctx: Awaited<ReturnType<typeof buildRankContext>>,
  vues: Set<string>,
): Promise<number> {
```

Ligne 266, ajouter `await` (la fonction englobante `scan` est déjà `async`,
ligne 244) :

```ts
// avant
const ctx = buildRankContext(p, home);

// après
const ctx = await buildRankContext(p, home);
```

- [ ] **Step 4 : Charger `profileSchema` à la demande**

Retirer l'import statique (ligne 11) :

```ts
// à supprimer
import { parseProfile } from "@/lib/jobs/profileSchema";
```

Remplacer le callback de montage (lignes 59-66) :

```ts
// avant
getJobProfile().then((p) => {
  // Le profil persisté peut dater d'avant l'ajout d'un champ (ex. `sources`,
  // arrivé avec les sources multiples) : on le repasse par le schéma
  // tolérant, qui complète les manques avec les défauts neutres. Sans ça,
  // un profil existant fait planter le formulaire sur un champ absent.
  if (p) setProfile(parseProfile(p));
  setProfileLoaded(true);
});

// après
getJobProfile().then(async (p) => {
  // Le profil persisté peut dater d'avant l'ajout d'un champ (ex. `sources`,
  // arrivé avec les sources multiples) : on le repasse par le schéma
  // tolérant, qui complète les manques avec les défauts neutres. Sans ça,
  // un profil existant fait planter le formulaire sur un champ absent.
  // parseProfile (zod, ~288 Ko) est chargé à la demande ici plutôt qu'en
  // import statique, pour ne pas alourdir le bundle initial de /jobs.
  if (p) {
    const { parseProfile } = await import("@/lib/jobs/profileSchema");
    setProfile(parseProfile(p));
  }
  setProfileLoaded(true);
});
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
cd web && npx vitest run src/components/jobs/JobsView.scan.test.ts
```

Attendu : tous verts.

- [ ] **Step 6 : Vérification complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test tests/e2e/jobs.spec.ts
```

Attendu : tout vert, y compris le test e2e existant de `/jobs`
(`tests/e2e/jobs.spec.ts`, mentionné dans le constat de performance comme
mockant `/api/jobs/search`) — c'est la garantie non négociable que le scan
fonctionne encore de bout en bout après ce chantier, chargement paresseux
compris.

- [ ] **Step 7 : Commit**

```bash
git add web/src/components/jobs/JobsView.tsx web/src/components/jobs/JobsView.scan.test.ts
git commit -m "perf(offres): charger parseProfile à la demande, propager buildRankContext

Dernier maillon : JobsView.tsx attend désormais buildRankContext (devenu
asynchrone) et charge profileSchema.ts (zod, ~288 Ko) par import() dynamique
au montage plutôt qu'en import statique. Avec le chargement paresseux du
référentiel ROME (commits précédents), /jobs ne charge plus ni zod ni le
référentiel ROME avant qu'un scan soit réellement lancé."
```

---

## Task 4 : Vérification finale — mesure du poids réel

**Files:** aucun fichier modifié, tâche de vérification uniquement.

**But :** confirmer, avec la même méthode qu'en §2 de la spec, que le poids
initial de `/jobs` a effectivement chuté sous la cible de 700 Ko (critère de
succès §7.3 de la spec), et que le chunk ROME ne se charge qu'une fois par
scan (critère §7.4).

- [ ] **Step 1 : Build de production propre et démarrage**

```bash
cd web
rm -rf .next
npm run build
npm run start &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/jobs   # attendu : 200
```

- [ ] **Step 2 : Lister les scripts chargés par `/jobs` avant tout clic**

```bash
curl -s http://localhost:3000/jobs -o /tmp/jobs.html
grep -oE '/_next/static/chunks/[a-zA-Z0-9_.-]+\.js' /tmp/jobs.html | sort -u
```

Pour chaque fichier listé, vérifier taille et absence des motifs interdits :

```bash
for f in $(grep -oE '/_next/static/chunks/[a-zA-Z0-9_.-]+\.js' /tmp/jobs.html | sort -u | sed 's#.*/##;s#\.js$##'); do
  p=".next/static/chunks/$f.js"
  sz=$(stat -c%s "$p" 2>/dev/null || echo 0)
  zod=$(grep -oi "zod" "$p" 2>/dev/null | wc -l)
  rome=$(grep -c "coeur_metier" "$p" 2>/dev/null || echo 0)
  echo "$f  ${sz} o  zod:${zod}  rome:${rome}"
done
```

Attendu : **aucune ligne avec `rome:` > 0** ; aucune ligne avec `zod:` > 5
(quelques occurrences résiduelles de code non lié sont tolérables, un chunk
entier dédié à zod ne doit plus apparaître) ; somme des tailles < 700 Ko
(critère §7.3 de la spec).

- [ ] **Step 3 : Vérifier le chargement paresseux au premier scan**

Ouvrir `/jobs` dans un navigateur (ou via Playwright, onglet réseau activé),
lancer une recherche, et vérifier qu'un nouveau chunk contenant
`coeur_metier` se charge à ce moment précis — pas avant. Relancer une seconde
recherche dans la même session : ce chunk ne doit **pas** être re-téléchargé
(servi depuis le cache mémoire du module JS, donc absent de l'onglet réseau
la seconde fois).

- [ ] **Step 4 : Arrêter le serveur, consigner les résultats**

```bash
kill %1 2>/dev/null
```

Consigner dans `WORK_HISTORY.md` (`## Journal`) le poids total mesuré avant/
après ce chantier (2 489 Ko → poids mesuré au Step 2), et si possible un
chronométrage Slow 4G + CPU x4 avec la méthodologie de
`docs/archive/boucle/constats/2026-07-31-performance.md`, si un environnement avec
Chromium installé est disponible pour l'exécuter (ce n'était pas le cas dans
l'environnement où cette spec a été écrite, voir spec §2.6).

- [ ] **Step 5 : Pas de commit** — tâche de vérification uniquement, rien à
      committer sauf la mise à jour de `WORK_HISTORY.md` :

```bash
git add WORK_HISTORY.md
git commit -m "docs(boucle): consigne la mesure de poids de /jobs après allègement du bundle"
```

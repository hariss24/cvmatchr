# Détecteur d'ATS (Greenhouse / Lever) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Contrat d'exécution : `web/CADRAGE_EXECUTION.md`** — lis-le avant la Task 1.
> En particulier : PUSH INTERDIT, un commit par task, journal `WORK_HISTORY.md`
> après chaque task, pas de `any`, pas de dépendance npm.

**Goal:** à partir d'un nom d'entreprise, deviner si elle publie ses offres sur un
board Greenhouse ou Lever public, le mémoriser, et l'afficher sur la carte d'offre.

**Architecture:** une fonction de résolution côté serveur qui essaie des slugs
candidats contre les endpoints publics des deux ATS, exposée par une route API
calquée sur `/api/jobs/logos` ; un cache Dexie par navigateur ; un export JSON
pour ne pas perdre l'annuaire accumulé.

**Tech Stack:** TypeScript strict, Next.js 16 (App Router), React 19, Dexie 4,
Vitest, `fetch` natif. **Aucune dépendance nouvelle.**

**Spec de référence :** `docs/superpowers/specs/2026-08-03-detecteur-ats-design.md`

## Global Constraints

- Aucune nouvelle dépendance npm (règle 6 du cadrage).
- Aucune base serveur : tout reste local (Dexie), comme `apiUsage` et `commuteCache`.
- Aucun scan en fond ni robot planifié : résolution à la demande, quand une offre
  avec une entreprise inconnue apparaît dans les résultats.
- Le format d'export est un tableau plat d'objets `AtsDirectoryEntry`, réimportable
  tel quel dans une future base partagée — champs simples, types stables.
- Les appels réseau sortants vers les ATS se font **côté serveur** (route API),
  jamais depuis le navigateur.
- Une entreprise n'est résolue qu'une fois par navigateur, échecs compris.
- Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.
- Jamais `alert`/`confirm`/`prompt` natifs → `uiAlert`/`uiConfirm`/`uiPrompt`/`toast`
  de `@/state/uiStore`. Jamais de couleur en dur → variables CSS de thème.
- Tests hors-ligne : aucun test ne doit émettre de requête réseau réelle.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `web/src/lib/jobs/ats.ts` **(créer)** | Dérivation des slugs + résolution contre les deux ATS. Aucune dépendance à Dexie ni à React. |
| `web/src/lib/jobs/ats.test.ts` **(créer)** | Tests de `atsSlugs` et `resolveAts` avec `fetch` injecté. |
| `web/src/app/api/jobs/ats/route.ts` **(créer)** | Route `POST` qui résout un lot d'entreprises. Calquée sur `/api/jobs/logos/route.ts`. |
| `web/src/lib/storage/db.ts` **(modifier)** | Type `AtsDirectoryEntry`, table Dexie v11, helpers de lecture/écriture. |
| `web/src/lib/storage/backup.ts` **(modifier)** | `atsDirectory` ajouté à la sauvegarde/restauration + `exportAtsDirectory()`. |
| `web/src/app/settings/page.tsx` **(modifier)** | Bouton « Exporter l'annuaire ATS ». |
| `web/src/components/jobs/JobsView.tsx` **(modifier)** | Déclenche la résolution en tâche de fond, passe l'annuaire aux cartes. |
| `web/src/components/jobs/JobCard.tsx` **(modifier)** | Affiche le lien « Offres directes chez … ». |

---

### Task 1 : dérivation des slugs candidats

**Files:**
- Create: `web/src/lib/jobs/ats.ts`
- Test: `web/src/lib/jobs/ats.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `normalizeCompany(companyName: string): string`, `atsSlugs(companyName: string): string[]`, `type AtsProvider = "greenhouse" | "lever"`, `type AtsMatch = { ats: AtsProvider; slug: string } | { ats: "none"; slug: "" }`, `const NO_ATS: AtsMatch`.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `web/src/lib/jobs/ats.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { atsSlugs } from "./ats";

describe("atsSlugs", () => {
  it("met en minuscules et retire les accents", () => {
    expect(atsSlugs("Société Générale")).toContain("societe-generale");
  });

  it("propose la variante collée en plus de la variante tiretée", () => {
    expect(atsSlugs("Groupe SEB")).toEqual(["groupe-seb", "groupeseb"]);
  });

  it("ne propose qu'un slug quand les deux variantes sont identiques", () => {
    expect(atsSlugs("Doctolib")).toEqual(["doctolib"]);
  });

  it("retire les apostrophes et la ponctuation", () => {
    expect(atsSlugs("L'Oréal S.A.")).toEqual(["l-oreal-s-a", "lorealsa"]);
  });

  it("ne renvoie rien pour un nom vide ou sans lettre", () => {
    expect(atsSlugs("")).toEqual([]);
    expect(atsSlugs("   ")).toEqual([]);
    expect(atsSlugs("---")).toEqual([]);
  });
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

```bash
cd web && npx vitest run src/lib/jobs/ats.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./ats"`.

- [ ] **Step 3 : écrire l'implémentation minimale**

Créer `web/src/lib/jobs/ats.ts` :

```ts
/**
 * Détection de l'ATS (logiciel de recrutement) d'une entreprise.
 *
 * La plupart des entreprises ne codent pas leur page carrières : elles louent
 * Greenhouse, Lever, etc., qui exposent chaque board en JSON public. Savoir
 * quelle entreprise utilise quoi, c'est la première brique pour aller chercher
 * les offres à la source plutôt que sur les jobboards saturés.
 */

export type AtsProvider = "greenhouse" | "lever";

export type AtsMatch =
  | { ats: AtsProvider; slug: string }
  | { ats: "none"; slug: "" };

/** Aucun ATS trouvé. Constante partagée pour éviter de réécrire le littéral. */
export const NO_ATS: AtsMatch = { ats: "none", slug: "" };

/**
 * Nom d'entreprise ramené à sa forme canonique : minuscules, sans accent, mots
 * séparés par des tirets. Sert de slug candidat ET de clé de cache — une seule
 * définition pour que les deux ne divergent jamais.
 *
 * La plage U+0300–U+036F est celle des diacritiques combinants, isolés par la
 * décomposition NFD : « Société » devient « societe ».
 */
export function normalizeCompany(companyName: string): string {
  return companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slugs à essayer pour une entreprise, du plus probable au moins probable.
 *
 * Chaque ATS a ses conventions : « Groupe SEB » peut être `groupe-seb` chez l'un
 * et `groupeseb` chez l'autre. On essaie les deux plutôt que de parier.
 */
export function atsSlugs(companyName: string): string[] {
  const base = normalizeCompany(companyName);
  if (!base) return [];

  const colle = base.replace(/-/g, "");
  return colle === base ? [base] : [base, colle];
}
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

```bash
cd web && npx vitest run src/lib/jobs/ats.test.ts
```

Attendu : 5 tests passés.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/jobs/ats.ts web/src/lib/jobs/ats.test.ts
git commit -m "feat(ats): derivation des slugs candidats depuis un nom d'entreprise"
```

---

### Task 2 : résolution contre les endpoints Greenhouse et Lever

**Files:**
- Modify: `web/src/lib/jobs/ats.ts` (ajout en fin de fichier)
- Test: `web/src/lib/jobs/ats.test.ts` (ajout d'un second `describe`)

**Interfaces:**
- Consumes: `atsSlugs`, `AtsMatch`, `NO_ATS` (Task 1).
- Produces: `resolveAts(companyName: string, fetchImpl?: typeof fetch): Promise<AtsMatch>`.

**Contexte pour l'implémenteur.** Les deux endpoints publics, sans clé :
- Greenhouse : `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` → `{ "jobs": [...] }`
- Lever : `https://api.lever.co/v0/postings/{slug}?mode=json` → `[...]` (tableau racine)

Un board qui existe mais n'a aucune offre ouverte renvoie 200 avec une liste
vide. Ce n'est **pas** un match : on ne veut afficher un lien que s'il mène
quelque part. On continue avec le candidat suivant.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à la fin de `web/src/lib/jobs/ats.test.ts` :

```ts
import { resolveAts, NO_ATS } from "./ats";

/** `fetch` factice : renvoie une réponse par URL, 404 pour tout le reste. */
function fauxFetch(reponses: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const cle = Object.keys(reponses).find((k) => url.includes(k));
    if (!cle) return new Response("", { status: 404 });
    return new Response(JSON.stringify(reponses[cle]), { status: 200 });
  }) as typeof fetch;
}

describe("resolveAts", () => {
  it("retient Greenhouse quand le board existe et a des offres", async () => {
    const f = fauxFetch({ "boards-api.greenhouse.io/v1/boards/doctolib": { jobs: [{ id: 1 }] } });
    expect(await resolveAts("Doctolib", f)).toEqual({ ats: "greenhouse", slug: "doctolib" });
  });

  it("retient Lever quand Greenhouse ne connaît pas l'entreprise", async () => {
    const f = fauxFetch({ "api.lever.co/v0/postings/leboncoin": [{ id: "a" }] });
    expect(await resolveAts("Leboncoin", f)).toEqual({ ats: "lever", slug: "leboncoin" });
  });

  // Un board vide mène à une page sans offre : le lien serait une impasse.
  it("ignore un board qui répond 200 mais sans aucune offre", async () => {
    const f = fauxFetch({ "boards-api.greenhouse.io/v1/boards/doctolib": { jobs: [] } });
    expect(await resolveAts("Doctolib", f)).toEqual(NO_ATS);
  });

  it("essaie la variante collée quand la variante tiretée échoue", async () => {
    const f = fauxFetch({ "api.lever.co/v0/postings/groupeseb": [{ id: "a" }] });
    expect(await resolveAts("Groupe SEB", f)).toEqual({ ats: "lever", slug: "groupeseb" });
  });

  it("renvoie none quand aucun candidat ne matche", async () => {
    expect(await resolveAts("Boulangerie Durand", fauxFetch({}))).toEqual(NO_ATS);
  });

  // Une panne réseau ne doit jamais remonter comme une exception à l'appelant.
  it("traite une erreur réseau comme un non-match", async () => {
    const f = (async () => { throw new Error("ECONNRESET"); }) as typeof fetch;
    expect(await resolveAts("Doctolib", f)).toEqual(NO_ATS);
  });

  it("renvoie none pour un nom vide sans appeler le réseau", async () => {
    let appels = 0;
    const f = (async () => { appels++; return new Response("", { status: 404 }); }) as typeof fetch;
    expect(await resolveAts("   ", f)).toEqual(NO_ATS);
    expect(appels).toBe(0);
  });
});
```

- [ ] **Step 2 : lancer le test pour vérifier qu'il échoue**

```bash
cd web && npx vitest run src/lib/jobs/ats.test.ts
```

Attendu : ÉCHEC — `resolveAts is not a function` (ou erreur d'import).

- [ ] **Step 3 : écrire l'implémentation minimale**

Ajouter à la fin de `web/src/lib/jobs/ats.ts` :

```ts
/** Coupe un endpoint qui ne répond pas : un ATS lent ne doit pas retenir le lot. */
const TIMEOUT_MS = 5_000;

/** True si la réponse décrit un board existant AVEC au moins une offre ouverte. */
async function aDesOffres(res: Response, ats: AtsProvider): Promise<boolean> {
  if (!res.ok) return false;
  try {
    const corps: unknown = await res.json();
    if (ats === "greenhouse") {
      const jobs = (corps as { jobs?: unknown })?.jobs;
      return Array.isArray(jobs) && jobs.length > 0;
    }
    return Array.isArray(corps) && corps.length > 0;
  } catch {
    return false;
  }
}

function url(ats: AtsProvider, slug: string): string {
  return ats === "greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
    : `https://api.lever.co/v0/postings/${slug}?mode=json`;
}

/**
 * Board public de l'entreprise, ou `NO_ATS`.
 *
 * `fetchImpl` est injectable pour que les tests tournent hors-ligne.
 * Cette fonction s'exécute **côté serveur** (route API) : appeler ces endpoints
 * depuis le navigateur dépendrait du bon vouloir CORS de deux services tiers.
 */
export async function resolveAts(
  companyName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AtsMatch> {
  for (const slug of atsSlugs(companyName)) {
    for (const ats of ["greenhouse", "lever"] as const) {
      try {
        const res = await fetchImpl(url(ats, slug), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (await aDesOffres(res, ats)) return { ats, slug };
      } catch {
        // Timeout, DNS, coupure : ce candidat ne matche pas, on passe au suivant.
      }
    }
  }
  return NO_ATS;
}
```

- [ ] **Step 4 : lancer le test pour vérifier qu'il passe**

```bash
cd web && npx vitest run src/lib/jobs/ats.test.ts
```

Attendu : 12 tests passés (5 de la Task 1 + 7 ici).

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/jobs/ats.ts web/src/lib/jobs/ats.test.ts
git commit -m "feat(ats): resolution d'une entreprise contre Greenhouse et Lever"
```

---

### Task 3 : route API de résolution par lot

**Files:**
- Create: `web/src/app/api/jobs/ats/route.ts`
- Référence à lire d'abord : `web/src/app/api/jobs/logos/route.ts` (même patron)

**Interfaces:**
- Consumes: `resolveAts`, `AtsMatch` (Task 2).
- Produces: `POST /api/jobs/ats` — corps `{ companies: string[] }`, réponse
  `{ ats: Record<string, { ats: "greenhouse" | "lever"; slug: string }> }`.
  Les entreprises sans ATS sont **absentes** de la réponse.

**Note sur les tests.** Le projet ne teste pas ses routes API unitairement
(aucun `route.test.ts` sous `src/app/api/` à l'exception de
`src/app/api/jobs/search/route.test.ts`, qui teste des helpers extraits, pas le
handler HTTP). Cette task n'ajoute donc pas de test : sa logique métier est déjà
couverte par la Task 2, et le handler ne fait que valider un corps JSON et
paralléliser. Vérification par typecheck + lint.

- [ ] **Step 1 : créer la route**

Créer `web/src/app/api/jobs/ats/route.ts` :

```ts
import { NextResponse } from "next/server";
import { resolveAts, type AtsProvider } from "@/lib/jobs/ats";

// Appels réseau sortants vers les boards publics : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Au-delà, c'est une liste de scan entière : on tronque plutôt que tout résoudre. */
const MAX_ENTREPRISES = 60;

/**
 * Détection de l'ATS d'un lot d'entreprises.
 *
 * Côté serveur, et pas dans le navigateur : les endpoints Greenhouse et Lever
 * sont publics mais leur en-tête CORS ne nous appartient pas. Même raison, même
 * patron que `/api/jobs/logos`.
 *
 * Réponse : `{ ats: { "<raison sociale>": { ats, slug } } }`, les entreprises
 * sans board confirmé étant simplement absentes.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const brut = (body as { companies?: unknown })?.companies;
  if (!Array.isArray(brut)) {
    return NextResponse.json({ error: "Champ 'companies' attendu." }, { status: 400 });
  }

  const companies = [
    ...new Set(brut.filter((c): c is string => typeof c === "string" && c.trim() !== "")),
  ].slice(0, MAX_ENTREPRISES);

  const resolus = await Promise.all(
    companies.map(async (nom) => [nom, await resolveAts(nom)] as const),
  );

  const ats: Record<string, { ats: AtsProvider; slug: string }> = {};
  for (const [nom, match] of resolus) {
    if (match.ats !== "none") ats[nom] = { ats: match.ats, slug: match.slug };
  }

  return NextResponse.json({ ats });
}
```

- [ ] **Step 2 : vérifier que le projet compile et passe le lint**

```bash
cd web && npx tsc --noEmit && npm run lint
```

Attendu : aucune erreur TypeScript, aucune erreur ESLint.

- [ ] **Step 3 : commit**

```bash
git add web/src/app/api/jobs/ats/route.ts
git commit -m "feat(ats): route API de resolution par lot"
```

---

### Task 4 : table Dexie et helpers de cache

**Files:**
- Modify: `web/src/lib/storage/db.ts`

**Interfaces:**
- Consumes: `AtsProvider` (Task 2).
- Produces:
  - `interface AtsDirectoryEntry { companyKey: string; ats: AtsProvider | "none"; slug: string; resolvedAt: number }`
  - `atsKey(companyName: string): string`
  - `getAtsEntry(companyKey: string): Promise<AtsDirectoryEntry | undefined>`
  - `saveAtsEntry(entry: AtsDirectoryEntry): Promise<void>`
  - `allAtsEntries(): Promise<AtsDirectoryEntry[]>`

- [ ] **Step 1 : ajouter le type et la table**

Dans `web/src/lib/storage/db.ts` :

Ajouter l'import en haut, à côté des autres imports de `@/lib/jobs/` :

```ts
import { normalizeCompany, type AtsProvider } from "@/lib/jobs/ats";
```

Ajouter le type juste après l'interface `JobEntry` (avant le commentaire
`// DB DEFINITION`) :

```ts
/**
 * Board public détecté pour une entreprise (feature « offres à la source »).
 *
 * Les entrées `"none"` sont conservées volontairement : savoir qu'une entreprise
 * a déjà été essayée sans succès évite de la retester à chaque affichage.
 */
export interface AtsDirectoryEntry {
  /** Nom d'entreprise normalisé — voir `atsKey`. Clé primaire. */
  companyKey: string;
  ats: AtsProvider | "none";
  /** Identifiant du board chez l'ATS ; "" quand `ats === "none"`. */
  slug: string;
  resolvedAt: number;
}
```

Déclarer la table dans la classe `AppDatabase`, à la suite de `commuteCache` :

```ts
  atsDirectory!: Table<AtsDirectoryEntry, string>; // Primary key: companyKey
```

Ajouter la version, à la suite du bloc `this.version(10)` :

```ts
    // v11 : annuaire entreprise → ATS. Pas d'upgrade : table neuve, et une
    // absence d'entrée signifie simplement « pas encore résolue ».
    this.version(11).stores({
      atsDirectory: "companyKey",
    });
```

- [ ] **Step 2 : ajouter les helpers**

Toujours dans `web/src/lib/storage/db.ts`, ajouter une section à la fin du
fichier :

```ts
// ---------------------------------------------------------------------------
// ANNUAIRE ATS (offres à la source)
// ---------------------------------------------------------------------------

/**
 * Clé de cache d'une entreprise. « Doctolib », « DOCTOLIB » et « doctolib » ne
 * doivent pas occuper trois lignes.
 *
 * Délègue à `normalizeCompany` : si la clé et le slug divergeaient, une
 * entreprise serait résolue en boucle sans jamais se retrouver en cache.
 */
export function atsKey(companyName: string): string {
  return normalizeCompany(companyName);
}

export async function getAtsEntry(companyKey: string): Promise<AtsDirectoryEntry | undefined> {
  try {
    return await db.atsDirectory.get(companyKey);
  } catch (e) {
    console.warn("getAtsEntry error:", e);
    return undefined;
  }
}

export async function saveAtsEntry(entry: AtsDirectoryEntry): Promise<void> {
  try {
    await db.atsDirectory.put(entry);
  } catch (e) {
    console.warn("saveAtsEntry error:", e);
  }
}

/** Tout l'annuaire, pour l'export. Entrées « none » comprises. */
export async function allAtsEntries(): Promise<AtsDirectoryEntry[]> {
  try {
    return await db.atsDirectory.toArray();
  } catch (e) {
    console.warn("allAtsEntries error:", e);
    return [];
  }
}
```

- [ ] **Step 3 : vérifier que le projet compile et que les tests passent**

```bash
cd web && npx tsc --noEmit && npm test
```

Attendu : aucune erreur TypeScript ; toute la suite Vitest au vert (aucun test
existant ne doit casser).

- [ ] **Step 4 : commit**

```bash
git add web/src/lib/storage/db.ts
git commit -m "feat(ats): table Dexie v11 et helpers de l'annuaire"
```

---

### Task 5 : export de l'annuaire

**Files:**
- Modify: `web/src/lib/storage/backup.ts`
- Modify: `web/src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `allAtsEntries`, `AtsDirectoryEntry` (Task 4), `db` (existant).
- Produces: `exportAtsDirectory(): Promise<void>`.

**Pourquoi deux mécanismes.** `exportDatabase` est le filet anti-perte de
l'app — la page `/settings` prévient déjà qu'un vidage de cache fait tout
perdre. L'annuaire doit y entrer, sinon il serait la seule donnée non
sauvegardée. L'export dédié répond à un autre besoin : sortir l'annuaire **seul**,
au format plat, pour l'agréger un jour dans une base partagée.

- [ ] **Step 1 : ajouter `atsDirectory` à la sauvegarde et à la restauration**

Dans `web/src/lib/storage/backup.ts` :

Dans `exportDatabase`, ajouter la ligne dans l'objet `data` (après `profile`) :

```ts
      atsDirectory: await db.atsDirectory.toArray(),
```

Dans `importDatabase`, ajouter `db.atsDirectory` à la liste des tables de la
transaction :

```ts
    await db.transaction("rw", [db.snapshots, db.drafts, db.history, db.jobs, db.templates, db.profile, db.atsDirectory], async () => {
```

puis, dans le bloc de purge, après `await db.profile.clear();` :

```ts
      await db.atsDirectory.clear();
```

et, dans le bloc de restauration, après la ligne `data.profile` :

```ts
      if (data.atsDirectory && data.atsDirectory.length > 0) await db.atsDirectory.bulkAdd(data.atsDirectory);
```

Dans `resetDatabase`, ajouter `db.atsDirectory` à la liste des tables de la
transaction et `await db.atsDirectory.clear();` après `await db.profile.clear();`.

- [ ] **Step 2 : ajouter l'export dédié**

Toujours dans `web/src/lib/storage/backup.ts`, ajouter l'import en haut :

```ts
import { db, allAtsEntries } from "./db";
```

(remplace l'import existant `import { db } from "./db";`)

Puis ajouter la fonction après `exportDatabase` :

```ts
/**
 * Annuaire entreprise → ATS, seul, au format plat.
 *
 * Distinct de `exportDatabase` : celui-ci est une sauvegarde personnelle, celui-là
 * un extrait destiné à être agrégé ailleurs. Le format est volontairement un
 * tableau d'objets simples, réimportable tel quel dans une base partagée le jour
 * où elle existera.
 */
export async function exportAtsDirectory(): Promise<void> {
  try {
    const entries = await allAtsEntries();
    if (entries.length === 0) {
      toast("Aucune entreprise résolue pour l'instant.", "error");
      return;
    }

    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `cvmatchr-annuaire-ats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    toast(`${entries.length} entreprises exportées.`, "success");
  } catch (error) {
    console.error("Export ATS failed:", error);
    toast("Erreur lors de l'exportation de l'annuaire.", "error");
  }
}
```

- [ ] **Step 3 : brancher le bouton dans les réglages**

Dans `web/src/app/settings/page.tsx` :

Étendre l'import de la ligne 5 :

```tsx
import { exportDatabase, exportAtsDirectory, importDatabase, resetDatabase } from "@/lib/storage/backup";
```

Dans la section « Gestion des données », juste après le `</div>` qui ferme le
bloc « Exporter les données » (celui contenant le bouton `onClick={exportDatabase}`),
insérer un séparateur et un nouveau bloc, en copiant exactement le style des
blocs voisins :

```tsx
              <div style={{ height: "1px", background: "var(--border)" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "12px 0" }}>
                <div className="form-field">
                  <div className="form-label">Exporter l&apos;annuaire ATS</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "400px" }}>Les entreprises dont le site carrières a été identifié, dans un fichier JSON réutilisable.</div>
                </div>
                <button type="button" className="btn-nav" onClick={exportAtsDirectory}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Exporter
                </button>
              </div>
```

- [ ] **Step 4 : vérifier que le projet compile, lint et teste**

```bash
cd web && npx tsc --noEmit && npm run lint && npm test
```

Attendu : aucune erreur TypeScript, aucune erreur ESLint, suite Vitest au vert.

- [ ] **Step 5 : commit**

```bash
git add web/src/lib/storage/backup.ts web/src/app/settings/page.tsx
git commit -m "feat(ats): export de l'annuaire et prise en compte dans la sauvegarde"
```

---

### Task 6 : résolution en tâche de fond et affichage sur la carte

**Files:**
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/components/jobs/JobCard.tsx`

**Interfaces:**
- Consumes: `atsKey`, `getAtsEntry`, `saveAtsEntry`, `AtsDirectoryEntry` (Task 4) ;
  route `POST /api/jobs/ats` (Task 3).
- Produces: prop `atsLink?: { ats: "greenhouse" | "lever"; slug: string }` sur `JobCard`.

**Patron à suivre.** `completerLogos` dans `JobsView.tsx` (autour de la ligne 105)
fait exactement ce déroulé : collecter les entreprises inconnues, un seul appel
POST, mémoriser les échecs pour ne pas redemander. Lis-la avant d'écrire.

- [ ] **Step 1 : ajouter le lien dans `JobCard`**

Dans `web/src/components/jobs/JobCard.tsx`, ajouter la prop à la signature du
composant (après `onCommute`) :

```tsx
  /** Board public de l'entreprise, si détecté. Absent = rien à afficher. */
  atsLink?: { ats: "greenhouse" | "lever"; slug: string };
```

et à la déstructuration de la première ligne :

```tsx
  job, onAdapt, onApply, onTrack, onDismiss, onSeen, onCommute, atsLink,
```

Ajouter, juste avant le `return`, l'URL du board :

```tsx
  // Les offres du board de l'entreprise échappent souvent aux jobboards saturés :
  // c'est le seul intérêt de ce lien, donc il n'apparaît que s'il mène quelque part.
  const boardUrl = !atsLink
    ? ""
    : atsLink.ats === "greenhouse"
      ? `https://job-boards.greenhouse.io/${atsLink.slug}`
      : `https://jobs.lever.co/${atsLink.slug}`;
```

Puis, dans le `<div className="job-facts">`, après la puce `commute`, ajouter :

```tsx
        {boardUrl ? (
          <a className="job-fact job-fact--board" href={boardUrl} target="_blank"
            rel="noopener noreferrer" data-testid="job-ats-link">
            Offres directes chez {job.company}
          </a>
        ) : null}
```

- [ ] **Step 2 : déclencher la résolution dans `JobsView`**

Dans `web/src/components/jobs/JobsView.tsx` :

Ajouter aux imports depuis `@/lib/storage/db` : `atsKey`, `getAtsEntry`,
`saveAtsEntry` (ajoute-les à l'import existant, ne crée pas un second import).

Ajouter un état, à côté des autres `useState` (vers la ligne 46) :

```tsx
  const [atsParEntreprise, setAtsParEntreprise] = useState<Record<string, { ats: "greenhouse" | "lever"; slug: string }>>({});
```

Ajouter la fonction, juste après `completerLogos` :

```tsx
  /**
   * Détecte le board public des entreprises affichées, une seule fois chacune.
   *
   * Même déroulé que `completerLogos` : ce qui est déjà en base n'est jamais
   * redemandé, échecs compris — sans ça une entreprise sans ATS serait
   * réinterrogée à chaque affichage de la liste.
   */
  async function completerAts(liste: JobEntry[]) {
    const entreprises = [...new Set(liste.map((j) => j.company).filter((c) => c.trim()))];

    const connues: Record<string, { ats: "greenhouse" | "lever"; slug: string }> = {};
    const inconnues: string[] = [];
    for (const nom of entreprises) {
      const entree = await getAtsEntry(atsKey(nom));
      if (!entree) inconnues.push(nom);
      else if (entree.ats !== "none") connues[nom] = { ats: entree.ats, slug: entree.slug };
    }

    if (inconnues.length > 0) {
      try {
        const res = await fetch("/api/jobs/ats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: inconnues }),
        });
        if (res.ok) {
          const { ats } = (await res.json()) as {
            ats?: Record<string, { ats: "greenhouse" | "lever"; slug: string }>;
          };
          for (const nom of inconnues) {
            const trouve = ats?.[nom];
            await saveAtsEntry({
              companyKey: atsKey(nom),
              ats: trouve?.ats ?? "none",
              slug: trouve?.slug ?? "",
              resolvedAt: Date.now(),
            });
            if (trouve) connues[nom] = trouve;
          }
        }
      } catch {
        // Un board non détecté ne doit jamais remonter comme une panne.
      }
    }

    setAtsParEntreprise((actuels) => ({ ...actuels, ...connues }));
  }
```

Appeler `completerAts` juste après l'appel existant `void completerLogos(liste);`
(ligne ~90), sans `await` : l'affichage ne doit pas attendre la résolution.

```tsx
    void completerLogos(liste);
    void completerAts(liste);
```

Enfin, passer la prop à la carte (ligne ~396) :

```tsx
            <JobCard key={job.id} job={job} onAdapt={adapt} onApply={apply} onTrack={track} onDismiss={dismiss} onSeen={seen} onCommute={loadCommute} atsLink={atsParEntreprise[job.company]} />
```

- [ ] **Step 3 : ajouter le style de la puce**

Dans `web/src/app/globals.css`, à la suite de la règle `.job-fact--commute`
(cherche-la : `grep -n "job-fact--commute" src/app/globals.css`), ajouter :

```css
/* Lien vers le board public de l'entreprise : c'est une puce cliquable, pas un
   fait — la couleur d'accent la distingue sans ajouter de bouton à la carte. */
.job-fact--board {
  color: var(--orange);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.job-fact--board:hover {
  border-bottom-color: var(--orange);
}
```

- [ ] **Step 4 : vérifier compilation, lint et tests**

```bash
cd web && npx tsc --noEmit && npm run lint && npm test
```

Attendu : aucune erreur TypeScript, aucune erreur ESLint, suite Vitest au vert
(notamment `src/components/jobs/JobCard.test.tsx`, qui ne passe pas `atsLink` et
doit continuer à passer puisque la prop est optionnelle).

- [ ] **Step 5 : vérification manuelle dans le navigateur**

```bash
cd web && npm run dev
```

Ouvrir `/jobs`, lancer un scan, et vérifier dans l'onglet Réseau qu'un `POST
/api/jobs/ats` part avec la liste des entreprises et revient `200`. Recharger la
page : **aucun second appel** ne doit partir pour les mêmes entreprises (le cache
Dexie joue). Coller dans le rapport la capture ou le résumé des deux passages.

- [ ] **Step 6 : commit**

```bash
git add web/src/components/jobs/JobsView.tsx web/src/components/jobs/JobCard.tsx web/src/app/globals.css
git commit -m "feat(ats): detection en tache de fond et lien vers le board sur la carte"
```

---

### Task 7 : vérification finale et documentation

**Files:**
- Modify: `WORK_HISTORY.md` (racine)
- Modify: `PROJECT_INDEX.md` (racine)

- [ ] **Step 1 : lancer la vérification complète**

```bash
cd web && npm test && npm run lint && npm run build
```

Attendu : suite Vitest au vert, aucune erreur ESLint, build Next.js réussi.
`npm run build` fait le typecheck complet — Vitest ne typecheck pas, c'est la
seule commande qui prouve que le TypeScript tient.

- [ ] **Step 2 : mettre à jour `PROJECT_INDEX.md`**

Ajouter `web/src/lib/jobs/ats.ts` et `web/src/app/api/jobs/ats/route.ts` à la
carte des fichiers, et mentionner la table Dexie `atsDirectory` (v11) dans la
section du modèle de données, à côté de `commuteCache`.

- [ ] **Step 3 : écrire l'entrée de journal**

Ajouter une entrée datée en tête de la section `## Journal` de `WORK_HISTORY.md` :
ce qui a été fait, pourquoi (trouver les offres à la source, moins de
concurrence que sur les jobboards), fichiers touchés, résultat des vérifications.
Mettre à jour la ligne « Prochaine étape suggérée » de la section « État actuel »
avec : « Phase 2 du détecteur d'ATS — récupérer les offres depuis les boards
détectés ». Ne rien modifier d'autre dans ce fichier.

- [ ] **Step 4 : commit**

```bash
git add WORK_HISTORY.md PROJECT_INDEX.md
git commit -m "docs(ats): journal et index apres la phase 1 du detecteur"
```

---

## Hors scope (ne pas implémenter)

- Récupération effective des offres depuis les boards détectés (Phase 2).
- Annuaire partagé, base serveur, synchronisation entre utilisateurs.
- Autres ATS (Workable, Ashby, SmartRecruiters…).
- Revérification périodique des entrées `"none"`.

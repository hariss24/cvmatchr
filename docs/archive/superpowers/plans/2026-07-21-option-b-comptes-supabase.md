# Option B — Comptes utilisateurs + BDD serveur (profil Offres par compte) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque utilisateur a un compte (email + mot de passe) et son propre profil de recherche d'offres stocké en Postgres ; plus aucune donnée personnelle codée en dur.

**Architecture:** Supabase (Auth + Postgres + RLS) via `@supabase/ssr`. Le profil `JobSearchProfile` est validé par un schéma Zod unique et stocké en `jsonb` dans `job_profiles` (1 ligne par utilisateur, RLS). `resolveProfile()` devient asynchrone et lit la session ; sans Supabase configuré, l'app garde le **mode local** (profil dans Dexie, envoyé dans le corps des requêtes). Le formulaire « Mes critères » sur la page Offres écrit vers `/api/jobs/profile` (session) ou Dexie (local).

**Portabilité (exigence France Travail / self-host) :** tout le SQL est en migrations standard (`supabase/migrations/*.sql`, Postgres pur), l'accès aux données passe par un module unique `lib/server/supabase.ts`, et l'auth est encapsulée dans `lib/server/session.ts` (une seule fonction `getUserId()`). Supabase est open source et self-hostable ; remplacer l'auth par un SSO d'entreprise (OIDC) ne touchera que `session.ts` et le middleware.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Zod, Dexie (fallback local), `@supabase/supabase-js` + `@supabase/ssr`, Vitest.

## Global Constraints

- ⚠️ Next.js 16 : lire `web/node_modules/next/dist/docs/` (middleware, cookies, server actions) avant d'écrire du code SSR — breaking changes vs connaissances d'entraînement.
- Jamais de `alert/confirm/prompt` natifs → `uiAlert`/`uiConfirm`/`uiPrompt` (`src/state/uiStore.ts`).
- Jamais de couleur en dur dans l'UI → variables CSS de `src/app/globals.css`.
- La clé `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être importée dans un fichier client (`"use client"`).
- Aucune donnée personnelle de Hariss ne doit rester dans `web/src` à la fin (critère : `grep -ri "hariss\|jean bouton" web/src` vide, hors fixtures de tests).
- Vérification par tâche : `npx tsc --noEmit`, `npm run lint`, `npm test` (depuis `web/`).
- Commits fréquents, messages en français, préfixes `feat:`/`refactor:`/`chore:`.

---

### Task 1: Schéma Zod du profil + défauts neutres + fixture Hariss

**Files:**
- Modify: `web/src/lib/jobs/profile.ts`
- Create: `web/tests/fixtures/job_profile_hariss.json`
- Modify: `web/src/lib/jobs/score.test.ts`, `web/src/lib/jobs/francetravail.test.ts`
- Test: `web/src/lib/jobs/profile.test.ts`

**Interfaces:**
- Produces: `jobSearchProfileSchema` (Zod, `.parse()` → `JobSearchProfile`), `EMPTY_PROFILE: JobSearchProfile`, `isProfileUsable(p): boolean` (adresse non vide ET ≥ 1 keyword). `DEFAULT_PROFILE` est **supprimé**.

- [ ] **Step 1: Écrire le test qui échoue** (`profile.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { jobSearchProfileSchema, EMPTY_PROFILE, isProfileUsable } from "./profile";

describe("jobSearchProfileSchema", () => {
  it("applique les défauts neutres sur un objet vide", () => {
    const p = jobSearchProfileSchema.parse({});
    expect(p).toEqual(EMPTY_PROFILE);
    expect(p.homeAddress).toBe("");
    expect(p.keywords).toEqual([]);
    expect(p.minScore).toBe(70);
    expect(p.maxAgeDays).toBe(30);
    expect(p.aiShortlist).toBe(20);
  });
  it("rejette les types invalides", () => {
    expect(() => jobSearchProfileSchema.parse({ minScore: "haut" })).toThrow();
  });
  it("isProfileUsable exige adresse + au moins un mot-clé", () => {
    expect(isProfileUsable(EMPTY_PROFILE)).toBe(false);
    expect(isProfileUsable({ ...EMPTY_PROFILE, homeAddress: "1 rue x", keywords: ["SEO"] })).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -- profile.test` → FAIL (`jobSearchProfileSchema` inexistant).

- [ ] **Step 3: Implémenter dans `profile.ts`**

Garder les types existants (`CommuteMode`, `ScoringCriterion`, `JobSearchProfile`). Ajouter :

```ts
import { z } from "zod";

const criterionSchema = z.object({
  key: z.string(), label: z.string(), max: z.number().int().positive(), description: z.string(),
});

export const jobSearchProfileSchema = z.object({
  homeAddress: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  commuteModes: z.array(z.enum(["transit", "driving", "bicycling", "walking"])).default(["transit"]),
  contractTypes: z.array(z.string()).default(["CDI", "CDD"]),
  region: z.string().default("11"),
  maxAgeDays: z.number().int().positive().default(30),
  excludedWords: z.array(z.string()).default(["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"]),
  minScore: z.number().int().min(0).max(100).default(70),
  maxDescriptionChars: z.number().int().positive().default(3000),
  candidateSummary: z.string().default(""),
  scoringCriteria: z.array(criterionSchema).default([
    { key: "tech", label: "Technique", max: 40, description: "Match avec les compétences du candidat." },
    { key: "seniority", label: "Séniorité", max: 20, description: "Adéquation avec le niveau d'expérience." },
    { key: "sector", label: "Secteur", max: 15, description: "Pertinence du secteur d'activité." },
    { key: "geo", label: "Géo (trajet)", max: 15, description: "Ajuste avec les temps de trajet fournis." },
    { key: "red_flags", label: "Pièges", max: 10, description: "10 = aucun piège (salaire flou, alternance masquée…)." },
  ]),
  prefilterKeywords: z.array(z.string()).default([]),
  aiShortlist: z.number().int().positive().default(20),
});

export const EMPTY_PROFILE: JobSearchProfile = jobSearchProfileSchema.parse({});

export function isProfileUsable(p: JobSearchProfile): boolean {
  return p.homeAddress.trim() !== "" && p.keywords.length > 0;
}
```

Supprimer `DEFAULT_PROFILE` (les valeurs de Hariss partent dans la fixture). Copier l'objet actuel `DEFAULT_PROFILE` tel quel en JSON dans `web/tests/fixtures/job_profile_hariss.json`.

- [ ] **Step 4: Adapter les tests existants** — dans `score.test.ts` et `francetravail.test.ts`, remplacer `import { DEFAULT_PROFILE } from "./profile"` par :

```ts
import { jobSearchProfileSchema } from "./profile";
import harissFixture from "../../../tests/fixtures/job_profile_hariss.json";
const DEFAULT_PROFILE = jobSearchProfileSchema.parse(harissFixture);
```

- [ ] **Step 5: Vérifier** — `npm test` PASS, `npx tsc --noEmit` OK (corriger tout usage restant de `DEFAULT_PROFILE`, cf. Task 2 pour `resolveProfile`).
- [ ] **Step 6: Commit** — `refactor(jobs): schéma Zod du profil, défauts neutres, profil Hariss en fixture`

---

### Task 2: `resolveProfile` par corps de requête + table Dexie `jobProfile` (mode local)

**Files:**
- Modify: `web/src/lib/jobs/resolveProfile.ts`
- Modify: `web/src/lib/storage/db.ts`
- Modify: `web/src/app/api/jobs/search/route.ts` (ligne 24), `web/src/app/api/jobs/score/route.ts` (ligne 40)
- Modify: `web/src/app/jobs/page.tsx`, `web/src/components/jobs/JobsView.tsx`
- Test: `web/src/lib/jobs/resolveProfile.test.ts`

**Interfaces:**
- Consumes: `jobSearchProfileSchema`, `EMPTY_PROFILE` (Task 1).
- Produces: `resolveProfile(req: Request): Promise<JobSearchProfile>` (async — lit `profile` dans le corps JSON, défauts Zod sinon) ; Dexie v7 table `jobProfile: "id"` + `getJobProfile(): Promise<JobSearchProfile>` / `saveJobProfile(p): Promise<void>`.

- [ ] **Step 1: Test qui échoue** (`resolveProfile.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { resolveProfile } from "./resolveProfile";
import { EMPTY_PROFILE } from "./profile";

function post(body: unknown): Request {
  return new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("resolveProfile", () => {
  it("lit le profil du corps de requête", async () => {
    const p = await resolveProfile(post({ profile: { homeAddress: "1 rue y", keywords: ["SEO"] } }));
    expect(p.homeAddress).toBe("1 rue y");
    expect(p.minScore).toBe(70); // défaut appliqué
  });
  it("retombe sur les défauts neutres sans profil", async () => {
    expect(await resolveProfile(post({}))).toEqual(EMPTY_PROFILE);
  });
  it("ignore un profil invalide (défauts)", async () => {
    expect(await resolveProfile(post({ profile: { minScore: "x" } }))).toEqual(EMPTY_PROFILE);
  });
});
```

- [ ] **Step 2: FAIL attendu** (`resolveProfile` synchrone, ignore le corps).
- [ ] **Step 3: Implémenter**

```ts
import { EMPTY_PROFILE, jobSearchProfileSchema, type JobSearchProfile } from "./profile";

/** Mode local : profil dans le corps. Task 6 ajoutera la résolution par session Supabase. */
export async function resolveProfile(req?: Request): Promise<JobSearchProfile> {
  if (!req) return EMPTY_PROFILE;
  try {
    const body = await req.clone().json();
    const parsed = jobSearchProfileSchema.safeParse(body?.profile ?? {});
    return parsed.success ? parsed.data : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}
```

Routes : `const profile = await resolveProfile(req);`. Attention `score/route.ts` lit déjà le corps → utiliser `req.clone()` dans `resolveProfile` (fait ci-dessus) pour ne pas consommer le flux.

Dexie (`db.ts`) — nouvelle version après la v6 existante :

```ts
// v7 : profil de recherche d'offres éditable (singleton id="job").
this.version(7).stores({ jobProfile: "id" });
```

```ts
import { EMPTY_PROFILE, jobSearchProfileSchema, type JobSearchProfile } from "@/lib/jobs/profile";

export async function getJobProfile(): Promise<JobSearchProfile> {
  const row = await db.table("jobProfile").get("job");
  const parsed = jobSearchProfileSchema.safeParse(row?.profile ?? {});
  return parsed.success ? parsed.data : EMPTY_PROFILE;
}
export async function saveJobProfile(profile: JobSearchProfile): Promise<void> {
  await db.table("jobProfile").put({ id: "job", profile });
}
```

`JobsView` : charger le profil (`getJobProfile()`) au montage, l'envoyer dans le corps de `POST /api/jobs/search` (`body: JSON.stringify({ profile })`) et de chaque `POST /api/jobs/score` (`{ offer, profile }`), et calculer `minScore`/`prefilterKeywords`/`aiShortlist`/`criteria` depuis ce profil (la prop `config` serveur disparaît). `app/jobs/page.tsx` ne résout plus de profil (supprimer l'import et la prop).

- [ ] **Step 4: Vérifier** — `npm test`, `npx tsc --noEmit`, `npm run lint` verts.
- [ ] **Step 5: Commit** — `feat(jobs): profil transmis par requête + stockage local Dexie (v7)`

---

### Task 3: UI « Mes critères » (`ProfileForm`)

**Files:**
- Create: `web/src/components/jobs/ProfileForm.tsx`
- Modify: `web/src/components/jobs/JobsView.tsx`, `web/src/app/globals.css` (si classes manquantes)

**Interfaces:**
- Consumes: `getJobProfile`/`saveJobProfile` (Task 2), `isProfileUsable` (Task 1), `toast` (`@/state/uiStore`).
- Produces: `<ProfileForm profile={JobSearchProfile} onSave={(p: JobSearchProfile) => void} />` — panneau repliable en tête de page Offres.

- [ ] **Step 1: Implémenter le composant** (client). Structure :
  - `<details className="panel">` repliable « ⚙️ Mes critères de recherche » (ouvert automatiquement si `!isProfileUsable(profile)`).
  - Champs essentiels : adresse (input), mots-clés de poste (textarea, un par ligne), types de contrat (checkboxes CDI/CDD/MIS), région (select des codes France Travail, libellés des 13 régions métropolitaines + DOM), modes de transport (checkboxes transit/driving/bicycling/walking), ancienneté max (number), score minimum (number 0-100).
  - `<details>` imbriqué « Avancé » : mots exclus, mots-clés de pré-tri, résumé candidat (textarea), barème (lignes label/max/description éditables), aiShortlist, maxDescriptionChars.
  - Bouton « Enregistrer » → `jobSearchProfileSchema.parse` du state → `onSave(p)` → `toast("Critères enregistrés.")`.
  - Réutiliser les classes existantes du design system (`panel`, `btn`, `input`… — vérifier dans `globals.css` et copier le pattern d'un formulaire existant, ex. `TemplateEditorPanel`).
- [ ] **Step 2: Brancher dans `JobsView`** — état `profile` remonté ; `onSave` = `saveJobProfile` + setState ; bouton « Scanner » désactivé avec message si `!isProfileUsable(profile)`.
- [ ] **Step 3: Vérification manuelle** (dev server) : profil vide → panneau ouvert + scan désactivé ; saisie + enregistrer + F5 → valeurs conservées ; scan fonctionne avec les critères saisis.
- [ ] **Step 4: `npx tsc --noEmit`, `npm run lint`** verts.
- [ ] **Step 5: Commit** — `feat(jobs): formulaire « Mes critères de recherche » (essentiel + avancé)`

---

### Task 4: Infra Supabase (projet, migration SQL, clients)

**Files:**
- Create: `web/supabase/migrations/0001_job_profiles.sql`
- Create: `web/src/lib/server/supabase.ts`
- Create: `web/src/lib/server/session.ts`
- Modify: `web/.env.example` (ou README section env), `web/package.json`

**Interfaces:**
- Produces: `hasSupabase(): boolean` (vars présentes) ; `createSupabaseServerClient()` (client SSR lié aux cookies de la requête) ; `getUserId(): Promise<string | null>` — **seul point d'entrée auth** pour le reste du code (portabilité SSO).

- [ ] **Step 1: Dépendances** — `cd web && npm i @supabase/supabase-js @supabase/ssr`
- [ ] **Step 2: Migration SQL** (`0001_job_profiles.sql`) — Postgres standard, rejouable sur n'importe quelle instance (portabilité France Travail) :

```sql
create table if not exists public.job_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.job_profiles enable row level security;

create policy "own profile select" on public.job_profiles
  for select using (auth.uid() = user_id);
create policy "own profile upsert" on public.job_profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.job_profiles
  for update using (auth.uid() = user_id);
```

- [ ] **Step 3: Clients** (`lib/server/supabase.ts`) — suivre la doc `@supabase/ssr` pour Next.js App Router (cookies via `next/headers`) :

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );
}
```

`lib/server/session.ts` :

```ts
import { createSupabaseServerClient, hasSupabase } from "./supabase";

/** Point unique d'identité. Remplacer ce fichier suffit pour brancher un SSO (OIDC) d'entreprise. */
export async function getUserId(): Promise<string | null> {
  if (!hasSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
```

⚠️ Vérifier l'API exacte (`cookies()` async, options `setAll`) dans `node_modules/next/dist/docs/` et la doc @supabase/ssr courante avant d'écrire — c'est le point le plus susceptible d'avoir changé.

- [ ] **Step 4: Documenter les variables** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans `web/README.md` (section variables d'env), avec la phrase : « absentes → mode local sans compte ».
- [ ] **Step 5: Vérifier** — `npx tsc --noEmit`, `npm run lint`, `npm run build` verts (sans les vars → `hasSupabase()` false, rien ne casse).
- [ ] **Step 6: Commit** — `feat(auth): infra Supabase (migration job_profiles + clients SSR + point d'identité unique)`

*(Action manuelle hors code, à faire par Hariss : créer le projet sur supabase.com, exécuter la migration via l'éditeur SQL ou `supabase db push`, copier les 2 clés dans `.env.local` et Vercel.)*

---

### Task 5: Pages login/signup + middleware par session

**Files:**
- Modify: `web/src/app/login/page.tsx` (et son composant client)
- Create: `web/src/app/api/auth/route.ts` (login/signup/logout via Supabase)
- Modify: `web/src/middleware.ts`
- Modify: `web/src/components/layout/SegmentedNav.tsx` (ou TopBar : bouton déconnexion si session)

**Interfaces:**
- Consumes: `hasSupabase()`, `createSupabaseServerClient()` (Task 4).
- Produces: parcours complet email+mot de passe (inscription, connexion, déconnexion). Middleware : si `hasSupabase()` → protéger toutes les pages/API (sauf `/login`, `/api/auth`, assets) par session Supabase ; sinon → **comportement actuel inchangé** (mot de passe partagé optionnel).

- [ ] **Step 1: Route auth** — `POST /api/auth` avec `{ action: "login" | "signup" | "logout", email?, password? }`, utilisant `supabase.auth.signInWithPassword` / `signUp` / `signOut`. Les cookies de session sont posés par le client SSR. Réponses : 200 `{ ok: true }`, 401 message d'erreur en français.
- [ ] **Step 2: Page login** — réutiliser la page `/login` existante : deux onglets (Connexion / Créer un compte), champs email + mot de passe, soumission vers `/api/auth`, redirection `/` en succès. Conserver l'ancien formulaire mot-de-passe partagé si `hasSupabase()` est faux (le serveur passe l'info via props).
- [ ] **Step 3: Middleware** — au début : si vars Supabase présentes, vérifier la session (pattern officiel `@supabase/ssr` pour middleware : `createServerClient` avec `req.cookies`, `supabase.auth.getUser()`, refresh des cookies sur la réponse) ; sans session → redirect `/login` (401 JSON pour `/api/*`). Si vars absentes → code actuel (REMOTE_AUTH_PASSWORD) intact. Exclure `/login`, `/api/auth`, `/api/login`, assets.
- [ ] **Step 4: Déconnexion** — bouton dans la TopBar (visible seulement si session), `POST /api/auth {action:"logout"}` puis redirect `/login`.
- [ ] **Step 5: Vérification manuelle** — avec vars : signup → session → accès app ; navigation privée sans session → redirect ; logout → redirect. Sans vars : app locale inchangée.
- [ ] **Step 6: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`** verts.
- [ ] **Step 7: Commit** — `feat(auth): login/signup Supabase + middleware par session (fallback mot de passe local)`

---

### Task 6: Profil par compte — route `/api/jobs/profile` + résolution par session

**Files:**
- Create: `web/src/app/api/jobs/profile/route.ts`
- Modify: `web/src/lib/jobs/resolveProfile.ts`
- Modify: `web/src/components/jobs/JobsView.tsx` (chargement/sauvegarde selon le mode)
- Test: compléter `web/src/lib/jobs/resolveProfile.test.ts`

**Interfaces:**
- Consumes: `getUserId()` (Task 4), `jobSearchProfileSchema` (Task 1), `getJobProfile`/`saveJobProfile` Dexie (Task 2).
- Produces: `GET /api/jobs/profile` → `{ profile }` (ou `{ profile: null }` sans session) ; `PUT /api/jobs/profile` corps `{ profile }` → upsert RLS ; `resolveProfile(req)` : session → BDD, sinon corps de requête.

- [ ] **Step 1: Route**

```ts
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/server/session";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { jobSearchProfileSchema } from "@/lib/jobs/profile";

export async function GET(): Promise<Response> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ profile: null });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("job_profiles").select("profile").eq("user_id", userId).maybeSingle();
  const parsed = jobSearchProfileSchema.safeParse(data?.profile ?? {});
  return NextResponse.json({ profile: parsed.success ? parsed.data : null });
}

export async function PUT(req: Request): Promise<Response> {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = jobSearchProfileSchema.safeParse(body?.profile);
  if (!parsed.success) return NextResponse.json({ error: "Profil invalide." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("job_profiles")
    .upsert({ user_id: userId, profile: parsed.data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: `resolveProfile`** — ajouter la branche session AVANT le corps :

```ts
export async function resolveProfile(req?: Request): Promise<JobSearchProfile> {
  const userId = await getUserId();
  if (userId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("job_profiles").select("profile").eq("user_id", userId).maybeSingle();
    const parsed = jobSearchProfileSchema.safeParse(data?.profile ?? {});
    if (parsed.success) return parsed.data;
  }
  // …branche corps de requête existante (Task 2)
}
```

(Tests unitaires : mocker `getUserId` → null pour garder les tests Task 2 verts ; ajouter un test avec `getUserId` mocké → id et supabase mocké.)

- [ ] **Step 3: `JobsView`/`ProfileForm`** — au montage : `GET /api/jobs/profile` ; si `profile` non nul → mode compte (sauvegarde via PUT) ; si nul → mode local (Dexie, corps de requête). **Import doux** : en mode compte avec profil BDD vide mais profil Dexie utilisable → `uiConfirm("Importer vos critères enregistrés sur cet appareil dans votre compte ?")` → PUT.
- [ ] **Step 4: Vérifications** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Manuel : 2 comptes → critères isolés ; RLS : requête REST authentifiée compte A vers la ligne du compte B → 0 ligne.
- [ ] **Step 5: Commit** — `feat(jobs): profil de recherche par compte (route profile + resolveProfile par session)`

---

### Task 7: Purge des données en dur + docs

**Files:**
- Modify: `PROJECT_INDEX.md` (§8 Offres, §9 Authentification), `web/README.md`, `WORK_HISTORY.md`, `TODO.md`

- [ ] **Step 1: Grep final** — `grep -ri "hariss\|jean bouton" web/src` → zéro (la fixture `web/tests/fixtures/` est le seul emplacement autorisé).
- [ ] **Step 2: Docs** — PROJECT_INDEX : décrire profil paramétrable + auth Supabase + mode local ; README : variables d'env ; WORK_HISTORY : entrée datée.
- [ ] **Step 3: Suite complète** — `npm test && npx tsc --noEmit && npm run lint && npm run build` verts.
- [ ] **Step 4: Commit** — `docs: profil Offres paramétrable + comptes Supabase (option B)`

---

## Self-Review (fait)

- Couverture : dé-hardcoder (T1-T3), comptes (T4-T5), profil par compte (T6), purge/docs (T7). Les offres par compte (`db.jobs` → Postgres) restent volontairement hors périmètre (Phase 3 du plan général).
- Cohérence des types : `resolveProfile` async partout (T2 introduit, T6 étend) ; `jobSearchProfileSchema` unique, importé par routes/Dexie/formulaire.
- Point de vigilance signalé aux exécutants : API `@supabase/ssr` + `cookies()` de Next 16 à vérifier dans la doc embarquée avant d'écrire (T4/T5).

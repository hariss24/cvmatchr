# Tracker de candidatures « Mes candidatures » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page `/history` par une page `/candidatures` qui suit les candidatures avec un statut dérivé des dates (zéro maintenance), récupère le dashboard de `/settings`, et offre un rayon « Mes CV » pour les documents non rattachés.

**Architecture :** Toute la logique décisionnelle vit dans des modules **purs** sous `web/src/lib/applications/` (aucun import de Dexie, de React ni de `Date.now()` implicite : `now` est toujours un paramètre). `store.ts` est la seule couche qui parle à Dexie et se contente d'appliquer les décisions calculées par les modules purs. Les composants React sous `web/src/components/applications/` ne font que de l'affichage. Ce découpage est imposé par une contrainte du projet : **il n'y a ni `jsdom` ni `fake-indexeddb` dans les devDependencies**, donc seul du code pur est testable par Vitest.

**Tech Stack :** Next.js (version du repo — lire `node_modules/next/dist/docs/` avant d'écrire du code de routage), React 19, Zustand (`docStore`, `settingsStore`, `uiStore`), Dexie 4 (IndexedDB), Vitest, CSS natif avec variables de thème dans `web/src/app/globals.css`.

## Global Constraints

- Toutes les commandes se lancent depuis `web/` : `npm test`, `npm run lint`, `npm run build`.
- **Vérification obligatoire avant de déclarer une tâche finie :** `npm test` ET `npm run build` (Vitest ne typecheck pas ; le build fait le typecheck strict).
- **Jamais** `alert` / `confirm` / `prompt` natifs : utiliser `uiAlert` / `uiConfirm` / `uiPrompt` de `@/state/uiStore`, et `toast` pour les notifications.
- **Aucune couleur en dur** dans le CSS : uniquement les variables de `globals.css` (`--bg`, `--text`, `--muted`, `--faint`, `--card`, `--border`, `--field`, `--orange-text`, `--apply-text`, `--warning`, `--error`, `--neu-raised-sm`, `--neu-raised`, `--neu-inset`, `--glass`…). Le thème sombre doit fonctionner sans règle supplémentaire, sauf pour les `box-shadow` littérales qui suivent le motif `[data-theme="dark"] .classe { … }` déjà utilisé dans le fichier.
- **Piège documenté du projet :** `docStore.html === ""` dans le pipeline actif. Ne jamais tester `if (!html)` ni dédoublonner sur `html`/`css`.
- Les fonctions d'accès Dexie encapsulent leurs erreurs (`try/catch` + `console.warn` + valeur de repli), comme tout `web/src/lib/storage/db.ts`.
- Le `DocType` du projet vaut `"CV" | "Lettre"` uniquement (le type `"Autre"` a été supprimé en v3).
- La maquette de référence est `docs/design/candidatures/prototype.html` (cliquable) et `page-light.html` / `page-dark.html`. Le CSS des tâches 8 et 9 est repris de ce prototype.
- Spec de référence : `docs/superpowers/specs/2026-07-25-tracker-candidatures-design.md`.

---

### Task 1 : Normalisation de la clé de dédoublonnage

**Files:**
- Create: `web/src/lib/applications/normKey.ts`
- Test: `web/src/lib/applications/normKey.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `normKey(company: string, role: string): string` — retourne `""` si les deux champs sont vides après normalisation.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/applications/normKey.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { normKey } from "./normKey";

describe("normKey", () => {
  it("ignore la casse et les accents", () => {
    expect(normKey("Société Générale", "Chargé d'Études")).toBe(
      normKey("societe generale", "charge d etudes"),
    );
  });

  it("ignore la ponctuation et les espaces multiples", () => {
    expect(normKey("Leroy-Merlin", "Chef   de projet !")).toBe(
      normKey("Leroy Merlin", "chef de projet"),
    );
  });

  it("sépare entreprise et poste pour éviter les collisions", () => {
    expect(normKey("Alpha", "Beta")).not.toBe(normKey("Beta", "Alpha"));
  });

  it("retourne une clé vide quand entreprise et poste sont vides", () => {
    expect(normKey("", "")).toBe("");
    expect(normKey("   ", "  ")).toBe("");
  });

  it("retourne une clé non vide si un seul des deux champs est rempli", () => {
    expect(normKey("Manpower", "")).not.toBe("");
    expect(normKey("", "Cariste")).not.toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/applications/normKey.test.ts`
Expected: FAIL — `Failed to resolve import "./normKey"`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/lib/applications/normKey.ts` :

```ts
/**
 * Clé de dédoublonnage d'une candidature : deux candidatures partageant la même
 * clé sont la même candidature. Module pur — aucune dépendance.
 */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `""` si entreprise ET poste sont vides : aucune candidature ne doit être créée. */
export function normKey(company: string, role: string): string {
  const c = norm(company || "");
  const r = norm(role || "");
  if (!c && !r) return "";
  return `${c}|${r}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/applications/normKey.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/applications/normKey.ts web/src/lib/applications/normKey.test.ts
git commit -m "feat(candidatures): clé de dédoublonnage entreprise+poste"
```

---

### Task 2 : Types de données et dérivation du statut

**Files:**
- Create: `web/src/lib/applications/types.ts`
- Create: `web/src/lib/applications/status.ts`
- Test: `web/src/lib/applications/status.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `types.ts` : `ApplicationEvent`, `Application`, `ApplicationStatus`, `DEFAULT_STALE_DAYS = 30`.
  - `status.ts` : `deriveStatus(app, now, staleDays): ApplicationStatus`, `daysSince(app, now): number`, `summarize(apps, now, staleDays): ApplicationSummary`, `STATUS_LABELS: Record<ApplicationStatus, string>`.

- [ ] **Step 1: Write the types (pas de test — types purs)**

Create `web/src/lib/applications/types.ts` :

```ts
import type { DocType } from "@/lib/resume/schema";

/** Provenance d'un événement. `"ai"` est réservé aux futurs connecteurs (mail, agenda). */
export type EventSource = "manual" | "system" | "ai";

export interface ApplicationEvent {
  date: number;
  type: "applied" | "interview" | "rejected" | "note";
  source: EventSource;
  detail?: string;
}

export interface Application {
  id: string;
  createdAt: number;
  company: string;
  role: string;
  /** Clé de dédoublonnage — voir `normKey()`. */
  normKey: string;
  /** Texte de l'offre conservé ("" si inconnu). */
  jobText: string;
  jobUrl: string;
  source: "generated" | "ft-job" | "manual";
  /** Journal : le statut n'est jamais stocké, il se déduit d'ici. */
  events: ApplicationEvent[];
  notes: string;
  updatedAt: number;
}

/** `stale` n'est jamais saisi : il est calculé à partir du silence. */
export type ApplicationStatus = "applied" | "interview" | "rejected" | "stale";

export const DEFAULT_STALE_DAYS = 30;
```

**Note :** si `DocType` n'est finalement pas utilisé dans ce fichier, retirer son
import — `npm run lint` échoue sur un import inutilisé.

- [ ] **Step 2: Write the failing test**

Create `web/src/lib/applications/status.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { deriveStatus, daysSince, summarize } from "./status";
import type { Application, ApplicationEvent } from "./types";

const DAY = 86400000;
const NOW = new Date("2026-07-25T12:00:00Z").getTime();

function app(events: ApplicationEvent[]): Application {
  return {
    id: "x", createdAt: events[0]?.date ?? NOW,
    company: "Acme", role: "Dev", normKey: "acme|dev",
    jobText: "", jobUrl: "", source: "manual",
    events, notes: "", updatedAt: NOW,
  };
}
const applied = (daysAgo: number): ApplicationEvent =>
  ({ date: NOW - daysAgo * DAY, type: "applied", source: "system" });

describe("deriveStatus", () => {
  it("un refus gagne sur tout le reste", () => {
    const a = app([applied(200), { date: NOW - 190 * DAY, type: "interview", source: "manual" }, { date: NOW - 180 * DAY, type: "rejected", source: "manual" }]);
    expect(deriveStatus(a, NOW, 30)).toBe("rejected");
  });

  it("un entretien empêche le passage en sans suite, même à 200 jours", () => {
    const a = app([applied(200), { date: NOW - 199 * DAY, type: "interview", source: "manual" }]);
    expect(deriveStatus(a, NOW, 30)).toBe("interview");
  });

  it("31 jours de silence avec un seuil de 30 donne sans suite", () => {
    expect(deriveStatus(app([applied(31)]), NOW, 30)).toBe("stale");
  });

  it("29 jours de silence reste en cours", () => {
    expect(deriveStatus(app([applied(29)]), NOW, 30)).toBe("applied");
  });

  it("une note récente ne rajeunit pas une candidature morte", () => {
    const a = app([applied(60), { date: NOW, type: "note", source: "manual", detail: "relu" }]);
    expect(deriveStatus(a, NOW, 30)).toBe("stale");
  });

  it("respecte un seuil personnalisé", () => {
    expect(deriveStatus(app([applied(20)]), NOW, 14)).toBe("stale");
  });
});

describe("daysSince", () => {
  it("compte les jours depuis la candidature, pas depuis le dernier événement", () => {
    const a = app([applied(40), { date: NOW - 2 * DAY, type: "interview", source: "manual" }]);
    expect(daysSince(a, NOW)).toBe(40);
  });
});

describe("summarize", () => {
  it("agrège les compteurs et le taux de réponse", () => {
    const apps = [
      app([applied(2)]),
      app([applied(5)]),
      app([applied(10), { date: NOW - 3 * DAY, type: "interview", source: "manual" }]),
      app([applied(20), { date: NOW - 1 * DAY, type: "rejected", source: "manual" }]),
      app([applied(50)]),
    ];
    const s = summarize(apps, NOW, 30);
    expect(s.total).toBe(5);
    expect(s.applied).toBe(2);
    expect(s.interview).toBe(1);
    expect(s.rejected).toBe(1);
    expect(s.stale).toBe(1);
    expect(s.answered).toBe(2);
    expect(s.responseRate).toBe(40);
    expect(s.oldest).toBe(NOW - 50 * DAY);
  });

  it("ne divise pas par zéro sur une liste vide", () => {
    const s = summarize([], NOW, 30);
    expect(s.total).toBe(0);
    expect(s.responseRate).toBe(0);
    expect(s.oldest).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/applications/status.test.ts`
Expected: FAIL — `Failed to resolve import "./status"`.

- [ ] **Step 4: Write minimal implementation**

Create `web/src/lib/applications/status.ts` :

```ts
import type { Application, ApplicationEvent, ApplicationStatus } from "./types";

const DAY = 86400000;

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "En cours",
  interview: "Entretien",
  rejected: "Refusée",
  stale: "Sans suite",
};

/** Dernier événement qui compte pour l'ancienneté (les notes n'en font pas partie). */
function lastSignificant(app: Application): ApplicationEvent | null {
  const sig = app.events.filter((e) => e.type !== "note");
  return sig.length ? sig[sig.length - 1] : null;
}

/**
 * Le statut n'est jamais stocké : un refus est terminal, un entretien décroché ne
 * vieillit jamais, et au-delà de `staleDays` de silence la candidature s'éteint
 * toute seule. C'est ce qui rend le suivi sans maintenance.
 */
export function deriveStatus(app: Application, now: number, staleDays: number): ApplicationStatus {
  if (app.events.some((e) => e.type === "rejected")) return "rejected";
  if (app.events.some((e) => e.type === "interview")) return "interview";
  const last = lastSignificant(app);
  const days = last ? Math.floor((now - last.date) / DAY) : 0;
  return days > staleDays ? "stale" : "applied";
}

/** Âge de la candidature, en jours, depuis l'envoi. */
export function daysSince(app: Application, now: number): number {
  const first = app.events.find((e) => e.type === "applied");
  return Math.floor((now - (first ? first.date : now)) / DAY);
}

export interface ApplicationSummary {
  total: number;
  applied: number;
  interview: number;
  rejected: number;
  stale: number;
  answered: number;
  /** Pourcentage entier. 0 si aucune candidature. */
  responseRate: number;
  /** Horodatage de la plus ancienne candidature, `null` si aucune. */
  oldest: number | null;
}

export function summarize(apps: Application[], now: number, staleDays: number): ApplicationSummary {
  const counts = { applied: 0, interview: 0, rejected: 0, stale: 0 };
  let oldest: number | null = null;
  for (const app of apps) {
    counts[deriveStatus(app, now, staleDays)] += 1;
    const first = app.events.find((e) => e.type === "applied");
    const at = first ? first.date : app.createdAt;
    if (oldest === null || at < oldest) oldest = at;
  }
  const answered = counts.interview + counts.rejected;
  const total = apps.length;
  return {
    total,
    ...counts,
    answered,
    responseRate: total ? Math.round((answered / total) * 100) : 0,
    oldest,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/applications/status.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/applications/types.ts web/src/lib/applications/status.ts web/src/lib/applications/status.test.ts
git commit -m "feat(candidatures): types et dérivation du statut par l'ancienneté"
```

---

### Task 3 : Règle du CV anonyme (rayon « Mes CV »)

**Files:**
- Create: `web/src/lib/applications/shelf.ts`
- Test: `web/src/lib/applications/shelf.test.ts`

**Interfaces:**
- Consumes: rien (travaille sur une forme minimale, pas sur `HistoryEntry` entier, pour rester pur).
- Produces:
  - `ShelfCandidate = { id: string; doc_type: string; label?: string; applicationId?: string }`
  - `anonymousIdsToDelete(entries: ShelfCandidate[], docType: string, keepId: string): string[]`
  - `isAnonymous(entry: ShelfCandidate): boolean`
  - `ANONYMOUS_LABELS: Record<string, string>` (clés `"CV"` et `"Lettre"`)

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/applications/shelf.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { anonymousIdsToDelete, isAnonymous } from "./shelf";

const e = (id: string, doc_type: string, label?: string, applicationId?: string) =>
  ({ id, doc_type, label, applicationId });

describe("isAnonymous", () => {
  it("un document sans label et sans candidature est anonyme", () => {
    expect(isAnonymous(e("a", "CV"))).toBe(true);
    expect(isAnonymous(e("a", "CV", ""))).toBe(true);
  });

  it("un document nommé n'est pas anonyme", () => {
    expect(isAnonymous(e("a", "CV", "Intérim manutention"))).toBe(false);
  });

  it("un document rattaché à une candidature n'est pas dans le rayon", () => {
    expect(isAnonymous(e("a", "CV", "", "app-1"))).toBe(false);
  });
});

describe("anonymousIdsToDelete", () => {
  it("ne garde qu'un seul CV anonyme : les autres sont supprimés", () => {
    const entries = [e("old1", "CV"), e("old2", "CV"), e("new", "CV")];
    expect(anonymousIdsToDelete(entries, "CV", "new").sort()).toEqual(["old1", "old2"]);
  });

  it("ne touche jamais un document nommé", () => {
    const entries = [e("kept", "CV", "Intérim manutention"), e("old", "CV"), e("new", "CV")];
    expect(anonymousIdsToDelete(entries, "CV", "new")).toEqual(["old"]);
  });

  it("cloisonne par type de document : une lettre ne remplace pas un CV", () => {
    const entries = [e("cv", "CV"), e("newLetter", "Lettre")];
    expect(anonymousIdsToDelete(entries, "Lettre", "newLetter")).toEqual([]);
  });

  it("ne supprime pas le document qu'on vient de créer", () => {
    expect(anonymousIdsToDelete([e("new", "CV")], "CV", "new")).toEqual([]);
  });

  it("ignore les documents rattachés à une candidature", () => {
    const entries = [e("attached", "CV", "", "app-1"), e("new", "CV")];
    expect(anonymousIdsToDelete(entries, "CV", "new")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/applications/shelf.test.ts`
Expected: FAIL — `Failed to resolve import "./shelf"`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/lib/applications/shelf.ts` :

```ts
/**
 * Règle du CV anonyme : il n'existe qu'un seul document anonyme par type de
 * document. Un nouvel export sans entreprise ni poste remplace le précédent,
 * silencieusement — le libellé « Dernier CV exporté » annonce déjà le
 * remplacement. Nommer un document, c'est le garder.
 * Module pur : travaille sur une forme minimale, pas sur `HistoryEntry`.
 */
export interface ShelfCandidate {
  id: string;
  doc_type: string;
  label?: string;
  applicationId?: string;
}

export const ANONYMOUS_LABELS: Record<string, string> = {
  CV: "Dernier CV exporté",
  Lettre: "Dernière lettre exportée",
};

/** Anonyme = dans le rayon (pas de candidature) et sans nom donné par l'utilisateur. */
export function isAnonymous(entry: ShelfCandidate): boolean {
  return !entry.applicationId && !(entry.label || "").trim();
}

/** Ids des anciens documents anonymes du même type à supprimer après un export. */
export function anonymousIdsToDelete(
  entries: ShelfCandidate[],
  docType: string,
  keepId: string,
): string[] {
  return entries
    .filter((e) => e.doc_type === docType && e.id !== keepId && isAnonymous(e))
    .map((e) => e.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/applications/shelf.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/applications/shelf.ts web/src/lib/applications/shelf.test.ts
git commit -m "feat(candidatures): règle du CV anonyme unique par type"
```

---

### Task 4 : Rattachement rétroactif de l'historique (fonction pure)

**Files:**
- Create: `web/src/lib/applications/backfill.ts`
- Test: `web/src/lib/applications/backfill.test.ts`

**Interfaces:**
- Consumes: `normKey` (Task 1), `Application` (Task 2).
- Produces: `planBackfill(entries: BackfillEntry[], now: number, newId: (i: number) => string): BackfillPlan` avec
  `BackfillEntry = { id: string; created_at: string; doc_type: string; company?: string; role?: string; job_desc?: string; applicationId?: string }`
  et `BackfillPlan = { applications: Application[]; links: Array<{ entryId: string; applicationId: string }> }`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/applications/backfill.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { planBackfill } from "./backfill";

const NOW = new Date("2026-07-25T12:00:00Z").getTime();
const ids = (i: number) => `app-${i}`;

const entry = (id: string, created_at: string, company: string, role: string, applicationId?: string) =>
  ({ id, created_at, doc_type: "CV", company, role, job_desc: "", applicationId });

describe("planBackfill", () => {
  it("groupe trois documents en deux candidatures et rattache chaque document", () => {
    const plan = planBackfill(
      [
        entry("d1", "2026-07-01T10:00:00Z", "Decathlon", "Product Owner"),
        entry("d2", "2026-07-02T10:00:00Z", "Decathlon", "Product Owner"),
        entry("d3", "2026-07-03T10:00:00Z", "Manpower", "Cariste"),
      ],
      NOW,
      ids,
    );
    expect(plan.applications).toHaveLength(2);
    expect(plan.links).toHaveLength(3);
    const decathlon = plan.applications.find((a) => a.company === "Decathlon")!;
    const linked = plan.links.filter((l) => l.applicationId === decathlon.id).map((l) => l.entryId);
    expect(linked.sort()).toEqual(["d1", "d2"]);
  });

  it("date la candidature du document le plus ancien du groupe", () => {
    const plan = planBackfill(
      [
        entry("d2", "2026-07-02T10:00:00Z", "Decathlon", "PO"),
        entry("d1", "2026-07-01T10:00:00Z", "Decathlon", "PO"),
      ],
      NOW,
      ids,
    );
    const expected = new Date("2026-07-01T10:00:00Z").getTime();
    expect(plan.applications[0].createdAt).toBe(expected);
    expect(plan.applications[0].events[0]).toMatchObject({ date: expected, type: "applied", source: "system" });
  });

  it("ignore les documents déjà rattachés", () => {
    const plan = planBackfill([entry("d1", "2026-07-01T10:00:00Z", "Acme", "Dev", "app-x")], NOW, ids);
    expect(plan.applications).toEqual([]);
    expect(plan.links).toEqual([]);
  });

  it("ignore les documents sans entreprise ni poste (ils vont au rayon Mes CV)", () => {
    const plan = planBackfill([entry("d1", "2026-07-01T10:00:00Z", "", "")], NOW, ids);
    expect(plan.applications).toEqual([]);
    expect(plan.links).toEqual([]);
  });

  it("reprend le texte de l'offre s'il existe", () => {
    const e = { ...entry("d1", "2026-07-01T10:00:00Z", "Acme", "Dev"), job_desc: "Une offre" };
    const plan = planBackfill([e], NOW, ids);
    expect(plan.applications[0].jobText).toBe("Une offre");
  });

  it("est vide quand il n'y a rien à faire (donc idempotent une fois les liens écrits)", () => {
    expect(planBackfill([], NOW, ids)).toEqual({ applications: [], links: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/applications/backfill.test.ts`
Expected: FAIL — `Failed to resolve import "./backfill"`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/lib/applications/backfill.ts` :

```ts
import { normKey } from "./normKey";
import type { Application } from "./types";

/** Forme minimale d'une entrée d'historique nécessaire au rattachement. */
export interface BackfillEntry {
  id: string;
  created_at: string;
  doc_type: string;
  company?: string;
  role?: string;
  job_desc?: string;
  applicationId?: string;
}

export interface BackfillPlan {
  applications: Application[];
  links: Array<{ entryId: string; applicationId: string }>;
}

/**
 * Calcule les candidatures à créer depuis l'historique existant, groupées par
 * entreprise+poste. Fonction pure : `newId` fournit les identifiants pour que le
 * résultat soit déterministe en test. Idempotent en pratique parce que les
 * entrées déjà rattachées (`applicationId`) sont ignorées.
 */
export function planBackfill(
  entries: BackfillEntry[],
  now: number,
  newId: (index: number) => string,
): BackfillPlan {
  const groups = new Map<string, BackfillEntry[]>();
  for (const e of entries) {
    if (e.applicationId) continue;
    const key = normKey(e.company || "", e.role || "");
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const applications: Application[] = [];
  const links: BackfillPlan["links"] = [];
  let i = 0;
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const first = sorted[0];
    const at = new Date(first.created_at).getTime();
    const id = newId(i);
    i += 1;
    applications.push({
      id,
      createdAt: at,
      company: first.company || "",
      role: first.role || "",
      normKey: key,
      jobText: sorted.find((e) => (e.job_desc || "").trim())?.job_desc || "",
      jobUrl: "",
      source: "generated",
      events: [{ date: at, type: "applied", source: "system" }],
      notes: "",
      updatedAt: now,
    });
    for (const e of sorted) links.push({ entryId: e.id, applicationId: id });
  }
  return { applications, links };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/applications/backfill.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/applications/backfill.ts web/src/lib/applications/backfill.test.ts
git commit -m "feat(candidatures): rattachement rétroactif de l'historique existant"
```

---

### Task 5 : Migration Dexie v8 et couche d'accès

**Files:**
- Modify: `web/src/lib/storage/db.ts` (ajout de la table + champs optionnels + API)
- Create: `web/src/lib/applications/store.ts`

**Interfaces:**
- Consumes: `normKey` (T1), `types.ts` (T2), `shelf.ts` (T3), `backfill.ts` (T4).
- Produces (dans `store.ts`) :
  - `listApplications(): Promise<Application[]>` — triées par date de candidature décroissante
  - `upsertApplicationForDocument(input: { company: string; role: string; source: Application["source"]; jobText?: string; jobUrl?: string; now?: number }): Promise<string | undefined>`
  - `addApplicationEvent(id: string, type: "interview" | "rejected", now?: number): Promise<void>`
  - `undoLastStatusEvent(id: string): Promise<void>`
  - `saveApplicationNotes(id: string, notes: string): Promise<void>`
  - `deleteApplication(id: string): Promise<void>`
  - `runBackfillOnce(): Promise<void>`
  - `listShelfEntries(): Promise<HistoryEntry[]>`
  - `setShelfLabel(id: string, label: string): Promise<void>`
  - `pruneAnonymousShelf(docType: string, keepId: string): Promise<void>`
  - `listApplicationDocuments(applicationId: string): Promise<HistoryEntry[]>`

- [ ] **Step 1: Étendre `db.ts` — types et migration**

Dans `web/src/lib/storage/db.ts`, ajouter `applicationId` à `HistoryEntry` et `label`, ajouter `applicationId` à `JobEntry`, importer le type `Application`, déclarer la table, et ajouter la version 8.

Modifier l'interface `HistoryEntry` (après `last_viewed_at?: string;`) :

```ts
  /** Candidature à laquelle ce document est rattaché (feature « Mes candidatures »). */
  applicationId?: string;
  /** Nom donné à un CV du rayon « Mes CV ». Vide/absent = document anonyme. */
  label?: string;
```

Ajouter à `JobEntry` (après `publishedAt?: string;`) :

```ts
  /** Candidature créée depuis cette offre (bouton « Suivre »). */
  applicationId?: string;
```

Ajouter en haut du fichier, avec les autres imports :

```ts
import type { Application } from "@/lib/applications/types";
```

Dans la classe `AppDatabase`, déclarer la table à côté des autres :

```ts
  applications!: Table<Application, string>; // Primary key: id
```

Et à la fin du constructeur, après le bloc `version(7)` :

```ts
    // v8 : tracker de candidatures « Mes candidatures ». Le statut n'est pas
    // stocké (dérivé du journal d'événements), donc aucun index de statut.
    this.version(8).stores({
      applications: "id, normKey, createdAt, updatedAt",
    });
```

- [ ] **Step 2: Ajouter l'API Dexie des candidatures dans `db.ts`**

À la fin de `web/src/lib/storage/db.ts`, ajouter :

```ts
// ---------------------------------------------------------------------------
// APPLICATIONS API (tracker « Mes candidatures »)
// ---------------------------------------------------------------------------

export async function listApplicationsRaw(): Promise<Application[]> {
  try {
    return await db.applications.toArray();
  } catch (e) {
    console.warn("listApplicationsRaw error:", e);
    return [];
  }
}

export async function getApplicationByNormKey(key: string): Promise<Application | undefined> {
  try {
    return await db.applications.where("normKey").equals(key).first();
  } catch (e) {
    console.warn("getApplicationByNormKey error:", e);
    return undefined;
  }
}

export async function putApplication(app: Application): Promise<void> {
  try {
    await db.applications.put(app);
  } catch (e) {
    console.warn("putApplication error:", e);
  }
}

export async function deleteApplicationRecord(id: string): Promise<void> {
  try {
    await db.applications.delete(id);
  } catch (e) {
    console.warn("deleteApplicationRecord error:", e);
  }
}

/** Documents d'historique rattachés à une candidature. */
export async function listHistoryByApplication(applicationId: string): Promise<HistoryEntry[]> {
  try {
    const all = await db.history.filter((h) => h.applicationId === applicationId).toArray();
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch (e) {
    console.warn("listHistoryByApplication error:", e);
    return [];
  }
}

/** Documents d'historique non rattachés à une candidature (rayon « Mes CV »). */
export async function listUnattachedHistory(): Promise<HistoryEntry[]> {
  try {
    const all = await db.history.filter((h) => !h.applicationId).toArray();
    return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (e) {
    console.warn("listUnattachedHistory error:", e);
    return [];
  }
}

export async function updateHistoryFields(
  id: string,
  fields: Partial<Pick<HistoryEntry, "applicationId" | "label">>,
): Promise<void> {
  try {
    await db.history.update(id, fields);
  } catch (e) {
    console.warn("updateHistoryFields error:", e);
  }
}

export async function deleteHistoryEntries(ids: string[]): Promise<void> {
  try {
    await db.history.bulkDelete(ids);
  } catch (e) {
    console.warn("deleteHistoryEntries error:", e);
  }
}
```

- [ ] **Step 3: Écrire `store.ts` (couche d'application, sans logique de décision)**

Create `web/src/lib/applications/store.ts` :

```ts
import {
  listApplicationsRaw,
  getApplicationByNormKey,
  putApplication,
  deleteApplicationRecord,
  listHistoryByApplication,
  listUnattachedHistory,
  updateHistoryFields,
  deleteHistoryEntries,
  type HistoryEntry,
} from "@/lib/storage/db";
import { normKey } from "./normKey";
import { anonymousIdsToDelete } from "./shelf";
import { planBackfill } from "./backfill";
import type { Application } from "./types";

const BACKFILL_KEY = "applications-backfill-v1";

/** Candidatures, les plus récentes d'abord (date d'envoi). */
export async function listApplications(): Promise<Application[]> {
  const all = await listApplicationsRaw();
  const at = (a: Application) => a.events.find((e) => e.type === "applied")?.date ?? a.createdAt;
  return all.sort((x, y) => at(y) - at(x));
}

export async function listApplicationDocuments(applicationId: string): Promise<HistoryEntry[]> {
  return listHistoryByApplication(applicationId);
}

/**
 * Crée la candidature correspondant à un document exporté, ou retourne
 * l'existante. Régénérer un CV pour la même entreprise+poste n'est pas une
 * nouvelle candidature : aucun événement n'est ajouté dans ce cas.
 * Retourne `undefined` si entreprise ET poste sont vides.
 */
export async function upsertApplicationForDocument(input: {
  company: string;
  role: string;
  source: Application["source"];
  jobText?: string;
  jobUrl?: string;
  now?: number;
}): Promise<string | undefined> {
  const key = normKey(input.company, input.role);
  if (!key) return undefined;

  const existing = await getApplicationByNormKey(key);
  if (existing) return existing.id;

  const now = input.now ?? Date.now();
  const app: Application = {
    id: crypto.randomUUID(),
    createdAt: now,
    company: input.company,
    role: input.role,
    normKey: key,
    jobText: input.jobText || "",
    jobUrl: input.jobUrl || "",
    source: input.source,
    events: [{ date: now, type: "applied", source: input.source === "generated" ? "system" : "manual" }],
    notes: "",
    updatedAt: now,
  };
  await putApplication(app);
  return app.id;
}

export async function addApplicationEvent(
  id: string,
  type: "interview" | "rejected",
  now?: number,
): Promise<void> {
  const all = await listApplicationsRaw();
  const app = all.find((a) => a.id === id);
  if (!app) return;
  const at = now ?? Date.now();
  app.events = [...app.events, { date: at, type, source: "manual" }];
  app.updatedAt = at;
  await putApplication(app);
}

/** Annule le dernier événement de statut saisi à la main (entretien ou refus). */
export async function undoLastStatusEvent(id: string): Promise<void> {
  const all = await listApplicationsRaw();
  const app = all.find((a) => a.id === id);
  if (!app) return;
  const idx = app.events.map((e) => e.type).reduce<number>(
    (last, type, i) => (type === "interview" || type === "rejected" ? i : last),
    -1,
  );
  if (idx <= 0) return;
  app.events = app.events.filter((_, i) => i !== idx);
  app.updatedAt = Date.now();
  await putApplication(app);
}

export async function saveApplicationNotes(id: string, notes: string): Promise<void> {
  const all = await listApplicationsRaw();
  const app = all.find((a) => a.id === id);
  if (!app) return;
  app.notes = notes;
  app.updatedAt = Date.now();
  await putApplication(app);
}

/** Supprime la candidature et détache ses documents (ils repassent au rayon). */
export async function deleteApplication(id: string): Promise<void> {
  const docs = await listHistoryByApplication(id);
  for (const doc of docs) await updateHistoryFields(doc.id, { applicationId: undefined });
  await deleteApplicationRecord(id);
}

/** Peuple le tracker depuis l'historique existant. Une seule fois, idempotent. */
export async function runBackfillOnce(): Promise<void> {
  if (typeof localStorage !== "undefined" && localStorage.getItem(BACKFILL_KEY)) return;
  const entries = await listUnattachedHistory();
  const plan = planBackfill(entries, Date.now(), () => crypto.randomUUID());
  for (const app of plan.applications) await putApplication(app);
  for (const link of plan.links) await updateHistoryFields(link.entryId, { applicationId: link.applicationId });
  if (typeof localStorage !== "undefined") localStorage.setItem(BACKFILL_KEY, "1");
}

export async function listShelfEntries(): Promise<HistoryEntry[]> {
  return listUnattachedHistory();
}

export async function setShelfLabel(id: string, label: string): Promise<void> {
  await updateHistoryFields(id, { label: label.trim() });
}

/** Applique la règle du CV anonyme unique après un export sans entreprise ni poste. */
export async function pruneAnonymousShelf(docType: string, keepId: string): Promise<void> {
  const entries = await listUnattachedHistory();
  const ids = anonymousIdsToDelete(entries, docType, keepId);
  if (ids.length) await deleteHistoryEntries(ids);
}
```

- [ ] **Step 4: Vérifier que rien n'est cassé**

Run: `cd web && npm test`
Expected: PASS — tous les tests existants plus les 28 nouveaux.

Run: `cd web && npm run build`
Expected: build réussi, aucune erreur de type.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/storage/db.ts web/src/lib/applications/store.ts
git commit -m "feat(candidatures): migration Dexie v8 et couche d'accès"
```

---

### Task 6 : Seuil « sans suite » réglable

**Files:**
- Modify: `web/src/state/settingsStore.ts`
- Modify: `web/src/app/settings/page.tsx` (section « Préférences de l'Application »)

**Interfaces:**
- Consumes: `DEFAULT_STALE_DAYS` (T2).
- Produces: `settings.staleDays: number` et `settings.setStaleDays(days: number)`.

- [ ] **Step 1: Ajouter le réglage au store**

Dans `web/src/state/settingsStore.ts` : ajouter `staleDays: number;` à l'interface d'état, `setStaleDays: (days: number) => void;` aux actions, `staleDays: 30,` aux valeurs par défaut, et `setStaleDays: (staleDays) => set({ staleDays }),` aux implémentations. Le store est persisté (`name: "cv-tailor-settings"`), donc la valeur survit au rechargement ; les utilisateurs existants n'ayant pas la clé récupèrent `30` via le défaut.

- [ ] **Step 2: Exposer le réglage dans Paramètres**

Dans la section « Préférences de l'Application » de `web/src/app/settings/page.tsx`, ajouter un champ suivant le motif des champs voisins (`form-field` + `form-label` + `CustomSelect`) :

```tsx
<div className="form-field">
  <label className="form-label">Candidature sans réponse considérée comme perdue après</label>
  <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", lineHeight: "1.5" }}>
    Au-delà de ce délai sans nouvelle, une candidature passe automatiquement en « Sans suite » dans « Mes candidatures ». Rien à mettre à jour à la main.
  </p>
  <CustomSelect<number>
    value={settings.staleDays}
    onChange={(v) => settings.setStaleDays(v)}
    style={{ width: "100%" }}
    options={[
      { value: 15, label: "15 jours" },
      { value: 30, label: "30 jours (par défaut)" },
      { value: 45, label: "45 jours" },
      { value: 60, label: "60 jours" },
    ]}
  />
</div>
```

- [ ] **Step 3: Vérifier**

Run: `cd web && npm run build`
Expected: build réussi.

- [ ] **Step 4: Commit**

```bash
git add web/src/state/settingsStore.ts web/src/app/settings/page.tsx
git commit -m "feat(candidatures): seuil « sans suite » réglable (défaut 30 jours)"
```

---

### Task 7 : Styles de la page (CSS)

**Files:**
- Modify: `web/src/app/globals.css` (ajout en fin de fichier)

**Interfaces:**
- Consumes: variables de thème existantes.
- Produces: classes `.app-dash`, `.app-tile`, `.app-filters`, `.app-chips`, `.app-chip`, `.app-card`, `.app-age`, `.app-main`, `.app-company`, `.app-role`, `.app-meta`, `.app-docs`, `.app-right`, `.app-badge`, `.app-actions`, `.app-btn`, `.app-expand`, `.app-block__label`, `.app-doc-row`, `.app-offer`, `.app-note`, `.app-timeline`, `.app-event`, `.app-shelf`, `.app-cv`, `.app-rename`.

- [ ] **Step 1: Copier les classes depuis le prototype validé**

Le CSS de référence est le bloc de classes `.app-*` de `docs/design/candidatures/prototype.html` (dans son `<style>`). Copier ces règles à la fin de `web/src/app/globals.css`, sous un commentaire de section :

```css
/* ===========================================================================
   MES CANDIDATURES (tracker) — maquette docs/design/candidatures/
   =========================================================================== */
```

Ne **pas** reprendre du prototype : `.wrap`, `.topbar*`, `.seg*`, `.pane`, `.hist-*`, `.stat-chip`, `.btn-nav`, `.card-list` (déjà présentes dans `globals.css`), ni `.proto-tip` (spécifique au prototype), ni les tokens `:root` / `[data-theme="dark"]` (déjà présents).

Reprendre en revanche à l'identique, dans cet ordre : `.app-dash`, `.app-tile`, `.app-tile__label`, `.app-tile__value`, `.app-tile__hint`, `.app-tile--interview`, `.app-tile--stale`, `.app-filters`, `.app-chips`, `.app-chip`, `.app-chip__count`, `.app-card`, `.app-card--stale`, `.app-age` et ses variantes, `.app-main`, `.app-company`, `.app-role`, `.app-meta`, `.app-dot`, `.app-docs`, `.app-right`, `.app-badge` et ses variantes, `.app-actions`, `.app-btn` et ses variantes, `.app-card--open`, `.app-expand`, `.app-block__label`, `.app-doc-row`, `.app-doc-name`, `.app-doc-date`, `.app-offer`, `.app-note`, `.app-timeline`, `.app-event`, `.app-event__date`, `.app-event__src`, `.app-shelf` et ses enfants, `.app-cv` et ses enfants, `.app-cv__warn`, `.app-cv__kept`, `.app-rename`.

Conserver telle quelle la règle `[data-theme="dark"] .app-tile`.

**Ne pas copier** les classes `.app-perf*` : le bloc « Performance par CV » a été abandonné pendant la conception (voir la section 7.2 du spec). Si la règle `[data-theme="dark"] .app-perf` existe dans le prototype, l'ignorer aussi.

- [ ] **Step 2: Vérifier qu'aucune couleur en dur n'a été introduite**

Run: `cd web && grep -nE "#[0-9a-fA-F]{3,6}" src/app/globals.css | sed -n '/MES CANDIDATURES/,$p'`

Alternative fiable : afficher la section ajoutée et la relire.

Run: `cd web && sed -n '/MES CANDIDATURES/,$p' src/app/globals.css | grep -nE "#[0-9a-fA-F]{3,6}|rgb\("`
Expected: seules les occurrences `rgba(31,27,22,…)` / `rgba(255,255,255,…)` des `box-shadow` (motif déjà utilisé partout dans le fichier). Aucun code couleur de texte ou de fond.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/globals.css
git commit -m "style(candidatures): classes de la page Mes candidatures"
```

---

### Task 8 : Composants d'affichage — dashboard, filtres, carte

**Files:**
- Create: `web/src/components/applications/ApplicationsDashboard.tsx`
- Create: `web/src/components/applications/ApplicationsFilters.tsx`
- Create: `web/src/components/applications/ApplicationCard.tsx`

**Interfaces:**
- Consumes: `summarize`, `deriveStatus`, `daysSince`, `STATUS_LABELS` (T2), `Application` (T2), `listApplicationDocuments`, `addApplicationEvent`, `undoLastStatusEvent`, `saveApplicationNotes`, `deleteApplication` (T5).
- Produces:
  - `<ApplicationsDashboard apps staleDays now />`
  - `<ApplicationsFilters query onQuery filter onFilter counts />` avec `FilterKey = "all" | ApplicationStatus`
  - `<ApplicationCard app status days onChanged />`

- [ ] **Step 1: Le dashboard**

Create `web/src/components/applications/ApplicationsDashboard.tsx` :

```tsx
"use client";

import { summarize } from "@/lib/applications/status";
import type { Application } from "@/lib/applications/types";

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function frDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Cinq indicateurs, tous dérivés des dates : aucune saisie ne les alimente. */
export default function ApplicationsDashboard({
  apps, staleDays, now,
}: { apps: Application[]; staleDays: number; now: number }) {
  const s = summarize(apps, now, staleDays);
  const tiles: Array<{ label: string; value: string | number; hint: string; cls?: string }> = [
    { label: "Candidatures", value: s.total, hint: s.oldest ? `depuis le ${frDate(s.oldest)}` : "aucune pour l'instant" },
    { label: "En cours", value: s.applied, hint: `moins de ${staleDays} jours` },
    { label: "Entretiens", value: s.interview, hint: "réponses positives", cls: "app-tile--interview" },
    { label: "Taux de réponse", value: `${s.responseRate} %`, hint: `${s.answered} réponses sur ${s.total}` },
    { label: "Sans suite", value: s.stale, hint: `silence > ${staleDays} jours`, cls: "app-tile--stale" },
  ];
  return (
    <div className="app-dash">
      {tiles.map((t) => (
        <div key={t.label} className={`app-tile ${t.cls ?? ""}`}>
          <div className="app-tile__label">{t.label}</div>
          <div className="app-tile__value">{t.value}</div>
          <div className="app-tile__hint">{t.hint}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Les filtres**

Create `web/src/components/applications/ApplicationsFilters.tsx` :

```tsx
"use client";

import { STATUS_LABELS } from "@/lib/applications/status";
import type { ApplicationStatus } from "@/lib/applications/types";

export type FilterKey = "all" | ApplicationStatus;

const KEYS: FilterKey[] = ["all", "applied", "interview", "rejected", "stale"];

export default function ApplicationsFilters({
  query, onQuery, filter, onFilter, counts,
}: {
  query: string;
  onQuery: (v: string) => void;
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  return (
    <div className="app-filters">
      <input
        type="text"
        className="hist-search"
        placeholder="Rechercher une entreprise, un poste, un mot de l'offre…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="app-chips">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`app-chip ${filter === k ? "active" : ""}`}
            onClick={() => onFilter(k)}
            aria-pressed={filter === k}
          >
            {k === "all" ? "Tout" : STATUS_LABELS[k]}{" "}
            <span className="app-chip__count">{counts[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: La carte de candidature**

Create `web/src/components/applications/ApplicationCard.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/applications/status";
import type { Application, ApplicationStatus } from "@/lib/applications/types";
import {
  addApplicationEvent, undoLastStatusEvent, saveApplicationNotes,
  deleteApplication, listApplicationDocuments,
} from "@/lib/applications/store";
import { saveDraft, updateHistoryEntryStat, type HistoryEntry } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast, uiConfirm } from "@/state/uiStore";

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const frDate = (ts: number) => `${new Date(ts).getDate()} ${MONTHS[new Date(ts).getMonth()]}`;
const EVENT_LABELS: Record<string, string> = {
  applied: "Candidature envoyée",
  interview: "Entretien décroché",
  rejected: "Refus enregistré",
  note: "Note",
};

function ageClass(status: ApplicationStatus, days: number): string {
  if (status === "stale") return "app-age--stale";
  if (status === "interview") return "app-age--interview app-age--warm";
  return days < 7 ? "app-age--fresh" : "app-age--warm";
}

export default function ApplicationCard({
  app, status, days, onChanged,
}: { app: Application; status: ApplicationStatus; days: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<HistoryEntry[]>([]);
  const [notes, setNotes] = useState(app.notes);
  const router = useRouter();
  const setDocType = useDocStore((s) => s.setDocType);
  const setJson = useDocStore((s) => s.setJson);
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);

  useEffect(() => {
    if (!open) return;
    void listApplicationDocuments(app.id).then(setDocs);
  }, [open, app.id]);

  // Autosave de la note, même délai perçu que l'éditeur.
  useEffect(() => {
    if (notes === app.notes) return;
    const t = setTimeout(() => { void saveApplicationNotes(app.id, notes); }, 800);
    return () => clearTimeout(t);
  }, [notes, app.id, app.notes]);

  const applied = app.events.find((e) => e.type === "applied");
  const interview = app.events.find((e) => e.type === "interview");
  const rejected = app.events.find((e) => e.type === "rejected");

  const meta: string[] = [];
  if (applied) meta.push(`Postulée le ${frDate(applied.date)}`);
  if (interview) meta.push(interview.detail || "Entretien décroché");
  if (rejected) meta.push(`Refus reçu le ${frDate(rejected.date)}`);
  if (status === "stale") meta.push("Aucune réponse");

  async function mark(type: "interview" | "rejected") {
    await addApplicationEvent(app.id, type);
    onChanged();
  }
  async function undo() {
    await undoLastStatusEvent(app.id);
    onChanged();
  }
  async function remove() {
    if (!(await uiConfirm(`Supprimer la candidature ${app.company} ? Les documents générés sont conservés.`, "Supprimer"))) return;
    await deleteApplication(app.id);
    toast("Candidature supprimée.", "success");
    onChanged();
  }
  async function reload(doc: HistoryEntry) {
    if (!(await uiConfirm("Recharger ce document dans l'éditeur ? Votre travail actuel sera remplacé.", "Recharger"))) return;
    await updateHistoryEntryStat(doc.id, "editor_reloads");
    await saveDraft({ id: `draft-${doc.doc_type}`, json: doc.json, templateId: doc.templateId, updatedAt: Date.now() });
    setDocType(doc.doc_type);
    if (doc.json) setJson(doc.json);
    setPreviewOverride(null);
    toast("Document rechargé.", "success");
    router.push("/");
  }

  return (
    <article className={`app-card ${status === "stale" ? "app-card--stale" : ""} ${open ? "app-card--open" : ""}`} data-testid="application-card">
      <div className={`app-age ${ageClass(status, days)}`}>
        <span className="app-age__num">{days}</span>
        <span className="app-age__unit">jours</span>
      </div>

      <div className="app-main">
        <div className="app-company">{app.company || "Entreprise non précisée"}</div>
        <div className="app-role">{app.role || "Poste non précisé"}</div>
        <div className="app-meta">
          {meta.map((m, i) => (
            <span key={i}>
              {i > 0 ? <span className="app-dot">•</span> : null}
              {m}
            </span>
          ))}
          {app.jobUrl ? (
            <>
              <span className="app-dot">•</span>
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer">Voir l&apos;offre</a>
            </>
          ) : null}
        </div>
      </div>

      <div className="app-right">
        <span className={`app-badge app-badge--${status}`}>{STATUS_LABELS[status]}</span>
        <div className="app-actions">
          {status !== "interview" && status !== "rejected" ? (
            <button type="button" className="app-btn app-btn--interview" onClick={() => void mark("interview")}>Entretien</button>
          ) : null}
          {status !== "rejected" ? (
            <button type="button" className="app-btn app-btn--reject" onClick={() => void mark("rejected")}>Refusée</button>
          ) : null}
          {status === "interview" || status === "rejected" ? (
            <button type="button" className="app-btn" onClick={() => void undo()} title="Annuler la dernière action">Annuler</button>
          ) : null}
          <button
            type="button"
            className="app-btn app-btn--icon"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title={open ? "Replier" : "Déplier"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="app-expand">
          <div>
            <div className="app-block__label">Documents rattachés</div>
            {docs.length === 0 ? (
              <div className="app-tile__hint">Aucun document généré pour cette candidature.</div>
            ) : docs.map((doc) => (
              <div key={doc.id} className="app-doc-row">
                <span className="app-doc-name">{doc.filename || doc.doc_type}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="app-doc-date">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                  <button type="button" className="app-btn" onClick={() => void reload(doc)}>Ouvrir dans l&apos;éditeur</button>
                </span>
              </div>
            ))}
          </div>

          {app.jobText ? (
            <div>
              <div className="app-block__label">Offre conservée</div>
              <div className="app-offer">{app.jobText}</div>
            </div>
          ) : null}

          <div>
            <div className="app-block__label">Journal</div>
            <div className="app-timeline">
              {app.events.map((e, i) => (
                <div key={i} className="app-event">
                  <span className="app-event__date">{new Date(e.date).toLocaleDateString("fr-FR")}</span>
                  <span>{EVENT_LABELS[e.type]}</span>
                  <span className="app-event__src">{e.source === "system" ? "auto" : e.source === "ai" ? "ia" : "vous"}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="app-block__label">Note</div>
            <textarea
              className="app-note"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Un détail à retenir (facultatif)…"
            />
          </div>

          <div>
            <button type="button" className="app-btn app-btn--reject" onClick={() => void remove()}>Supprimer la candidature</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Vérifier**

Run: `cd web && npm run build`
Expected: build réussi (les composants ne sont pas encore montés, mais doivent typechecker).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/applications/
git commit -m "feat(candidatures): dashboard, filtres et carte de candidature"
```

---

### Task 9 : Rayon « Mes CV » et modale d'ajout manuel

**Files:**
- Create: `web/src/components/applications/ResumeShelf.tsx`
- Create: `web/src/components/applications/AddApplicationModal.tsx`

**Interfaces:**
- Consumes: `listShelfEntries`, `setShelfLabel`, `upsertApplicationForDocument` (T5), `isAnonymous`, `ANONYMOUS_LABELS` (T3), `deleteHistoryEntry` (`db.ts`).
- Produces: `<ResumeShelf />` (autonome, recharge ses données), `<AddApplicationModal open onClose onCreated />`.

- [ ] **Step 1: Le rayon**

Create `web/src/components/applications/ResumeShelf.tsx` :

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listShelfEntries, setShelfLabel } from "@/lib/applications/store";
import { ANONYMOUS_LABELS, isAnonymous } from "@/lib/applications/shelf";
import { deleteHistoryEntry, saveDraft, updateHistoryEntryStat, type HistoryEntry } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast, uiConfirm } from "@/state/uiStore";

/**
 * Rayon « Mes CV » : les documents non rattachés à une candidature.
 * Un seul document anonyme par type — nommer un document, c'est le garder.
 */
export default function ResumeShelf() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const router = useRouter();
  const setDocType = useDocStore((s) => s.setDocType);
  const setJson = useDocStore((s) => s.setJson);
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);

  const load = useCallback(async () => { setEntries(await listShelfEntries()); }, []);
  useEffect(() => { void load(); }, [load]);

  async function commitLabel(id: string) {
    await setShelfLabel(id, draftLabel);
    setEditing(null);
    setDraftLabel("");
    await load();
  }

  async function reload(doc: HistoryEntry) {
    if (!(await uiConfirm("Recharger ce document dans l'éditeur ? Votre travail actuel sera remplacé.", "Recharger"))) return;
    await updateHistoryEntryStat(doc.id, "editor_reloads");
    await saveDraft({ id: `draft-${doc.doc_type}`, json: doc.json, templateId: doc.templateId, updatedAt: Date.now() });
    setDocType(doc.doc_type);
    if (doc.json) setJson(doc.json);
    setPreviewOverride(null);
    toast("Document rechargé.", "success");
    router.push("/");
  }

  async function remove(doc: HistoryEntry) {
    if (!(await uiConfirm("Supprimer ce document ? Action irréversible.", "Supprimer"))) return;
    await deleteHistoryEntry(doc.id);
    await load();
  }

  if (entries.length === 0) return null;

  return (
    <section className="app-shelf">
      <div className="app-shelf__head">
        <h2 className="app-shelf__title">Mes CV</h2>
        <span className="app-shelf__count">{entries.length}</span>
      </div>
      <p className="app-shelf__hint">
        Les CV qui ne visent pas une entreprise précise — CV d&apos;intérim, CV en anglais, CV généraliste.
        Un seul CV anonyme est gardé à la fois : <strong>nommez-le pour le conserver</strong>.
      </p>
      <div className="app-shelf__list">
        {entries.map((doc) => {
          const anon = isAnonymous(doc);
          const name = anon ? (ANONYMOUS_LABELS[doc.doc_type] ?? "Dernier document exporté") : doc.label;
          return (
            <article key={doc.id} className="app-cv">
              <div>
                {editing === doc.id ? (
                  <input
                    className="app-rename"
                    autoFocus
                    value={draftLabel}
                    placeholder="Ex : Intérim manutention"
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={() => void commitLabel(doc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitLabel(doc.id);
                      if (e.key === "Escape") { setEditing(null); setDraftLabel(""); }
                    }}
                  />
                ) : (
                  <div
                    className={`app-cv__name ${anon ? "app-cv__name--unnamed" : ""}`}
                    onClick={() => { setEditing(doc.id); setDraftLabel(doc.label || ""); }}
                    title={anon ? "Cliquer pour nommer et conserver" : "Cliquer pour renommer"}
                  >
                    {name}
                  </div>
                )}
                <div className="app-cv__meta">
                  <span>{doc.doc_type}</span>
                  <span className="app-dot">•</span>
                  <span>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                  <span className="app-dot">•</span>
                  <span className={anon ? "app-cv__warn" : "app-cv__kept"}>
                    {anon ? "sera remplacé au prochain export" : "conservé"}
                  </span>
                </div>
              </div>
              <div className="app-actions">
                {anon ? (
                  <button type="button" className="app-btn app-btn--interview" onClick={() => { setEditing(doc.id); setDraftLabel(""); }}>
                    Nommer pour garder
                  </button>
                ) : null}
                <button type="button" className="app-btn" onClick={() => void reload(doc)}>Ouvrir dans l&apos;éditeur</button>
                <button type="button" className="app-btn app-btn--reject app-btn--icon" onClick={() => void remove(doc)} title="Supprimer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: La modale d'ajout manuel**

Create `web/src/components/applications/AddApplicationModal.tsx` :

```tsx
"use client";

import { useState } from "react";
import { upsertApplicationForDocument } from "@/lib/applications/store";
import { toast } from "@/state/uiStore";

/** Ajout manuel : pour une candidature envoyée sans passer par Cvmatchr. */
export default function AddApplicationModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!company.trim() || !role.trim()) {
      toast("Entreprise et poste sont nécessaires.", "error");
      return;
    }
    setBusy(true);
    try {
      await upsertApplicationForDocument({ company: company.trim(), role: role.trim(), source: "manual", jobUrl, jobText });
      toast("Candidature ajoutée.", "success");
      setCompany(""); setRole(""); setJobUrl(""); setJobText("");
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-overlay" onClick={onClose}>
      <div className="ui-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="ui-dialog__title">Ajouter une candidature</h2>
        <div className="form-field">
          <label className="form-label" htmlFor="add-company">Entreprise</label>
          <input id="add-company" className="form-input" value={company} onChange={(e) => setCompany(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-role">Poste</label>
          <input id="add-role" className="form-input" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-url">Lien de l&apos;offre (facultatif)</label>
          <input id="add-url" className="form-input" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-text">Texte de l&apos;offre (facultatif)</label>
          <textarea id="add-text" className="form-textarea" rows={4} value={jobText} onChange={(e) => setJobText(e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="app-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-nav btn-orange" onClick={() => void submit()} disabled={busy}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}
```

**Classes confirmées présentes** dans `web/src/app/globals.css` au moment de l'écriture de ce plan : `.ui-overlay` (ligne ~453), `.ui-dialog` (~542), `.ui-dialog__title` (~546), `.form-input`, `.form-textarea`. Aucun CSS supplémentaire n'est à écrire pour cette modale.

- [ ] **Step 3: Vérifier**

Run: `cd web && npm run build`
Expected: build réussi.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/applications/
git commit -m "feat(candidatures): rayon Mes CV et ajout manuel"
```

---

### Task 10 : Page `/candidatures`

**Files:**
- Create: `web/src/app/candidatures/page.tsx`
- Create: `web/src/components/applications/ApplicationsScreen.tsx`

**Interfaces:**
- Consumes: tous les composants des tâches 8 et 9, `listApplications`, `runBackfillOnce` (T5), `deriveStatus`, `daysSince` (T2), `settings.staleDays` (T6).
- Produces: la route `/candidatures`.

- [ ] **Step 1: L'écran (composant client)**

Create `web/src/components/applications/ApplicationsScreen.tsx` :

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SegmentedNav from "@/components/layout/SegmentedNav";
import ApplicationsDashboard from "./ApplicationsDashboard";
import ApplicationsFilters, { type FilterKey } from "./ApplicationsFilters";
import ApplicationCard from "./ApplicationCard";
import ResumeShelf from "./ResumeShelf";
import AddApplicationModal from "./AddApplicationModal";
import { listApplications, runBackfillOnce } from "@/lib/applications/store";
import { daysSince, deriveStatus } from "@/lib/applications/status";
import type { Application } from "@/lib/applications/types";
import { useSettingsStore } from "@/state/settingsStore";

export default function ApplicationsScreen() {
  const [apps, setApps] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const staleDays = useSettingsStore((s) => s.staleDays);

  const load = useCallback(async () => {
    await runBackfillOnce();
    setApps(await listApplications());
    setNow(Date.now());
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(
    () => apps.map((app) => ({
      app,
      status: deriveStatus(app, now, staleDays),
      days: daysSince(app, now),
    })),
    [apps, now, staleDays],
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: rows.length, applied: 0, interview: 0, rejected: 0, stale: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return `${r.app.company} ${r.app.role} ${r.app.jobText}`.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Mes candidatures</h1>
        <div className="topbar-center mobile-hidden">
          <SegmentedNav />
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn-nav btn-orange" onClick={() => setAdding(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Ajouter
          </button>
          <Link href="/" className="btn-nav">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <ApplicationsDashboard apps={apps} staleDays={staleDays} now={now} />
          <ApplicationsFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} />

          {shown.length === 0 ? (
            <div className="hist-empty">
              {apps.length === 0
                ? "Aucune candidature pour l'instant. Exportez un CV en renseignant entreprise et poste, ou ajoutez-en une à la main."
                : "Aucune candidature ne correspond."}
            </div>
          ) : (
            <div className="card-list">
              {shown.map((r) => (
                <ApplicationCard key={r.app.id} app={r.app} status={r.status} days={r.days} onChanged={() => void load()} />
              ))}
            </div>
          )}

          <ResumeShelf />
        </div>
      </div>

      <AddApplicationModal open={adding} onClose={() => setAdding(false)} onCreated={() => void load()} />
    </div>
  );
}
```

- [ ] **Step 2: La route**

**Avant d'écrire :** lire la doc de routage de la version de Next.js du repo (`ls web/node_modules/next/dist/docs/` puis le guide sur les pages/metadata) — les conventions peuvent différer de ce que tu connais.

Create `web/src/app/candidatures/page.tsx` :

```tsx
import ApplicationsScreen from "@/components/applications/ApplicationsScreen";

export const metadata = {
  title: "Mes candidatures — CVMatchr",
};

export default function CandidaturesPage() {
  return <ApplicationsScreen />;
}
```

- [ ] **Step 3: Vérifier dans le navigateur**

Run: `cd web && npm run build`
Expected: build réussi, route `/candidatures` listée dans la sortie.

Lancer le serveur via l'outil de preview (configuration `web-dev` de `.claude/launch.json`), ouvrir `/candidatures`, et vérifier : les cinq tuiles s'affichent, les filtres réagissent, la recherche filtre, aucun message d'erreur en console.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/candidatures/ web/src/components/applications/ApplicationsScreen.tsx
git commit -m "feat(candidatures): page /candidatures"
```

---

### Task 11 : Création automatique à l'export et bouton « Suivre » sur une offre

**Files:**
- Modify: `web/src/components/layout/TopBar.tsx:105-119` (bloc `saveHistoryEntry` dans `onConvert`)
- Modify: `web/src/components/jobs/JobCard.tsx`
- Modify: le composant parent qui rend `JobCard` (chercher : `cd web && grep -rln "JobCard" src/`)

**Interfaces:**
- Consumes: `upsertApplicationForDocument`, `pruneAnonymousShelf` (T5).
- Produces: rien de nouveau pour les tâches suivantes.

- [ ] **Step 1: Rattacher l'export PDF à une candidature**

Dans `web/src/components/layout/TopBar.tsx`, ajouter l'import :

```ts
import { upsertApplicationForDocument, pruneAnonymousShelf } from "@/lib/applications/store";
```

Puis remplacer le bloc `await saveHistoryEntry({ … });` (actuellement lignes 105-119) par :

```ts
      // Une candidature naît de l'export dès qu'entreprise et poste sont connus.
      // Sinon le document part au rayon « Mes CV », où un seul anonyme par type
      // est conservé (l'ancien est remplacé).
      const applicationId = await upsertApplicationForDocument({
        company, role, source: "generated",
      });
      const entryId = crypto.randomUUID();
      await saveHistoryEntry({
        id: entryId,
        created_at: new Date().toISOString(),
        doc_type: currentDocType,
        company,
        role,
        job_desc: "",
        filename: `${name} - ${docType}.pdf`,
        notes: "",
        pdf_views: 1,
        editor_reloads: 0,
        last_viewed_at: new Date().toISOString(),
        json: structuredClone(json),
        templateId,
        applicationId,
      });
      if (!applicationId) await pruneAnonymousShelf(currentDocType, entryId);
```

**Attention :** `docType` et `json` viennent de la portée du composant tandis que `currentDocType` et `currentJson` viennent de `useDocStore.getState()` en début de `onConvert`. Conserver exactement les variables déjà utilisées dans le code existant pour ne rien changer au nom de fichier produit.

- [ ] **Step 2: Ajouter le bouton « Suivre » à `JobCard`**

Dans `web/src/components/jobs/JobCard.tsx`, ajouter une prop `onTrack` à la signature :

```tsx
  onTrack: (job: JobEntry) => void;
```

et, dans `.job-actions`, juste après le bouton « Candidater » :

```tsx
        <button
          type="button"
          className="neu-btn-sm"
          onClick={() => onTrack(job)}
          disabled={Boolean(job.applicationId)}
          data-testid="job-track"
          title={job.applicationId ? "Déjà suivie dans Mes candidatures" : "Suivre cette candidature"}
        >
          {job.applicationId ? "Suivie" : "Suivre"}
        </button>
```

- [ ] **Step 3: Brancher `onTrack` dans le parent**

Run: `cd web && grep -rln "JobCard" src/` pour localiser le parent (composant de la page Offres).

Dans ce parent, ajouter le gestionnaire, en suivant le style des gestionnaires voisins (`handleDismiss`, `handleSeen`) :

```tsx
  async function handleTrack(job: JobEntry) {
    const applicationId = await upsertApplicationForDocument({
      company: job.company,
      role: job.title,
      source: "ft-job",
      jobText: job.jobText,
      jobUrl: job.url,
    });
    if (!applicationId) {
      toast("Cette offre n'a ni entreprise ni intitulé exploitable.", "error");
      return;
    }
    await saveJob({ ...job, applicationId });
    toast("Ajoutée à « Mes candidatures ».", "success");
    await load();
  }
```

Ajouter les imports nécessaires (`upsertApplicationForDocument` depuis `@/lib/applications/store`, `saveJob` depuis `@/lib/storage/db`, `toast` depuis `@/state/uiStore` s'ils ne sont pas déjà importés), et passer `onTrack={handleTrack}` au `JobCard`. Adapter le nom de la fonction de rechargement (`load`) à celle réellement utilisée dans ce composant.

- [ ] **Step 4: Vérifier**

Run: `cd web && npm test`
Expected: PASS.

Run: `cd web && npm run build`
Expected: build réussi.

Dans le navigateur : exporter un PDF avec entreprise + poste renseignés, puis ouvrir `/candidatures` — la candidature doit apparaître. Vider entreprise et poste, exporter deux fois — le rayon « Mes CV » ne doit contenir qu'une seule ligne « Dernier CV exporté ».

- [ ] **Step 5: Commit**

```bash
git add web/src/components/layout/TopBar.tsx web/src/components/jobs/
git commit -m "feat(candidatures): création automatique à l'export et bouton Suivre"
```

---

### Task 12 : Navigation, redirection de `/history`, nettoyage de `/settings`

**Files:**
- Modify: `web/src/components/layout/SegmentedNav.tsx:6-10`
- Modify: `web/src/app/history/page.tsx` (devient une redirection)
- Modify: `web/src/app/settings/page.tsx` (retrait de la section Dashboard et du titre)
- Delete: `web/src/components/history/HistoryList.tsx`, `web/src/components/history/HistoryActions.tsx` **uniquement si plus référencés**

**Interfaces:**
- Consumes: la route `/candidatures` (T10).
- Produces: rien.

- [ ] **Step 1: Mettre à jour la navigation segmentée**

Dans `web/src/components/layout/SegmentedNav.tsx`, remplacer le tableau `SCREENS` :

```ts
const SCREENS = [
  { href: "/", label: "Éditeur" },
  { href: "/jobs", label: "Offres" },
  { href: "/candidatures", label: "Candidatures" },
];
```

Mettre à jour le commentaire du composant : « Navigation segmentée des trois écrans (Éditeur / Offres / Candidatures) ».

- [ ] **Step 2: Rediriger `/history`**

**Avant d'écrire :** lire le guide de redirection de la version de Next.js du repo (`ls web/node_modules/next/dist/docs/`) pour confirmer l'API de `redirect`.

Remplacer tout le contenu de `web/src/app/history/page.tsx` par :

```tsx
import { redirect } from "next/navigation";

/** L'Historique a été absorbé par « Mes candidatures » (spec du 25/07/2026). */
export default function HistoryPage() {
  redirect("/candidatures");
}
```

- [ ] **Step 3: Retirer le dashboard de Paramètres**

Dans `web/src/app/settings/page.tsx` :
- remplacer le titre `Paramètres & Dashboard` par `Paramètres` ;
- supprimer entièrement la `<section className="form-section">` du bloc `{/* DASHBOARD SECTION */}` (lignes ~100-121) ;
- supprimer l'état `stats` et le `useEffect` qui le calcule (`db.history.count()`, `db.jobs.count()`, `db.snapshots.count()`, `db.templates.count()`), ainsi que l'import de `db` s'il devient inutilisé.

- [ ] **Step 4: Nettoyer les composants d'historique devenus inutiles**

Run: `cd web && grep -rn "HistoryList\|HistoryActions" src/`
- Si aucune référence ne subsiste : `git rm web/src/components/history/HistoryList.tsx web/src/components/history/HistoryActions.tsx`
- Si `HistoryActions` est encore utilisé ailleurs, le conserver et ne supprimer que le composant réellement orphelin.

- [ ] **Step 5: Vérifier**

Run: `cd web && npm run lint`
Expected: aucune erreur (notamment aucun import inutilisé).

Run: `cd web && npm test`
Expected: PASS.

Run: `cd web && npm run build`
Expected: build réussi.

Dans le navigateur : `/history` redirige vers `/candidatures` ; le contrôle segmenté affiche « Candidatures » et son curseur se positionne correctement ; `/settings` n'a plus de dashboard.

- [ ] **Step 6: Commit**

```bash
git add -A web/src
git commit -m "refactor(candidatures): /history absorbée, dashboard retiré de Paramètres"
```

---

### Task 13 : Vérification finale et conformité à la maquette

**Files:**
- Modify: `PROJECT_INDEX.md` (routes et modèle de données)
- Modify: `WORK_HISTORY.md` (entrée de journal)

- [ ] **Step 1: Suite complète**

Run: `cd web && npm test`
Expected: PASS, aucun test ignoré.

Run: `cd web && npm run lint`
Expected: aucune erreur.

Run: `cd web && npm run build`
Expected: build réussi.

- [ ] **Step 2: Contrôle visuel dans les deux thèmes**

Ouvrir `/candidatures` via l'outil de preview. Comparer côte à côte avec `docs/design/candidatures/page-light.html` puis `page-dark.html` (servis par la configuration `maquettes` de `.claude/launch.json`, port 4173).

Vérifier point par point : médaillon d'ancienneté creusé et coloré selon l'état, anneau orange sur un entretien, carte estompée en « Sans suite », badges aux bonnes couleurs sémantiques, tuiles du dashboard, contrôle segmenté sur « Candidatures », rayon « Mes CV » en bas. Basculer le thème avec le bouton de la barre du haut de l'éditeur et refaire le tour.

- [ ] **Step 3: Parcours fonctionnel complet**

1. Exporter un PDF avec entreprise + poste → la candidature apparaît, statut « En cours ».
2. Cliquer « Entretien » → badge et tuiles changent ; « Annuler » revient en arrière.
3. Cliquer « Refusée » → badge rouge, plus de bouton « Entretien ».
4. Déplier une carte → documents rattachés, journal, note ; la note persiste après rechargement de la page.
5. Exporter deux PDF sans entreprise ni poste → une seule ligne « Dernier CV exporté » dans « Mes CV ».
6. Nommer ce document → mention « conservé » ; exporter à nouveau → deux lignes.
7. Depuis `/jobs`, cliquer « Suivre » sur une offre → candidature créée avec le texte de l'offre ; le bouton affiche « Suivie ».
8. « + Ajouter » → candidature manuelle créée ; un doublon entreprise+poste ne crée pas de seconde ligne.
9. Régler le seuil à 15 jours dans `/settings` → des candidatures basculent en « Sans suite ».

- [ ] **Step 4: Mettre à jour la documentation du projet**

Dans `PROJECT_INDEX.md` : ajouter `/candidatures` à la liste des routes, signaler que `/history` redirige, ajouter la table `applications` au modèle de données (avec la note « le statut est dérivé, jamais stocké »), et mentionner les champs `HistoryEntry.applicationId` / `HistoryEntry.label` / `JobEntry.applicationId`.

Dans `WORK_HISTORY.md` : ajouter une entrée de journal datée résumant la feature, la décision du CV anonyme unique, et l'abandon explicite du suivi de variante de CV.

- [ ] **Step 5: Commit**

```bash
git add PROJECT_INDEX.md WORK_HISTORY.md
git commit -m "docs: tracker de candidatures dans l'index et le journal"
```

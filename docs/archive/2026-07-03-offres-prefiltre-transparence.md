# Pré-filtre hybride & transparence de la grille (Offres) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher la grille de notation sur la page Offres (encart dépliable) et insérer un pré-filtre mots-clés gratuit qui n'envoie que les offres les plus pertinentes à l'IA.

**Architecture:** La grille de notation devient une **donnée structurée du profil** (`ScoringCriterion[]`), source unique du prompt IA **et** de l'encart. Le pré-filtre est une **fonction pure** (`relevance`) appliquée côté client dans `JobsView` avant la boucle de notation. Tous les réglages transitent du serveur au client via les **props de la page** (`resolveProfile` reste l'unique point d'extension multi-utilisateur).

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Vitest (unitaires), Playwright (e2e), Dexie (déjà en place, non modifié ici).

## Global Constraints

- Tout le code vit dans `web/`. **Aucune dépendance ajoutée** (les tests nouveaux portent sur des fonctions pures → Vitest suffit).
- **Aucune couleur en dur** : uniquement des variables de thème (`--bg`, `--text`, `--muted`, `--border`, `--orange`…).
- Le prompt IA envoyé à Gemini doit rester **identique** à l'actuel (le texte reconstruit depuis la structure doit correspondre au caractère près).
- Après chaque tâche, ajouter une ligne au **Journal** de `web/../REWRITE_PROGRESS.md` (`C:\Users\tahet\projects\cv-tailor\REWRITE_PROGRESS.md`).
- Commandes de vérification (depuis `web/`) : `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`.
- Répertoire de travail des commandes : `C:\Users\tahet\projects\cv-tailor\web`.

---

## File Structure

- `web/src/lib/jobs/profile.ts` — **modifié** : grille structurée + `prefilterKeywords` + `aiShortlist` (retire `scoreLimit` en Task 3).
- `web/src/lib/jobs/score.ts` — **modifié** : `criteriaPromptLines` (grille structurée → texte du prompt).
- `web/src/lib/jobs/score.test.ts` — **modifié** : test de `criteriaPromptLines`.
- `web/src/lib/jobs/prefilter.ts` — **créé** : fonction pure `relevance`.
- `web/src/lib/jobs/prefilter.test.ts` — **créé** : tests de `relevance`.
- `web/src/lib/jobs/resolveProfile.ts` — **modifié** (Task 3) : paramètre `req` optionnel.
- `web/src/app/jobs/page.tsx` — **modifié** (Task 3) : résout le profil, passe `config` en props.
- `web/src/components/jobs/JobsView.tsx` — **modifié** (Task 3, 4) : `config` par props, pré-filtre, encart.
- `web/src/app/api/jobs/search/route.ts` — **modifié** (Task 3) : réponse allégée `{ offers }`.
- `web/src/components/jobs/ScoringInfo.tsx` — **créé** (Task 4) : encart de transparence.
- `web/src/app/globals.css` — **modifié** (Task 4) : styles de l'encart.
- `web/tests/e2e/jobs.spec.ts` — **modifié** (Task 3, 4) : mocks allégés + pré-filtre + encart.

---

## Task 1: Grille structurée dans le profil + prompt reconstruit

**Files:**
- Modify: `web/src/lib/jobs/profile.ts`
- Modify: `web/src/lib/jobs/score.ts`
- Test: `web/src/lib/jobs/score.test.ts`

**Interfaces:**
- Produces: `interface ScoringCriterion { key: string; label: string; max: number; description: string }` (exporté depuis `profile.ts`).
- Produces: `JobSearchProfile.scoringCriteria: ScoringCriterion[]`, `JobSearchProfile.prefilterKeywords: string[]`, `JobSearchProfile.aiShortlist: number`.
- Produces: `criteriaPromptLines(criteria: ScoringCriterion[]): string` (exporté depuis `score.ts`).
- Note : `scoreLimit` reste présent dans le profil (retiré en Task 3) pour ne rien casser côté route de recherche.

- [ ] **Step 1: Écrire le test de `criteriaPromptLines`**

Dans `web/src/lib/jobs/score.test.ts`, **compléter l'import existant** de `./score` (ne PAS ajouter de nouvelle ligne d'import — `no-duplicate-imports`). Remplacer :

```ts
import { scoreOffer } from "./score";
```

par :

```ts
import { scoreOffer, criteriaPromptLines } from "./score";
```

(`DEFAULT_PROFILE` est déjà importé depuis `./profile` — le réutiliser tel quel.)

Puis ajouter, après le bloc `describe("scoreOffer", …)` existant, ce nouveau bloc :

```ts
describe("criteriaPromptLines", () => {
  it("reproduit le barème attendu depuis la grille structurée", () => {
    expect(criteriaPromptLines(DEFAULT_PROFILE.scoringCriteria)).toBe(
      "score_tech (0-40) : Match avec sa stack (CMS, intégration, SEO, analytics).\n" +
        "score_seniority (0-20) : Adapté à un profil Junior (Bac+5 avec 1-2 ans d'expérience en stage).\n" +
        "score_sector (0-15) : Pertinence dans le secteur web/e-commerce.\n" +
        "score_geo (0-15) : Ajuste avec les temps de trajet fournis (pénalise si > 45 min depuis Paris 12e).\n" +
        "score_red_flags (0-10) : 10 = aucun piège (salaire flou, travail dissimulé, ou alternance masquée).",
    );
  });
});
```

- [ ] **Step 2: Lancer le test → il échoue**

Run: `npx vitest run src/lib/jobs/score.test.ts`
Expected: FAIL (`criteriaPromptLines` n'existe pas / `scoringCriteria` n'est pas un tableau).

- [ ] **Step 3: Restructurer le profil**

Dans `web/src/lib/jobs/profile.ts` : ajouter l'interface et modifier `JobSearchProfile` + `DEFAULT_PROFILE`.

Ajouter avant `JobSearchProfile` :

```ts
/** Un critère de la grille de notation (barème + affichage). */
export interface ScoringCriterion {
  key: string;         // → champ `score_<key>` renvoyé par l'IA
  label: string;       // libellé affiché
  max: number;         // points maximum
  description: string; // ce que le critère mesure
}
```

Dans l'interface `JobSearchProfile`, **remplacer** la ligne `scoringCriteria: string;` par :

```ts
  /** Barème de notation (structuré) : alimente le prompt IA ET l'encart de transparence. */
  scoringCriteria: ScoringCriterion[];
  /** Mots-clés de compétences pour le pré-tri gratuit (minuscules). */
  prefilterKeywords: string[];
  /** Nombre max d'offres envoyées à l'IA par recherche. */
  aiShortlist: number;
```

Dans `DEFAULT_PROFILE`, **remplacer** la valeur `scoringCriteria: "…"` par le tableau, et ajouter les deux nouveaux champs (garder `scoreLimit: 40` tel quel) :

```ts
  scoringCriteria: [
    { key: "tech", label: "Technique", max: 40, description: "Match avec sa stack (CMS, intégration, SEO, analytics)." },
    { key: "seniority", label: "Séniorité", max: 20, description: "Adapté à un profil Junior (Bac+5 avec 1-2 ans d'expérience en stage)." },
    { key: "sector", label: "Secteur", max: 15, description: "Pertinence dans le secteur web/e-commerce." },
    { key: "geo", label: "Géo (trajet)", max: 15, description: "Ajuste avec les temps de trajet fournis (pénalise si > 45 min depuis Paris 12e)." },
    { key: "red_flags", label: "Pièges", max: 10, description: "10 = aucun piège (salaire flou, travail dissimulé, ou alternance masquée)." },
  ],
  prefilterKeywords: [
    "seo", "référencement", "wordpress", "drupal", "cms", "éditorial", "contenu",
    "rédaction", "sea", "google ads", "analytics", "webmaster", "digital",
    "e-commerce", "shopify", "community", "marketing", "web",
  ],
  aiShortlist: 20,
```

- [ ] **Step 4: Ajouter `criteriaPromptLines` et l'utiliser dans `scoreOffer`**

Dans `web/src/lib/jobs/score.ts` :

Ajouter l'import du type en tête (compléter l'import existant depuis `./profile`) :

```ts
import type { CommuteMode, JobSearchProfile, ScoringCriterion } from "./profile";
```

Ajouter la fonction pure (au-dessus de `scoreOffer`) :

```ts
/** Barème structuré → lignes du prompt (`score_<key> (0-<max>) : <description>`). */
export function criteriaPromptLines(criteria: ScoringCriterion[]): string {
  return criteria.map((c) => `score_${c.key} (0-${c.max}) : ${c.description}`).join("\n");
}
```

Dans `scoreOffer`, **remplacer** dans la construction de `system` la ligne `profile.scoringCriteria` par `criteriaPromptLines(profile.scoringCriteria)` :

```ts
  const system =
    "Tu es un recruteur expert. Évalue cette offre pour le candidat suivant :\n" +
    `${profile.candidateSummary}\n\n` +
    "Évalue sur 100 :\n" +
    criteriaPromptLines(profile.scoringCriteria);
```

- [ ] **Step 5: Lancer le test → il passe**

Run: `npx vitest run src/lib/jobs/score.test.ts`
Expected: PASS.

- [ ] **Step 6: Vérifier la compilation globale**

Run: `npx tsc --noEmit`
Expected: aucune erreur (seule `score.ts` consommait `scoringCriteria` ; `scoreLimit` intact → route de recherche inchangée).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/jobs/profile.ts web/src/lib/jobs/score.ts web/src/lib/jobs/score.test.ts
git commit -m "feat(offres): grille de notation structurée dans le profil (source unique prompt+UI)"
```

---

## Task 2: Fonction pure de pré-filtre `relevance`

**Files:**
- Create: `web/src/lib/jobs/prefilter.ts`
- Test: `web/src/lib/jobs/prefilter.test.ts`

**Interfaces:**
- Produces: `relevance(offer: { title: string; jobText: string }, keywords: string[]): number` (exporté depuis `prefilter.ts`).

- [ ] **Step 1: Écrire les tests**

Créer `web/src/lib/jobs/prefilter.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { relevance } from "./prefilter";

describe("relevance", () => {
  it("compte le titre (×2) et la description (×1)", () => {
    const offer = { title: "Webmaster SEO", jobText: "Missions WordPress et analytics." };
    // seo → titre (+2) ; wordpress → desc (+1) ; analytics → desc (+1) ; java → 0
    expect(relevance(offer, ["seo", "wordpress", "analytics", "java"])).toBe(4);
  });

  it("renvoie 0 sans aucun recoupement", () => {
    const offer = { title: "Boulanger", jobText: "Pétrin, four et pâtisserie." };
    expect(relevance(offer, ["seo", "wordpress"])).toBe(0);
  });

  it("est insensible à la casse", () => {
    const offer = { title: "Chargé SEO", jobText: "" };
    expect(relevance(offer, ["SEO"])).toBe(2);
  });
});
```

- [ ] **Step 2: Lancer le test → il échoue**

Run: `npx vitest run src/lib/jobs/prefilter.test.ts`
Expected: FAIL (module `./prefilter` introuvable).

- [ ] **Step 3: Implémenter la fonction**

Créer `web/src/lib/jobs/prefilter.ts` :

```ts
/**
 * Pré-tri gratuit (sans IA) des offres. Mesure la pertinence d'une offre pour un profil
 * via ses mots-clés de compétences : chaque mot-clé présent dans le titre vaut 2, dans la
 * description vaut 1. 0 = aucun recoupement (offre écartée avant l'IA).
 */
export function relevance(
  offer: { title: string; jobText: string },
  keywords: string[],
): number {
  const title = offer.title.toLowerCase();
  const desc = offer.jobText.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (title.includes(k)) score += 2;
    if (desc.includes(k)) score += 1;
  }
  return score;
}
```

- [ ] **Step 4: Lancer le test → il passe**

Run: `npx vitest run src/lib/jobs/prefilter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/jobs/prefilter.ts web/src/lib/jobs/prefilter.test.ts
git commit -m "feat(offres): fonction pure relevance pour le pré-tri mots-clés"
```

---

## Task 3: Pré-filtre « Équilibré » + config par props serveur

**Files:**
- Modify: `web/src/lib/jobs/resolveProfile.ts`
- Modify: `web/src/lib/jobs/profile.ts` (retirer `scoreLimit`)
- Modify: `web/src/app/api/jobs/search/route.ts`
- Modify: `web/src/app/jobs/page.tsx`
- Modify: `web/src/components/jobs/JobsView.tsx`
- Test: `web/tests/e2e/jobs.spec.ts`

**Interfaces:**
- Consumes: `relevance` (Task 2), `JobSearchProfile.{minScore,aiShortlist,prefilterKeywords,scoringCriteria}` (Task 1).
- Produces: `type JobsConfig` (exporté depuis `JobsView.tsx`) :
  ```ts
  export type JobsConfig = {
    minScore: number;
    aiShortlist: number;
    prefilterKeywords: string[];
    criteria: { label: string; max: number; description: string }[];
  };
  ```
- Produces: `JobsView` prend désormais `{ config: JobsConfig }` en props.

- [ ] **Step 1: Écrire le test e2e du pré-filtre (offre hors-sujet non notée)**

Ajouter dans `web/tests/e2e/jobs.spec.ts` (après les tests existants) :

```ts
test("une offre sans recoupement mots-clés n'est pas notée", async ({ page }) => {
  let scoreCalls = 0;
  const OFFTOPIC = { ...OFFER, id: "2", title: "Boulanger", jobText: "Pétrin, four et pâtisserie artisanale." };
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER, OFFTOPIC] } }),
  );
  await page.route("**/api/jobs/score", (route) => {
    scoreCalls++;
    route.fulfill({ json: { score: 88, breakdown: { total_score: 88 }, commute: {}, commuteText: "TC: 25 min" } });
  });

  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);
  await expect(page.getByTestId("jobs-scan")).toBeEnabled();
  expect(scoreCalls).toBe(1); // seule l'offre pertinente (OFFER) est notée
});
```

- [ ] **Step 2: Adapter les mocks existants à la réponse allégée `{ offers }`**

Dans `web/tests/e2e/jobs.spec.ts` :

Dans `mockScanOk`, remplacer la réponse `search` par :

```ts
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER] } }),
  );
```

Dans le test « une offre déjà explorée n'est pas re-notée… », remplacer sa route `search` inline par :

```ts
  await page.route("**/api/jobs/search", (route) =>
    route.fulfill({ json: { offers: [OFFER] } }),
  );
```

- [ ] **Step 3: Lancer les e2e → le nouveau test échoue (et rien n'est cassé au typage)**

Run: `npx playwright test jobs.spec.ts --reporter=line`
Expected: le test « sans recoupement » échoue (2 offres notées, `scoreCalls` = 2), car le pré-filtre n'existe pas encore.

- [ ] **Step 4: Rendre `resolveProfile` appelable sans requête**

Remplacer le corps de `web/src/lib/jobs/resolveProfile.ts` (signature) :

```ts
export function resolveProfile(req?: Request): JobSearchProfile {
  void req; // réservé pour la résolution par compte (SaaS)
  return DEFAULT_PROFILE;
}
```

- [ ] **Step 5: Retirer `scoreLimit` du profil**

Dans `web/src/lib/jobs/profile.ts` : supprimer la propriété `scoreLimit` de l'interface `JobSearchProfile` **et** la ligne `scoreLimit: 40,` de `DEFAULT_PROFILE`.

- [ ] **Step 6: Alléger la réponse de la route de recherche**

Dans `web/src/app/api/jobs/search/route.ts`, remplacer la ligne de retour :

```ts
    // La config (seuils, plafond) transite par les props serveur ; ici, seulement les offres.
    return NextResponse.json({ offers });
```

(Supprimer le commentaire `// scoreLimit/minScore viennent du profil…` juste au-dessus.)

- [ ] **Step 7: Passer la config depuis la page serveur**

Remplacer `web/src/app/jobs/page.tsx` par :

```tsx
import Link from "next/link";
import JobsView from "@/components/jobs/JobsView";
import { resolveProfile } from "@/lib/jobs/resolveProfile";

export const metadata = {
  title: "Offres — CV Tailor",
};

export default function JobsPage() {
  const profile = resolveProfile();
  const config = {
    minScore: profile.minScore,
    aiShortlist: profile.aiShortlist,
    prefilterKeywords: profile.prefilterKeywords,
    criteria: profile.scoringCriteria.map(({ label, max, description }) => ({ label, max, description })),
  };

  return (
    <div className="wrap">
      <header className="topbar">
        <h1 className="hist-h1">Offres</h1>
        <div className="topbar-actions">
          <Link href="/" style={{ color: "var(--link)", fontWeight: 600, fontSize: "14px" }}>
            ‹ Retour
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <JobsView config={config} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Câbler `JobsView` sur la config + appliquer le pré-filtre**

Dans `web/src/components/jobs/JobsView.tsx` :

Compléter l'import depuis `db` (inchangé) et ajouter l'import du pré-filtre :

```ts
import { relevance } from "@/lib/jobs/prefilter";
```

Ajouter le type exporté (près de `ScanState`) :

```ts
export type JobsConfig = {
  minScore: number;
  aiShortlist: number;
  prefilterKeywords: string[];
  criteria: { label: string; max: number; description: string }[];
};
```

Changer la signature du composant :

```ts
export default function JobsView({ config }: { config: JobsConfig }) {
```

Dans `scan()`, remplacer le bloc actuel (de `const offers: JobOffer[] = data.offers ?? [];` jusqu'à `const toScore = fresh.slice(0, limit);`) par :

```ts
      const offers: JobOffer[] = data.offers ?? [];
      const minScore = config.minScore;

      // Écarter les offres déjà en base (dédoublonnage local).
      const fresh: JobOffer[] = [];
      for (const o of offers) {
        if (o.id && !(await jobExists(o.id))) fresh.push(o);
      }

      // Pré-filtre « Équilibré » : classer par pertinence mots-clés, écarter les offres
      // à recoupement nul, ne noter que les meilleures (plafond aiShortlist). Zéro appel IA.
      const toScore = fresh
        .map((o) => ({ o, r: relevance(o, config.prefilterKeywords) }))
        .filter((x) => x.r > 0)
        .sort((a, b) => b.r - a.r)
        .map((x) => x.o)
        .slice(0, config.aiShortlist);
```

(Le reste de `scan()` est inchangé : la boucle utilise déjà `minScore` et `toScore`.)

- [ ] **Step 9: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 10: Lancer les e2e → tout passe**

Run: `npx playwright test jobs.spec.ts --reporter=line`
Expected: PASS (les 4 tests existants + le nouveau « sans recoupement »).

- [ ] **Step 11: Commit**

```bash
git add web/src/lib/jobs/resolveProfile.ts web/src/lib/jobs/profile.ts web/src/app/api/jobs/search/route.ts web/src/app/jobs/page.tsx web/src/components/jobs/JobsView.tsx web/tests/e2e/jobs.spec.ts
git commit -m "feat(offres): pré-filtre mots-clés « Équilibré » + config du profil par props serveur"
```

---

## Task 4: Encart de transparence de la grille

**Files:**
- Create: `web/src/components/jobs/ScoringInfo.tsx`
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/tests/e2e/jobs.spec.ts`

**Interfaces:**
- Consumes: `JobsConfig` (Task 3), `config.criteria`, `config.minScore`.
- Produces: composant `ScoringInfo` rendu en tête de `JobsView` (`data-testid="scoring-info"`).

- [ ] **Step 1: Écrire le test e2e de l'encart**

Ajouter dans `web/tests/e2e/jobs.spec.ts` :

```ts
test("l'encart de notation s'ouvre et affiche la grille", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");

  const info = page.getByTestId("scoring-info");
  await expect(info).toBeVisible();
  await info.locator("summary").click();
  await expect(info.getByText("Technique")).toBeVisible();
  await expect(info.getByText("Seuil de sélection")).toBeVisible();
});
```

- [ ] **Step 2: Lancer le test → il échoue**

Run: `npx playwright test jobs.spec.ts --reporter=line -g "encart de notation"`
Expected: FAIL (`scoring-info` introuvable).

- [ ] **Step 3: Créer le composant `ScoringInfo`**

Créer `web/src/components/jobs/ScoringInfo.tsx` :

```tsx
import type { JobsConfig } from "./JobsView";

/** Encart dépliable expliquant comment les offres sont notées (grille issue du profil). */
export default function ScoringInfo({
  criteria,
  minScore,
}: {
  criteria: JobsConfig["criteria"];
  minScore: number;
}) {
  return (
    <details className="scoring-info" data-testid="scoring-info">
      <summary className="scoring-info__summary">Comment les offres sont-elles notées ?</summary>
      <div className="scoring-info__body">
        <p>
          Un pré-tri par mots-clés écarte les offres hors-sujet, puis une IA (jouant le rôle
          d&apos;un recruteur) note les autres sur 100 selon cette grille.
        </p>
        <table className="scoring-info__table">
          <thead>
            <tr>
              <th>Critère</th>
              <th>Points</th>
              <th>Ce que ça mesure</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>0–{c.max}</td>
                <td>{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="scoring-info__threshold">
          Seuil de sélection : <strong>{minScore}/100</strong>.
        </p>
      </div>
    </details>
  );
}
```

- [ ] **Step 4: Rendre l'encart dans `JobsView`**

Dans `web/src/components/jobs/JobsView.tsx` :

Ajouter l'import :

```ts
import ScoringInfo from "./ScoringInfo";
```

Dans le `return` principal, insérer l'encart comme **premier enfant** de `<div className="jobs-view">`, juste avant `<div className="jobs-toolbar">` :

```tsx
    <div className="jobs-view">
      <ScoringInfo criteria={config.criteria} minScore={config.minScore} />
      <div className="jobs-toolbar">
```

(Ne pas modifier le reste du `return`. Note : le bloc `if (configMsg)` renvoie plus haut et n'affiche pas l'encart — c'est voulu, l'écran de config prime.)

- [ ] **Step 5: Ajouter les styles**

Ajouter à la fin de `web/src/app/globals.css` (variables de thème uniquement) :

```css
/* ---- Encart de transparence de la notation (Offres) ---- */
.scoring-info {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.scoring-info__summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--orange);
}
.scoring-info__body {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text);
}
.scoring-info__table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}
.scoring-info__table th,
.scoring-info__table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.scoring-info__table th {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.scoring-info__threshold {
  color: var(--muted);
}
```

- [ ] **Step 6: Lancer le test de l'encart → il passe**

Run: `npx playwright test jobs.spec.ts --reporter=line -g "encart de notation"`
Expected: PASS.

- [ ] **Step 7: Vérification complète**

Run (depuis `web/`) : `npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run test:e2e`
Expected: tout vert (tsc sans erreur ; lint sans nouvelle erreur ; unitaires y compris `prefilter`/`score` ; e2e y compris pré-filtre + encart).

- [ ] **Step 8: Commit**

```bash
git add web/src/components/jobs/ScoringInfo.tsx web/src/components/jobs/JobsView.tsx web/src/app/globals.css web/tests/e2e/jobs.spec.ts
git commit -m "feat(offres): encart dépliable de la grille de notation sur la page Offres"
```

---

## Notes de vérification finale (après Task 4)

1. Local (`web/`) : la suite complète est verte (Step 7 de Task 4).
2. Push sur `feature/refonte-ui-nextjs` → auto-deploy Vercel READY.
3. Prod (`https://cv-tailor-drab-rho.vercel.app/jobs`) :
   - l'encart « Comment les offres sont-elles notées ? » s'ouvre et affiche les 5 critères + le seuil 70 ;
   - une recherche envoie **au plus 20** offres à l'IA (indicateur « notées ») et les offres sans recoupement ne sont pas notées.

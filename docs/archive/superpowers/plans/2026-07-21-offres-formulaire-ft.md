# Refonte Offres — formulaire de recherche pro (France Travail) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le profil de recherche codé en dur par un formulaire paramétrable dont les champs sont mappés sur les vrais paramètres de l'API France Travail, avec autocomplétion du lieu.

**Architecture:** Le cœur (`fetchOffers`, `prefilter`, `score`, `maps`) reçoit déjà le profil en argument. On (1) enrichit le modèle `JobSearchProfile` + validation Zod, (2) étend `fetchOffers` aux nouveaux paramètres FT, (3) fait transiter le profil dans le corps des requêtes API, (4) ajoute une route + un composant d'autocomplétion de lieu, (5) construit le formulaire `ProfileForm`. Persistance locale Dexie (une ligne).

**Tech Stack:** Next.js (version du repo — voir `web/AGENTS.md`), React, TypeScript, Zod, Dexie (IndexedDB), Vitest.

## Global Constraints

- Tout le code vit dans `web/`. Commandes depuis `web/`.
- **Aucune donnée personnelle de Hariss dans `web/src`** : `grep -ri "hariss\|jean bouton" web/src` doit être vide. Les valeurs de Hariss vont dans `web/tests/fixtures/job_profile_hariss.json`.
- Design system : **variables CSS uniquement**, jamais de couleur en dur. Réutiliser chips / segmented / toggles existants de l'atelier.
- `uiAlert`/`uiConfirm`/`uiPrompt`/`toast` (dans `src/state/uiStore.ts`) — jamais les natifs `alert`/`confirm`/`prompt`.
- Ne pas toucher au pipeline document (`docStore.html`, react-pdf).
- **Next.js** : relire `node_modules/next/dist/docs/` avant tout code de route/handler (breaking changes vs entraînement, cf. `web/AGENTS.md`).
- Tests co-localisés (`*.test.ts` à côté du fichier). `npm test` = `vitest run`.
- Vérification finale de chaque mission : `npm test`, `npx tsc --noEmit`, `npm run lint`.

---

## Mission M1 — Modèle enrichi, validation Zod, fixture Hariss

**But :** `JobSearchProfile` enrichi, schéma Zod, `EMPTY_PROFILE` neutre, fixture Hariss, tests existants migrés. Aucun champ FT n'est encore envoyé (M2).

### Task 1.1 : Enrichir le type `JobSearchProfile` et remplacer `DEFAULT_PROFILE` par `EMPTY_PROFILE`

**Files:**
- Modify: `web/src/lib/jobs/profile.ts`
- Create: `web/tests/fixtures/job_profile_hariss.json`

**Interfaces:**
- Produces : type `LocationFilter`, `LocationKind`, `JobSearchProfile` enrichi, const `EMPTY_PROFILE: JobSearchProfile`.
- Consumes : rien.

- [ ] **Step 1 : Réécrire `profile.ts`** (remplace intégralement le fichier)

```ts
/**
 * Profil de recherche d'offres — pièce centrale de la paramétrabilité.
 * Tous les réglages modifiables vivent ici, dans un objet unique passé en argument
 * aux fonctions `lib/jobs/`. Défauts neutres (EMPTY_PROFILE) ; les critères réels
 * sont saisis via l'UI et persistés dans Dexie. Cf. spec
 * `docs/archive/superpowers/specs/2026-07-21-refonte-offres-formulaire-ft-design.md`.
 */

export type CommuteMode = "transit" | "driving" | "bicycling" | "walking";

/** Portée géographique d'un filtre de lieu (mappe les paramètres FT commune/departement/region). */
export type LocationKind = "commune" | "departement" | "region";

export interface LocationFilter {
  kind: LocationKind;
  code: string;   // code INSEE (commune 5 chiffres, département, région) ; "" = national
  label: string;  // libellé affiché, ex. "Paris 12e (75012)" / "Île-de-France"
  radiusKm: number; // rayon km, appliqué seulement si kind === "commune"
}

/** Un critère de la grille de notation (barème + affichage). */
export interface ScoringCriterion {
  key: string;
  label: string;
  max: number;
  description: string;
}

export interface JobSearchProfile {
  /** Adresse de départ pour le calcul du trajet. */
  homeAddress: string;
  /** Intitulés de postes recherchés (une requête France Travail par mot-clé). */
  keywords: string[];
  /** Filtre géographique (commune+rayon, département ou région). */
  location: LocationFilter;
  /** Débutant accepté → paramètre FT experienceExige="D". */
  debutantAccepte: boolean;
  /** Niveau d'expérience FT : "" (indifférent), "1" (-1 an), "2" (1-3 ans), "3" (+3 ans). */
  experienceLevel: "" | "1" | "2" | "3";
  /** Qualification FT : "" (indifférent), "0" (non-cadre), "9" (cadre). */
  qualification: "" | "0" | "9";
  /** Temps plein FT : "" (indifférent), "true" (plein), "false" (partiel). */
  tempsPlein: "" | "true" | "false";
  /** Modes de transport à calculer (Google Distance Matrix). */
  commuteModes: CommuteMode[];
  /** Types de contrat France Travail (ex. ["CDI", "CDD"]). */
  contractTypes: string[];
  /** Codes ROME (avancé, optionnel) → paramètre FT codeROME. */
  romeCodes: string[];
  /** Mots-clés à inclure : filtre serveur strict sur titre+description. */
  includeKeywords: string[];
  /** Ancienneté maximale des offres, en jours. */
  maxAgeDays: number;
  /** Mots interdits dans titre/description/type de contrat (filtre stages/alternances). */
  excludedWords: string[];
  /** Salaire minimum annuel/mensuel/horaire (null = pas de filtre). */
  salaireMin: number | null;
  /** Période du salaire : "M" (mensuel), "A" (annuel), "H" (horaire). */
  periodeSalaire: "M" | "A" | "H";
  /** Score minimum pour retenir une offre. */
  minScore: number;
  /** Troncature de la description envoyée à l'IA. */
  maxDescriptionChars: number;
  /** Résumé du candidat injecté dans le prompt de scoring. */
  candidateSummary: string;
  /** Barème de notation (structuré) : alimente le prompt IA ET l'encart de transparence. */
  scoringCriteria: ScoringCriterion[];
  /** Mots-clés de compétences pour le pré-tri gratuit (minuscules). */
  prefilterKeywords: string[];
  /** Nombre max d'offres envoyées à l'IA par recherche. */
  aiShortlist: number;
}

/** Barème générique par défaut (aucune donnée personnelle). */
const GENERIC_CRITERIA: ScoringCriterion[] = [
  { key: "tech", label: "Technique", max: 40, description: "Adéquation avec les compétences visées." },
  { key: "seniority", label: "Séniorité", max: 20, description: "Adéquation au niveau d'expérience recherché." },
  { key: "sector", label: "Secteur", max: 15, description: "Pertinence sectorielle." },
  { key: "geo", label: "Géo (trajet)", max: 15, description: "Ajuste selon les temps de trajet fournis." },
  { key: "red_flags", label: "Pièges", max: 10, description: "10 = aucun piège (salaire flou, offre douteuse)." },
];

/** Profil vide — défauts neutres. Aucune donnée personnelle. */
export const EMPTY_PROFILE: JobSearchProfile = {
  homeAddress: "",
  keywords: [],
  location: { kind: "commune", code: "", label: "", radiusKm: 10 },
  debutantAccepte: false,
  experienceLevel: "",
  qualification: "",
  tempsPlein: "",
  commuteModes: ["transit", "bicycling", "walking"],
  contractTypes: ["CDI", "CDD"],
  romeCodes: [],
  includeKeywords: [],
  maxAgeDays: 30,
  excludedWords: ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"],
  salaireMin: null,
  periodeSalaire: "M",
  minScore: 70,
  maxDescriptionChars: 3000,
  candidateSummary: "",
  scoringCriteria: GENERIC_CRITERIA,
  prefilterKeywords: [],
  aiShortlist: 20,
};
```

- [ ] **Step 2 : Créer la fixture Hariss** `web/tests/fixtures/job_profile_hariss.json`

```json
{
  "homeAddress": "4 rue jean bouton 75012 Paris",
  "keywords": [
    "Chargé SEO", "Référenceur web", "Éditorial web", "Intégrateur WordPress",
    "Développeur Shopify", "Chargé communication digital", "Webmaster",
    "Webmaster éditorial", "Chargé contenu web", "Chargé mission digital",
    "Gestionnaire contenu CMS", "Chargé marketing digital", "Chargé projet digital",
    "Gestionnaire de contenu digital", "Spécialiste contenu digital", "Rédacteur web SEO",
    "Chargé de contenu éditorial", "Community Manager SEO", "Gestionnaire de sites web",
    "Référencement naturel", "Analyste de contenu web", "Chargé SEO Junior",
    "Chargé de webmarketing", "Content manager", "Content strategist",
    "Marketing digital", "Marketing digital Junior", "Chef de projet digital",
    "Chef de projet marketing digital"
  ],
  "location": { "kind": "commune", "code": "75112", "label": "Paris 12e (75012)", "radiusKm": 10 },
  "debutantAccepte": true,
  "experienceLevel": "",
  "qualification": "",
  "tempsPlein": "",
  "commuteModes": ["transit", "bicycling", "walking"],
  "contractTypes": ["CDI", "CDD"],
  "romeCodes": [],
  "includeKeywords": [],
  "maxAgeDays": 30,
  "excludedWords": ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"],
  "salaireMin": null,
  "periodeSalaire": "M",
  "minScore": 70,
  "maxDescriptionChars": 3000,
  "candidateSummary": "Nom: Hariss Hafeji (Paris 75012)\nTitre: Webmaster / Chargé de projet Web\nFormation: Master 2 E-commerce (UPEC)\nExpériences: 3 stages/alternances (Webmastering Drupal/WP, SEO/SEA, Analytics, UI/UX, Gestion de projet agile).\nCompétences: HTML/CSS/JS/PHP, CMS (Drupal, WordPress), SEO on-page, SEA (Google Ads), Analytics (GA4, Looker), UI/UX (Figma).",
  "scoringCriteria": [
    { "key": "tech", "label": "Technique", "max": 40, "description": "Match avec sa stack (CMS, intégration, SEO, analytics)." },
    { "key": "seniority", "label": "Séniorité", "max": 20, "description": "Adapté à un profil Junior (Bac+5 avec 1-2 ans d'expérience en stage)." },
    { "key": "sector", "label": "Secteur", "max": 15, "description": "Pertinence dans le secteur web/e-commerce." },
    { "key": "geo", "label": "Géo (trajet)", "max": 15, "description": "Ajuste avec les temps de trajet fournis (pénalise si > 45 min depuis Paris 12e)." },
    { "key": "red_flags", "label": "Pièges", "max": 10, "description": "10 = aucun piège (salaire flou, travail dissimulé, ou alternance masquée)." }
  ],
  "prefilterKeywords": [
    "seo", "référencement", "wordpress", "drupal", "cms", "éditorial", "contenu",
    "rédaction", "sea", "google ads", "analytics", "webmaster", "digital",
    "e-commerce", "shopify", "community", "marketing", "web"
  ],
  "aiShortlist": 20
}
```

- [ ] **Step 3 : Vérifier la compilation** — `npx tsc --noEmit`. Attendu : erreurs uniquement là où `DEFAULT_PROFILE` est encore importé (`francetravail.test.ts`, `resolveProfile.ts`, et tout autre). Ce sont les cibles des tâches suivantes.

- [ ] **Step 4 : Commit**

```bash
git add web/src/lib/jobs/profile.ts web/tests/fixtures/job_profile_hariss.json
git commit -m "feat(jobs): profil enrichi (champs FT) + EMPTY_PROFILE neutre + fixture Hariss"
```

### Task 1.2 : Schéma Zod de validation du profil

**Files:**
- Create: `web/src/lib/jobs/profileSchema.ts`
- Test: `web/src/lib/jobs/profileSchema.test.ts`

**Interfaces:**
- Consumes : `JobSearchProfile`, `EMPTY_PROFILE` de `./profile`.
- Produces : `jobSearchProfileSchema` (Zod), `parseProfile(input: unknown): JobSearchProfile` (valide et complète avec les défauts neutres).

- [ ] **Step 1 : Écrire le test** `profileSchema.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseProfile } from "./profileSchema";
import { EMPTY_PROFILE } from "./profile";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";

describe("parseProfile", () => {
  it("complète un objet vide avec les défauts neutres", () => {
    expect(parseProfile({})).toEqual(EMPTY_PROFILE);
  });

  it("valide et normalise le profil Hariss (fixture)", () => {
    const p = parseProfile(hariss);
    expect(p.keywords).toHaveLength(29);
    expect(p.location).toEqual({ kind: "commune", code: "75112", label: "Paris 12e (75012)", radiusKm: 10 });
    expect(p.debutantAccepte).toBe(true);
  });

  it("rejette une valeur experienceLevel hors énum", () => {
    const p = parseProfile({ experienceLevel: "9" });
    expect(p.experienceLevel).toBe(""); // valeur invalide → défaut neutre
  });

  it("garde les champs fournis et complète les manquants", () => {
    const p = parseProfile({ keywords: ["Webmaster"] });
    expect(p.keywords).toEqual(["Webmaster"]);
    expect(p.minScore).toBe(70);
  });
});
```

- [ ] **Step 2 : Lancer le test — échec attendu** — `npx vitest run src/lib/jobs/profileSchema.test.ts`. Attendu : FAIL (`parseProfile` introuvable).

- [ ] **Step 3 : Implémenter** `profileSchema.ts`

```ts
import { z } from "zod";
import { EMPTY_PROFILE, type JobSearchProfile } from "./profile";

const locationSchema = z.object({
  kind: z.enum(["commune", "departement", "region"]).catch("commune"),
  code: z.string().catch(""),
  label: z.string().catch(""),
  radiusKm: z.number().min(0).max(200).catch(10),
});

const criterionSchema = z.object({
  key: z.string(),
  label: z.string(),
  max: z.number(),
  description: z.string(),
});

/**
 * Schéma tolérant : chaque champ retombe sur le défaut neutre d'EMPTY_PROFILE
 * via `.catch(...)`, pour qu'un corps de requête partiel ou légèrement invalide
 * ne casse jamais la recherche (on complète plutôt que rejeter).
 */
export const jobSearchProfileSchema = z.object({
  homeAddress: z.string().catch(EMPTY_PROFILE.homeAddress),
  keywords: z.array(z.string()).catch(EMPTY_PROFILE.keywords),
  location: locationSchema.catch(EMPTY_PROFILE.location),
  debutantAccepte: z.boolean().catch(EMPTY_PROFILE.debutantAccepte),
  experienceLevel: z.enum(["", "1", "2", "3"]).catch(EMPTY_PROFILE.experienceLevel),
  qualification: z.enum(["", "0", "9"]).catch(EMPTY_PROFILE.qualification),
  tempsPlein: z.enum(["", "true", "false"]).catch(EMPTY_PROFILE.tempsPlein),
  commuteModes: z.array(z.enum(["transit", "driving", "bicycling", "walking"])).catch(EMPTY_PROFILE.commuteModes),
  contractTypes: z.array(z.string()).catch(EMPTY_PROFILE.contractTypes),
  romeCodes: z.array(z.string()).catch(EMPTY_PROFILE.romeCodes),
  includeKeywords: z.array(z.string()).catch(EMPTY_PROFILE.includeKeywords),
  maxAgeDays: z.number().int().min(1).max(365).catch(EMPTY_PROFILE.maxAgeDays),
  excludedWords: z.array(z.string()).catch(EMPTY_PROFILE.excludedWords),
  salaireMin: z.number().positive().nullable().catch(EMPTY_PROFILE.salaireMin),
  periodeSalaire: z.enum(["M", "A", "H"]).catch(EMPTY_PROFILE.periodeSalaire),
  minScore: z.number().int().min(0).max(100).catch(EMPTY_PROFILE.minScore),
  maxDescriptionChars: z.number().int().min(500).max(10000).catch(EMPTY_PROFILE.maxDescriptionChars),
  candidateSummary: z.string().catch(EMPTY_PROFILE.candidateSummary),
  scoringCriteria: z.array(criterionSchema).catch(EMPTY_PROFILE.scoringCriteria),
  prefilterKeywords: z.array(z.string()).catch(EMPTY_PROFILE.prefilterKeywords),
  aiShortlist: z.number().int().min(1).max(100).catch(EMPTY_PROFILE.aiShortlist),
});

/** Valide un input inconnu et complète les champs manquants avec les défauts neutres. */
export function parseProfile(input: unknown): JobSearchProfile {
  const base = (input && typeof input === "object") ? input : {};
  return jobSearchProfileSchema.parse({ ...EMPTY_PROFILE, ...base });
}
```

> **Note Zod** : `z.enum([...]).catch(x)` requiert Zod ≥ 3.20 (présent dans `node_modules`). Si `.catch` sur `z.enum` pose souci à la version installée, remplacer par `z.string().transform(v => allowed.includes(v) ? v : default)`.

- [ ] **Step 4 : Lancer le test — succès attendu** — `npx vitest run src/lib/jobs/profileSchema.test.ts`. Attendu : PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/profileSchema.ts web/src/lib/jobs/profileSchema.test.ts
git commit -m "feat(jobs): schéma Zod parseProfile (validation tolérante + défauts)"
```

### Task 1.3 : Migrer les tests qui importaient `DEFAULT_PROFILE`

**Files:**
- Modify: `web/src/lib/jobs/francetravail.test.ts`
- Modify: `web/src/lib/jobs/score.test.ts` (si présent — vérifier l'import)

**Interfaces:**
- Consumes : fixture Hariss (`../../../tests/fixtures/job_profile_hariss.json`) via `parseProfile`.

- [ ] **Step 1 : Repérer les imports** — `grep -rn "DEFAULT_PROFILE" web/src`. Pour chaque fichier de test listé, remplacer l'import par la fixture.

- [ ] **Step 2 : Éditer `francetravail.test.ts`** — remplacer les lignes 3 et les usages :

Remplacer :
```ts
import { DEFAULT_PROFILE } from "./profile";
```
par :
```ts
import { parseProfile } from "./profileSchema";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";
const DEFAULT_PROFILE = parseProfile(hariss);
```
(le reste du fichier — `DEFAULT_PROFILE.excludedWords`, `fetchOffers("tok", "SEO", DEFAULT_PROFILE)` — reste inchangé.)

- [ ] **Step 3 : Éditer les autres fichiers** trouvés au Step 1 avec le même remplacement (import fixture + `parseProfile`).

- [ ] **Step 4 : Vérifier** — `npm test`. Attendu : verts (les tests utilisent désormais la fixture, comportement identique à l'ancien `DEFAULT_PROFILE`).

- [ ] **Step 5 : Vérifier tsc** — `npx tsc --noEmit`. Attendu : reste uniquement l'erreur dans `resolveProfile.ts` (cible M3).

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/jobs/*.test.ts
git commit -m "test(jobs): migrer DEFAULT_PROFILE vers la fixture Hariss"
```

---

## Mission M2 — `fetchOffers` étendu + filtre `includeKeywords`

**Dépend de :** M1.

> ⚠️ **Avant de commencer M2** : confirmer les noms/valeurs exacts des paramètres FT contre `https://francetravail.io/data/api/offres-emploi` (section « Rechercher par critères »). Valider en priorité : `distance` (rayon km), `experienceExige` (D/S/E), `experience` (1/2/3), `qualification` (0/9), `tempsPlein` (booléen `"true"`/`"false"`), `salaireMin` + `periodeSalaire` (M/A/H), `codeROME`. Si un nom diffère, corriger le code ET les assertions de test ci-dessous.

### Task 2.1 : Étendre `fetchOffers` aux nouveaux paramètres FT

**Files:**
- Modify: `web/src/lib/jobs/francetravail.ts` (fonction `fetchOffers`, lignes 65-87)
- Modify: `web/src/lib/jobs/francetravail.test.ts` (describe `fetchOffers`)

**Interfaces:**
- Consumes : `JobSearchProfile` (champs `location`, `debutantAccepte`, `experienceLevel`, `qualification`, `tempsPlein`, `contractTypes`, `romeCodes`, `salaireMin`, `periodeSalaire`, `maxAgeDays`).
- Produces : `fetchOffers` inchangé de signature ; l'URL construite porte les nouveaux paramètres.

- [ ] **Step 1 : Écrire les tests** (ajouter dans le `describe("fetchOffers")` de `francetravail.test.ts`)

```ts
it("construit les paramètres géo commune + rayon", async () => {
  const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
  vi.stubGlobal("fetch", fetchMock);
  const p = parseProfile({ ...hariss, location: { kind: "commune", code: "75112", label: "", radiusKm: 15 } });
  await fetchOffers("tok", "SEO", p);
  const [url] = fetchMock.mock.calls[0] as unknown as [string];
  expect(url).toContain("commune=75112");
  expect(url).toContain("distance=15");
  expect(url).not.toContain("region=");
});

it("construit region quand kind=region", async () => {
  const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
  vi.stubGlobal("fetch", fetchMock);
  const p = parseProfile({ ...hariss, location: { kind: "region", code: "11", label: "", radiusKm: 10 } });
  await fetchOffers("tok", "SEO", p);
  const [url] = fetchMock.mock.calls[0] as unknown as [string];
  expect(url).toContain("region=11");
  expect(url).not.toContain("commune=");
});

it("ajoute experienceExige=D si débutant accepté, sinon absent", async () => {
  const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
  vi.stubGlobal("fetch", fetchMock);
  await fetchOffers("tok", "SEO", parseProfile({ ...hariss, debutantAccepte: true }));
  await fetchOffers("tok", "SEO", parseProfile({ ...hariss, debutantAccepte: false }));
  const [u1] = fetchMock.mock.calls[0] as unknown as [string];
  const [u2] = fetchMock.mock.calls[1] as unknown as [string];
  expect(u1).toContain("experienceExige=D");
  expect(u2).not.toContain("experienceExige");
});

it("ajoute salaireMin + periodeSalaire quand défini", async () => {
  const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
  vi.stubGlobal("fetch", fetchMock);
  const p = parseProfile({ ...hariss, salaireMin: 30000, periodeSalaire: "A" });
  await fetchOffers("tok", "SEO", p);
  const [url] = fetchMock.mock.calls[0] as unknown as [string];
  expect(url).toContain("salaireMin=30000");
  expect(url).toContain("periodeSalaire=A");
});
```

- [ ] **Step 2 : Lancer — échec attendu** — `npx vitest run src/lib/jobs/francetravail.test.ts`. Attendu : les 4 nouveaux tests échouent.

- [ ] **Step 3 : Réécrire `fetchOffers`** (remplace la fonction, lignes 65-87)

```ts
export async function fetchOffers(
  token: string,
  keyword: string,
  profile: JobSearchProfile,
): Promise<RawOffer[]> {
  const now = new Date();
  const minDate = new Date(now.getTime() - profile.maxAgeDays * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    motsCles: keyword,
    typeContrat: profile.contractTypes.join(","),
    natureContrat: "E1",
    minCreationDate: isoSeconds(minDate),
    maxCreationDate: isoSeconds(now),
    range: "0-99",
  });

  // Géographie (conditionnelle selon la portée choisie).
  const loc = profile.location;
  if (loc.code) {
    if (loc.kind === "commune") {
      params.set("commune", loc.code);
      params.set("distance", String(loc.radiusKm));
    } else if (loc.kind === "departement") {
      params.set("departement", loc.code);
    } else {
      params.set("region", loc.code);
    }
  }

  if (profile.debutantAccepte) params.set("experienceExige", "D");
  if (profile.experienceLevel) params.set("experience", profile.experienceLevel);
  if (profile.qualification) params.set("qualification", profile.qualification);
  if (profile.tempsPlein) params.set("tempsPlein", profile.tempsPlein);
  if (profile.romeCodes.length) params.set("codeROME", profile.romeCodes.join(","));
  if (profile.salaireMin != null) {
    params.set("salaireMin", String(profile.salaireMin));
    params.set("periodeSalaire", profile.periodeSalaire);
  }

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status !== 200 && res.status !== 206) return [];
  const data = (await res.json()) as { resultats?: RawOffer[] };
  return data.resultats ?? [];
}
```

- [ ] **Step 4 : Lancer — succès attendu** — `npx vitest run src/lib/jobs/francetravail.test.ts`. Attendu : tous verts (anciens + 4 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/francetravail.ts web/src/lib/jobs/francetravail.test.ts
git commit -m "feat(jobs): fetchOffers construit les paramètres FT (géo, expérience, qualification, salaire, ROME)"
```

### Task 2.2 : Filtre serveur `includeKeywords`

**Files:**
- Create: `web/src/lib/jobs/includeFilter.ts`
- Test: `web/src/lib/jobs/includeFilter.test.ts`

**Interfaces:**
- Produces : `matchesIncludeKeywords(offer: JobOffer, includeKeywords: string[]): boolean` (true si liste vide, sinon exige au moins un mot présent dans title+jobText, comparaison sans accent/casse).

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { matchesIncludeKeywords } from "./includeFilter";
import type { JobOffer } from "./francetravail";

const base: JobOffer = {
  id: "1", title: "Webmaster SEO", company: "ACME", location: "Paris",
  commuteDestination: "", url: "", jobText: "Poste orienté référencement naturel.", publishedAt: "",
};

describe("matchesIncludeKeywords", () => {
  it("accepte tout si la liste est vide", () => {
    expect(matchesIncludeKeywords(base, [])).toBe(true);
  });
  it("accepte si un mot est présent (insensible casse/accents)", () => {
    expect(matchesIncludeKeywords(base, ["référencement"])).toBe(true);
    expect(matchesIncludeKeywords(base, ["REFERENCEMENT"])).toBe(true);
  });
  it("rejette si aucun mot n'est présent", () => {
    expect(matchesIncludeKeywords(base, ["comptabilité"])).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer — échec attendu** — `npx vitest run src/lib/jobs/includeFilter.test.ts`. Attendu : FAIL.

- [ ] **Step 3 : Implémenter**

```ts
import type { JobOffer } from "./francetravail";

/** Minuscule + suppression des accents pour une comparaison robuste. */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * True si l'offre contient au moins un des mots-clés à inclure (titre + description).
 * Liste vide → aucun filtre (true). Comparaison insensible à la casse et aux accents.
 */
export function matchesIncludeKeywords(offer: JobOffer, includeKeywords: string[]): boolean {
  if (includeKeywords.length === 0) return true;
  const hay = normalize(`${offer.title} ${offer.jobText}`);
  return includeKeywords.some((w) => w.trim() !== "" && hay.includes(normalize(w)));
}
```

- [ ] **Step 4 : Lancer — succès attendu** — `npx vitest run src/lib/jobs/includeFilter.test.ts`. Attendu : PASS.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/includeFilter.ts web/src/lib/jobs/includeFilter.test.ts
git commit -m "feat(jobs): filtre serveur includeKeywords (précision titre+description)"
```

---

## Mission M3 — Profil dans le corps des requêtes + persistance Dexie

**Dépend de :** M1.

### Task 3.1 : `resolveProfile` lit et valide le corps de requête

**Files:**
- Modify: `web/src/lib/jobs/resolveProfile.ts`
- Create: `web/src/lib/jobs/resolveProfile.test.ts`

**Interfaces:**
- Consumes : `parseProfile` de `./profileSchema`.
- Produces : `resolveProfile(body?: unknown): JobSearchProfile` — extrait `body.profile`, valide, complète.

- [ ] **Step 1 : Écrire le test** `resolveProfile.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveProfile } from "./resolveProfile";
import { EMPTY_PROFILE } from "./profile";

describe("resolveProfile", () => {
  it("retourne EMPTY_PROFILE sans corps", () => {
    expect(resolveProfile()).toEqual(EMPTY_PROFILE);
  });
  it("extrait et valide body.profile", () => {
    const p = resolveProfile({ profile: { keywords: ["Webmaster"] } });
    expect(p.keywords).toEqual(["Webmaster"]);
    expect(p.minScore).toBe(70);
  });
  it("ignore un body sans profile", () => {
    expect(resolveProfile({ offer: {} })).toEqual(EMPTY_PROFILE);
  });
});
```

- [ ] **Step 2 : Lancer — échec attendu** — `npx vitest run src/lib/jobs/resolveProfile.test.ts`. Attendu : FAIL (signature actuelle).

- [ ] **Step 3 : Réécrire `resolveProfile.ts`**

```ts
import { parseProfile } from "./profileSchema";
import type { JobSearchProfile } from "./profile";

/**
 * Résout le profil de recherche pour une requête.
 *
 * **Point d'extension multi-utilisateur** : aujourd'hui, le profil arrive dans le
 * corps de la requête (mode local, persisté côté navigateur). Demain (SaaS), cette
 * fonction lira d'abord la session du compte ; les modules `lib/jobs/` reçoivent
 * déjà le profil en argument, donc rien d'autre ne changera.
 *
 * @param body corps JSON déjà parsé de la requête (`{ profile?, ... }`).
 */
export function resolveProfile(body?: unknown): JobSearchProfile {
  const profile = (body && typeof body === "object") ? (body as { profile?: unknown }).profile : undefined;
  return parseProfile(profile);
}
```

- [ ] **Step 4 : Lancer — succès attendu** — `npx vitest run src/lib/jobs/resolveProfile.test.ts`. Attendu : PASS.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/resolveProfile.ts web/src/lib/jobs/resolveProfile.test.ts
git commit -m "refactor(jobs): resolveProfile lit le profil depuis le corps de requête"
```

### Task 3.2 : Router `search` et `score` sur le profil du corps

**Files:**
- Modify: `web/src/app/api/jobs/search/route.ts`
- Modify: `web/src/app/api/jobs/score/route.ts`
- Modify: `web/src/app/api/jobs/search/route.test.ts`

**Interfaces:**
- Consumes : `resolveProfile(body)`, `matchesIncludeKeywords`.

- [ ] **Step 1 : Modifier `search/route.ts`** — parser le corps, résoudre le profil, appliquer le filtre `includeKeywords`.

Remplacer le corps de `POST` (à partir de la ligne `const profile = resolveProfile(req);`) :

```ts
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // corps vide/invalide toléré → profil neutre
  }
  const profile = resolveProfile(body);

  try {
    const token = await getToken(clientId, clientSecret);
    const seen = new Set<string>();
    const offers: JobOffer[] = [];

    for (const keyword of profile.keywords) {
      const raw = await fetchOffers(token, keyword, profile);
      for (const offer of raw) {
        const id = offer.id ?? "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (isExcluded(offer, profile.excludedWords)) continue;
        const mapped = mapOffer(offer, profile.maxDescriptionChars);
        if (!matchesIncludeKeywords(mapped, profile.includeKeywords)) continue;
        offers.push(mapped);
      }
    }
    return NextResponse.json({ offers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de la recherche d'offres.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
```

Ajouter l'import en tête du fichier :
```ts
import { matchesIncludeKeywords } from "@/lib/jobs/includeFilter";
```

- [ ] **Step 2 : Modifier `score/route.ts`** — passer le corps déjà parsé à `resolveProfile`.

Le fichier parse déjà `body` (ligne 22). Remplacer la ligne 40 `const profile = resolveProfile(req);` par :
```ts
  const profile = resolveProfile(body);
```
Et élargir le type de `body` (ligne 20) :
```ts
  let body: { offer?: JobOffer; profile?: unknown };
```

- [ ] **Step 3 : Mettre à jour `search/route.test.ts`** — les tests existants envoient `{}` (profil vide → `keywords: []` → aucune requête FT → `offers: []`). Adapter le test « agrège… » pour fournir un profil avec un mot-clé :

Remplacer la fonction `req` et le test d'agrégation :
```ts
function req(body: unknown = { profile: { keywords: ["SEO"] } }) {
  return new Request("http://x/api/jobs/search", { method: "POST", body: JSON.stringify(body) });
}
```
Le test « 400 config » appelle `POST(req())` avant la lecture du profil (la garde clés FT est en tête) → inchangé. Le test « agrège » passe désormais un profil à 1 mot-clé → 1 boucle FT → assertions inchangées. Ajouter un test :
```ts
it("ne lance aucune requête FT si keywords est vide", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const res = await POST(req({ profile: { keywords: [] } }));
  expect(res.status).toBe(200);
  expect((await res.json()).offers).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 4 : Vérifier** — `npm test`. Attendu : tous verts. Puis `npx tsc --noEmit`. Attendu : zéro erreur.

- [ ] **Step 5 : Commit**

```bash
git add web/src/app/api/jobs/search/route.ts web/src/app/api/jobs/score/route.ts web/src/app/api/jobs/search/route.test.ts
git commit -m "feat(jobs): routes search/score utilisent le profil du corps + filtre includeKeywords"
```

### Task 3.3 : Persistance Dexie du profil (table `jobProfile`)

**Files:**
- Modify: `web/src/lib/storage/db.ts`

**Interfaces:**
- Produces : `getJobProfile(): Promise<JobSearchProfile | null>`, `saveJobProfile(p: JobSearchProfile): Promise<void>`. Table `jobProfile` (singleton `id="me"`).

- [ ] **Step 1 : Déclarer la table** — dans `db.ts`, ajouter après la ligne 74 (déclarations de tables) :

```ts
  jobProfile!: Table<{ id: string; profile: JobSearchProfile }, string>; // singleton "me"
```
Importer le type en tête :
```ts
import type { JobSearchProfile } from "@/lib/jobs/profile";
```

- [ ] **Step 2 : Ajouter la version de schéma** — après le bloc `this.version(6)` (ligne 123), ajouter :

```ts
    // v7 : profil de recherche d'offres paramétrable (singleton id="me").
    this.version(7).stores({
      jobProfile: "id",
    });
```

- [ ] **Step 3 : Ajouter les helpers** — après la section JOBS API (avant TEMPLATES API, vers la ligne 324) :

```ts
// ---------------------------------------------------------------------------
// JOB PROFILE API (critères de recherche paramétrables)
// ---------------------------------------------------------------------------

export async function getJobProfile(): Promise<JobSearchProfile | null> {
  try {
    return (await db.jobProfile.get("me"))?.profile ?? null;
  } catch (e) {
    console.warn("getJobProfile error:", e);
    return null;
  }
}

export async function saveJobProfile(profile: JobSearchProfile): Promise<void> {
  try {
    await db.jobProfile.put({ id: "me", profile });
  } catch (e) {
    console.warn("saveJobProfile error:", e);
  }
}
```

- [ ] **Step 4 : Vérifier** — `npx tsc --noEmit`. Attendu : zéro erreur. `npm run lint`. Attendu : propre.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/storage/db.ts
git commit -m "feat(jobs): persistance Dexie du profil de recherche (table jobProfile v7)"
```

---

## Mission M4 — Autocomplétion du lieu

**Dépend de :** aucune (parallélisable avec M2/M3).

### Task 4.1 : Route proxy `GET /api/jobs/locations`

**Files:**
- Create: `web/src/app/api/jobs/locations/route.ts`
- Create: `web/src/app/api/jobs/locations/route.test.ts`

**Interfaces:**
- Produces : `GET` → `{ results: { kind: LocationKind; code: string; label: string }[] }`. Proxy de `geo.api.gouv.fr` (communes + régions).

- [ ] **Step 1 : Écrire le test** `locations/route.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

function req(q: string) {
  return new Request(`http://x/api/jobs/locations?q=${encodeURIComponent(q)}`);
}

describe("GET /api/jobs/locations", () => {
  it("retourne [] si q trop court", async () => {
    const res = await GET(req("a"));
    expect((await res.json()).results).toEqual([]);
  });

  it("fusionne communes (avec code postal) et régions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/communes")) {
        return { ok: true, json: async () => ([{ nom: "Paris", code: "75056", codesPostaux: ["75001", "75012"] }]) };
      }
      return { ok: true, json: async () => ([{ nom: "Île-de-France", code: "11" }]) };
    }));
    const res = await GET(req("par"));
    const { results } = await res.json();
    expect(results).toContainEqual({ kind: "commune", code: "75056", label: "Paris (75001)" });
    expect(results).toContainEqual({ kind: "region", code: "11", label: "Île-de-France" });
  });

  it("tolère une panne de geo.api.gouv.fr (retourne [])", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500, json: async () => ([]) }));
    const res = await GET(req("paris"));
    expect((await res.json()).results).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer — échec attendu** — `npx vitest run src/app/api/jobs/locations/route.test.ts`. Attendu : FAIL (`GET` introuvable).

- [ ] **Step 3 : Implémenter `route.ts`**

```ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Result = { kind: "commune" | "departement" | "region"; code: string; label: string };

interface GeoCommune { nom: string; code: string; codesPostaux?: string[] }
interface GeoRegion { nom: string; code: string }

const COMMUNES_URL = "https://geo.api.gouv.fr/communes";
const REGIONS_URL = "https://geo.api.gouv.fr/regions";

async function fetchJson<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

/**
 * Autocomplétion de lieu (proxy geo.api.gouv.fr, sans auth). Renvoie des codes INSEE
 * compatibles France Travail : communes (avec code postal) + régions.
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [communes, regions] = await Promise.all([
    fetchJson<GeoCommune>(`${COMMUNES_URL}?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux&boost=population&limit=8`),
    fetchJson<GeoRegion>(`${REGIONS_URL}?nom=${encodeURIComponent(q)}`),
  ]);

  const results: Result[] = [
    ...communes.map((c) => ({
      kind: "commune" as const,
      code: c.code,
      label: c.codesPostaux?.[0] ? `${c.nom} (${c.codesPostaux[0]})` : c.nom,
    })),
    ...regions.map((r) => ({ kind: "region" as const, code: r.code, label: r.nom })),
  ];

  return NextResponse.json({ results });
}
```

- [ ] **Step 4 : Lancer — succès attendu** — `npx vitest run src/app/api/jobs/locations/route.test.ts`. Attendu : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/src/app/api/jobs/locations/
git commit -m "feat(jobs): route proxy /api/jobs/locations (autocomplétion via geo.api.gouv.fr)"
```

### Task 4.2 : Composant `LocationInput`

**Files:**
- Create: `web/src/components/jobs/LocationInput.tsx`

**Interfaces:**
- Consumes : `LocationFilter` de `@/lib/jobs/profile`.
- Produces : `LocationInput({ value, onChange }: { value: LocationFilter; onChange: (l: LocationFilter) => void })`. Champ texte + suggestions (debounce) ; champ rayon visible si `kind === "commune"`.

- [ ] **Step 1 : Implémenter le composant** (pas de test unitaire — couvert par e2e/manuel ; c'est un composant d'UI I/O)

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationFilter, LocationKind } from "@/lib/jobs/profile";

type Suggestion = { kind: LocationKind; code: string; label: string };

export default function LocationInput({
  value,
  onChange,
}: {
  value: LocationFilter;
  onChange: (l: LocationFilter) => void;
}) {
  const [query, setQuery] = useState(value.label);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(value.label), [value.label]);

  function onType(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/locations?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  function pick(s: Suggestion) {
    onChange({ kind: s.kind, code: s.code, label: s.label, radiusKm: value.radiusKm || 10 });
    setQuery(s.label);
    setOpen(false);
  }

  return (
    <div className="location-input">
      <input
        type="text"
        className="field-input"
        placeholder="Ville, commune ou région…"
        value={query}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        aria-label="Lieu de recherche"
      />
      {open && suggestions.length > 0 && (
        <ul className="location-suggestions" role="listbox">
          {suggestions.map((s) => (
            <li key={`${s.kind}-${s.code}`}>
              <button type="button" onClick={() => pick(s)}>
                {s.label}
                <span className="location-kind">{s.kind === "commune" ? "Commune" : "Région"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.kind === "commune" && value.code && (
        <label className="location-radius">
          Rayon
          <input
            type="number"
            min={0}
            max={200}
            value={value.radiusKm}
            onChange={(e) => onChange({ ...value, radiusKm: Number(e.target.value) || 0 })}
          />
          km
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Ajouter les styles** — dans le fichier CSS global des composants jobs (repérer avec `grep -rn "jobs-view" web/src/**/*.css`). Ajouter, avec **variables CSS existantes uniquement** :

```css
.location-input { position: relative; }
.location-suggestions {
  position: absolute; z-index: 20; left: 0; right: 0; margin-top: 4px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius, 8px); box-shadow: var(--shadow-md); list-style: none; padding: 4px;
}
.location-suggestions button {
  display: flex; justify-content: space-between; width: 100%; gap: 8px;
  padding: 6px 8px; background: none; border: none; text-align: left; cursor: pointer; color: var(--text);
}
.location-suggestions button:hover { background: var(--surface-hover, var(--border)); }
.location-kind { color: var(--text-muted); font-size: 0.8em; }
.location-radius { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--text-muted); }
```
> Adapter les noms de variables à ceux réellement définis dans `globals.css` (vérifier `--surface`, `--border`, `--text`, `--text-muted`, `--shadow-md`). **Ne pas inventer de couleur.**

- [ ] **Step 3 : Vérifier** — `npx tsc --noEmit`. Attendu : zéro erreur.

- [ ] **Step 4 : Commit**

```bash
git add web/src/components/jobs/LocationInput.tsx web/src/**/*.css
git commit -m "feat(jobs): composant LocationInput (autocomplétion lieu + rayon)"
```

---

## Mission M5 — Formulaire `ProfileForm` + intégration

**Dépend de :** M2, M3, M4.

### Task 5.1 : Composant `ProfileForm`

**Files:**
- Create: `web/src/components/jobs/ProfileForm.tsx`

**Interfaces:**
- Consumes : `JobSearchProfile`, `EMPTY_PROFILE`, `LocationInput`, `getJobProfile`/`saveJobProfile`.
- Produces : `ProfileForm({ profile, onChange }: { profile: JobSearchProfile; onChange: (p: JobSearchProfile) => void })` — formulaire contrôlé ; le parent gère persistance + scan.

- [ ] **Step 1 : Implémenter le composant** (formulaire contrôlé ; réutiliser les classes chips/segmented/toggle existantes de l'atelier — repérer via `grep -rn "segmented\|chip\|toggle" web/src/components web/src/app/globals.css`)

```tsx
"use client";

import type { JobSearchProfile } from "@/lib/jobs/profile";
import LocationInput from "./LocationInput";
import { useState } from "react";

const CONTRACT_OPTIONS = ["CDI", "CDD", "MIS", "SAI"];

/** Petit éditeur de liste de tags (mots-clés, mots exclus, compétences, codes ROME). */
function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft("");
  }
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="tag-list">
        {values.map((v) => (
          <span key={v} className="tag">
            {v}
            <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
      </div>
      <input
        type="text" className="field-input" placeholder={placeholder} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

export default function ProfileForm({ profile, onChange }: {
  profile: JobSearchProfile; onChange: (p: JobSearchProfile) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof JobSearchProfile>(k: K, v: JobSearchProfile[K]) => onChange({ ...profile, [k]: v });

  function toggleContract(c: string) {
    const has = profile.contractTypes.includes(c);
    set("contractTypes", has ? profile.contractTypes.filter((x) => x !== c) : [...profile.contractTypes, c]);
  }

  return (
    <section className="profile-form" aria-label="Mes critères de recherche">
      <h2 className="profile-form-title">Mes critères de recherche</h2>

      {/* Ligne primaire */}
      <TagInput label="Poste(s) recherché(s)" values={profile.keywords}
        onChange={(v) => set("keywords", v)} placeholder="Ex. Webmaster, Chargé SEO… (Entrée)" />

      <div className="field">
        <label className="field-label">Lieu</label>
        <LocationInput value={profile.location} onChange={(l) => set("location", l)} />
      </div>

      {/* Filtres rapides */}
      <div className="field">
        <label className="field-label">Type de contrat</label>
        <div className="chip-row">
          {CONTRACT_OPTIONS.map((c) => (
            <button key={c} type="button"
              className={`chip ${profile.contractTypes.includes(c) ? "chip--on" : ""}`}
              onClick={() => toggleContract(c)}>{c}</button>
          ))}
        </div>
      </div>

      <label className="toggle-row">
        <input type="checkbox" checked={profile.debutantAccepte}
          onChange={(e) => set("debutantAccepte", e.target.checked)} />
        Débutant accepté
      </label>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">Expérience</span>
          <select className="field-input" value={profile.experienceLevel}
            onChange={(e) => set("experienceLevel", e.target.value as JobSearchProfile["experienceLevel"])}>
            <option value="">Indifférent</option>
            <option value="1">Moins d'un an</option>
            <option value="2">1 à 3 ans</option>
            <option value="3">Plus de 3 ans</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Temps de travail</span>
          <select className="field-input" value={profile.tempsPlein}
            onChange={(e) => set("tempsPlein", e.target.value as JobSearchProfile["tempsPlein"])}>
            <option value="">Indifférent</option>
            <option value="true">Temps plein</option>
            <option value="false">Temps partiel</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Qualification</span>
          <select className="field-input" value={profile.qualification}
            onChange={(e) => set("qualification", e.target.value as JobSearchProfile["qualification"])}>
            <option value="">Indifférent</option>
            <option value="0">Non-cadre</option>
            <option value="9">Cadre</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Ancienneté max</span>
          <select className="field-input" value={profile.maxAgeDays}
            onChange={(e) => set("maxAgeDays", Number(e.target.value))}>
            <option value={1}>1 jour</option>
            <option value={3}>3 jours</option>
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={31}>31 jours</option>
          </select>
        </label>
      </div>

      {/* Avancé */}
      <button type="button" className="profile-form-advanced-toggle" onClick={() => setAdvanced((a) => !a)}>
        {advanced ? "▾ Masquer les critères avancés" : "▸ Critères avancés"}
      </button>

      {advanced && (
        <div className="profile-form-advanced">
          <TagInput label="Mots-clés à inclure dans l'offre" values={profile.includeKeywords}
            onChange={(v) => set("includeKeywords", v)} placeholder="Le mot doit apparaître (Entrée)" />
          <TagInput label="Mots à exclure" values={profile.excludedWords}
            onChange={(v) => set("excludedWords", v)} placeholder="Ex. stagiaire (Entrée)" />
          <TagInput label="Compétences (pré-tri gratuit)" values={profile.prefilterKeywords}
            onChange={(v) => set("prefilterKeywords", v)} placeholder="Ex. wordpress, seo (Entrée)" />
          <TagInput label="Codes ROME (optionnel)" values={profile.romeCodes}
            onChange={(v) => set("romeCodes", v)} placeholder="Ex. E1104 (Entrée)" />

          <div className="field-grid">
            <label className="field">
              <span className="field-label">Salaire min</span>
              <input type="number" className="field-input" min={0} value={profile.salaireMin ?? ""}
                onChange={(e) => set("salaireMin", e.target.value === "" ? null : Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">Période</span>
              <select className="field-input" value={profile.periodeSalaire}
                onChange={(e) => set("periodeSalaire", e.target.value as JobSearchProfile["periodeSalaire"])}>
                <option value="M">Mensuel</option>
                <option value="A">Annuel</option>
                <option value="H">Horaire</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Score minimum</span>
              <input type="number" className="field-input" min={0} max={100} value={profile.minScore}
                onChange={(e) => set("minScore", Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">Offres notées / scan</span>
              <input type="number" className="field-input" min={1} max={100} value={profile.aiShortlist}
                onChange={(e) => set("aiShortlist", Number(e.target.value))} />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Adresse de départ (trajet)</span>
            <input type="text" className="field-input" value={profile.homeAddress}
              onChange={(e) => set("homeAddress", e.target.value)} placeholder="Ex. 10 rue de Paris, 75012" />
          </label>

          <label className="field">
            <span className="field-label">Résumé candidat (scoring IA)</span>
            <textarea className="field-input" rows={5} value={profile.candidateSummary}
              onChange={(e) => set("candidateSummary", e.target.value)} />
          </label>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2 : Ajouter les styles** (variables CSS existantes ; réutiliser `.chip`, `.toggle-row` etc. s'ils existent déjà — sinon définir a minima). Vérifier d'abord `grep -rn "\.chip\|\.tag\b\|\.field-input" web/src/app/globals.css`.

```css
.profile-form { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius, 12px); padding: 16px; margin-bottom: 16px; }
.profile-form-title { font-size: 1rem; font-weight: 600; margin: 0 0 12px; color: var(--text); }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.field-label { font-size: 0.85rem; color: var(--text-muted); }
.field-input { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); }
.field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 4px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text); cursor: pointer; }
.chip--on { background: var(--accent, var(--text)); color: var(--surface); border-color: transparent; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--surface-hover, var(--border)); border-radius: 999px; font-size: 0.85rem; }
.tag button { background: none; border: none; cursor: pointer; color: var(--text-muted); }
.toggle-row { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text); }
.profile-form-advanced-toggle { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 0; }
```
> **Adapter tous les noms de variables** à ceux de `globals.css`. Ne pas inventer de couleur.

- [ ] **Step 3 : Vérifier** — `npx tsc --noEmit`. Attendu : zéro erreur.

- [ ] **Step 4 : Commit**

```bash
git add web/src/components/jobs/ProfileForm.tsx web/src/**/*.css
git commit -m "feat(jobs): formulaire ProfileForm (critères FT + section avancée)"
```

### Task 5.2 : Brancher le profil dans `JobsView` (chargement, sauvegarde auto, envoi au scan)

**Files:**
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/app/jobs/page.tsx`

**Interfaces:**
- Consumes : `ProfileForm`, `getJobProfile`, `saveJobProfile`, `EMPTY_PROFILE`.

- [ ] **Step 1 : Simplifier `page.tsx`** — ne plus résoudre le profil serveur ; `JobsView` gère tout côté client. Remplacer le fichier :

```tsx
import JobsView from "@/components/jobs/JobsView";
import SegmentedNav from "@/components/layout/SegmentedNav";

export const metadata = {
  title: "Offres — CVMatchr",
};

export default function JobsPage() {
  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Offres</h1>
        <div className="topbar-center">
          <SegmentedNav />
        </div>
        <div className="topbar-actions" />
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <JobsView />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Modifier `JobsView.tsx`** — charger le profil Dexie, afficher `ProfileForm`, sauvegarder en auto (debounce), envoyer le profil aux deux appels API, garder le bouton désactivé tant que `keywords ≥ 1` + `location.code` manquent.

Changements clés (supprimer la prop `config`, dériver la config du profil courant) :

En tête, ajouter les imports :
```ts
import { getJobProfile, saveJobProfile } from "@/lib/storage/db";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import ProfileForm from "./ProfileForm";
```

Remplacer la signature et l'état :
```ts
export default function JobsView() {
  const [profile, setProfile] = useState<JobSearchProfile>(EMPTY_PROFILE);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanState>(ZERO);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const setPendingJobDesc = useDocStore((s) => s.setPendingJobDesc);
  const setCompany = useDocStore((s) => s.setCompany);
  const setRole = useDocStore((s) => s.setRole);
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listJobs("new").then(setJobs);
    getJobProfile().then((p) => { if (p) setProfile(p); });
  }, []);

  // Sauvegarde auto (debounce 400 ms) à chaque modif du profil.
  function updateProfile(p: JobSearchProfile) {
    setProfile(p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveJobProfile(p); }, 400);
  }

  const canScan = profile.keywords.length >= 1 && profile.location.code !== "";
```
(ajouter `useRef` à l'import `react`).

Dans `scan()`, remplacer le corps de la requête search et la dérivation de config :
```ts
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
```
et remplacer `config.minScore` / `config.aiShortlist` / `config.prefilterKeywords` par `profile.minScore` / `profile.aiShortlist` / `profile.prefilterKeywords`. Dans l'appel `/api/jobs/score`, envoyer aussi le profil :
```ts
          body: JSON.stringify({ offer, profile }),
```

Remplacer le rendu (bloc `return (...)` principal) :
```tsx
  return (
    <div className="jobs-view">
      <ProfileForm profile={profile} onChange={updateProfile} />
      <ScoringInfo criteria={profile.scoringCriteria.map(({ label, max, description }) => ({ label, max, description }))} minScore={profile.minScore} />
      <div className="jobs-toolbar">
        <button
          type="button"
          className="tailor-btn"
          onClick={scan}
          disabled={scanning || !canScan}
          data-testid="jobs-scan"
        >
          {scanning ? "Recherche en cours…" : "Chercher des offres"}
        </button>
        {!canScan && !scanning && (
          <span className="jobs-hint">Renseigne au moins un poste et un lieu pour lancer une recherche.</span>
        )}
        {scanning ? <ScanProgress {...progress} /> : null}
      </div>

      {jobs.length === 0 ? (
        <div className="jobs-empty">
          {scanning ? "Recherche en cours…" : "Aucune offre pour l'instant. Renseigne tes critères puis lance une recherche."}
        </div>
      ) : (
        <div className="jobs-list" data-testid="jobs-list">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onAdapt={adapt} onApply={apply} onDismiss={dismiss} onSeen={seen} />
          ))}
        </div>
      )}
    </div>
  );
```
Supprimer le type `JobsConfig` et la prop `config` (et son usage). Conserver `configMsg` (clés FT manquantes).

- [ ] **Step 3 : Vérifier la compilation** — `npx tsc --noEmit`. Attendu : zéro erreur. Corriger tout import résiduel de `JobsConfig` (ex. dans `page.tsx` déjà nettoyé).

- [ ] **Step 4 : Vérifier lint + tests** — `npm run lint` puis `npm test`. Attendu : verts.

- [ ] **Step 5 : Commit**

```bash
git add web/src/components/jobs/JobsView.tsx web/src/app/jobs/page.tsx
git commit -m "feat(jobs): JobsView pilote le profil (chargement, sauvegarde auto, envoi au scan)"
```

### Task 5.3 : Vérification manuelle end-to-end

- [ ] **Step 1 : Lancer l'app** — `npm run dev` (ou `Lancer CV Builder (Next.js).bat`).
- [ ] **Step 2 : Profil vide** — page Offres : le bouton « Chercher » est désactivé, message d'invite affiché.
- [ ] **Step 3 : Saisir des critères** — ajouter un poste (tag), taper « Paris » dans Lieu → sélectionner une suggestion → rayon apparaît. Le bouton s'active.
- [ ] **Step 4 : Débutant accepté** — cocher ; ouvrir les DevTools réseau, lancer un scan, vérifier que la requête `/api/jobs/search` part et (si `FT_*` configurés) que des offres reviennent.
- [ ] **Step 5 : Persistance** — recharger la page : les critères sont conservés (Dexie).
- [ ] **Step 6 : Grep final** — `grep -ri "hariss\|jean bouton" web/src`. Attendu : **zéro résultat**.
- [ ] **Step 7 : Suite complète** — `npm test && npx tsc --noEmit && npm run lint && npm run build`. Attendu : tout vert.

---

## Récapitulatif des missions

| Mission | Contenu | Dépend de |
|---|---|---|
| M1 | Modèle enrichi + Zod + fixture Hariss + migration tests | — |
| M2 | `fetchOffers` étendu (params FT) + filtre `includeKeywords` | M1 |
| M3 | Profil dans le corps + routes + persistance Dexie | M1 |
| M4 | Route `locations` + composant `LocationInput` | — |
| M5 | `ProfileForm` + intégration `JobsView`/`page` + vérif e2e | M2, M3, M4 |

## Critères de succès globaux

1. `grep -ri "hariss\|jean bouton" web/src` → vide.
2. Saisir poste(s) + lieu (autocomplété) + filtres → scan sans toucher au code.
3. Les paramètres FT envoyés correspondent aux champs (test `fetchOffers`).
4. Débutant accepté coché → `experienceExige=D` ; décoché → absent.
5. Recharger → critères conservés (Dexie).
6. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` verts.

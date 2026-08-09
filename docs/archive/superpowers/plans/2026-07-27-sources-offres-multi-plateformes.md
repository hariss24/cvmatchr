# Sources d'offres multi-plateformes — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Élargir la recherche d'offres à Adzuna et JSearch (Google for Jobs) en plus de France Travail, avec choix des sources par l'utilisateur et une carte d'offre allégée.

**Architecture:** Chaque source devient un module de `lib/jobs/` exposant `search(profile, creds) → { offers, calls }` et renvoyant des `JobOffer` normalisées. La route `/api/jobs/search` appelle en parallèle les seules sources activées, fusionne, dédoublonne, puis rend la main au pipeline existant (pré-tri → notation IA → seuil → Dexie), qui n'est pas modifié.

**Tech Stack:** Next.js (voir `web/AGENTS.md`), React 19, TypeScript, Zod, Dexie 4, Vitest.

**Spec :** `docs/archive/superpowers/specs/2026-07-27-sources-offres-multi-plateformes-design.md`
**Maquette :** `docs/design/jobs/page-light.html`, `page-dark.html`, `states.html`

## Global Constraints

- Toutes les commandes s'exécutent depuis `web/` : `npm test`, `npm run lint`, `npm run build`.
- **`npm run build` est obligatoire** avant de déclarer une tâche finie : Vitest ne fait pas de typecheck.
- Ce Next.js n'est pas celui des données d'entraînement — lire `node_modules/next/dist/docs/` avant d'écrire du code de framework (cf. `web/AGENTS.md`).
- Jamais `alert`/`confirm`/`prompt` natifs : utiliser `uiAlert`/`uiConfirm`/`uiPrompt` de `src/state/uiStore.ts`.
- Commentaires et libellés d'interface en français.
- Clés déjà présentes dans `web/.env.local` : `FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JSEARCH_API_KEY`.
- Le plafond `aiShortlist` s'applique au pool **fusionné** : trois sources ne doivent jamais tripler le nombre d'appels IA.
- Aucun logo de plateforme n'est stocké dans le dépôt.

---

### Task 1: Type `JobOffer` partagé, sorti de `francetravail.ts`

`JobOffer` est aujourd'hui déclaré dans le module France Travail alors que trois providers vont le produire. On l'extrait dans son propre module avant d'ajouter quoi que ce soit — sinon `adzuna.ts` et `jsearch.ts` importeraient leur type depuis un provider concurrent.

**Files:**
- Create: `web/src/lib/jobs/offer.ts`
- Create: `web/src/lib/jobs/offer.test.ts`
- Modify: `web/src/lib/jobs/francetravail.ts` (retirer l'interface `JobOffer`, la réexporter)
- Modify: `web/src/lib/jobs/includeFilter.ts:1` (importer depuis `./offer`)

**Interfaces:**
- Produces: `SourceId`, `JobOffer`, `yearlySalaryLabel(min, max)`

- [ ] **Step 1: Écrire le test de `yearlySalaryLabel`**

Créer `web/src/lib/jobs/offer.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { yearlySalaryLabel } from "./offer";

describe("yearlySalaryLabel", () => {
  it("formate une fourchette en k€ annuels", () => {
    expect(yearlySalaryLabel(33000, 36000)).toBe("33–36 k€ / an");
  });

  it("formate un montant unique", () => {
    expect(yearlySalaryLabel(41130, null)).toBe("41,1 k€ / an");
  });

  it("garde une décimale seulement si utile", () => {
    expect(yearlySalaryLabel(40000, null)).toBe("40 k€ / an");
  });

  it("renvoie « » quand rien n'est connu", () => {
    expect(yearlySalaryLabel(null, null)).toBe("");
    expect(yearlySalaryLabel(undefined, undefined)).toBe("");
  });

  it("ignore une fourchette dégénérée (min === max)", () => {
    expect(yearlySalaryLabel(45000, 45000)).toBe("45 k€ / an");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/offer.test.ts`
Expected: FAIL — `Failed to resolve import "./offer"`.

- [ ] **Step 3: Créer `offer.ts`**

Créer `web/src/lib/jobs/offer.ts` :

```ts
/**
 * Contrat commun aux trois sources d'offres. Chaque provider (`francetravail.ts`,
 * `adzuna.ts`, `jsearch.ts`) traduit sa réponse vers ce type ; tout le pipeline
 * aval (pré-tri, notation IA, stockage, affichage) ne connaît que celui-ci.
 */

/** Source technique ayant fait remonter l'offre (≠ jobboard où elle est publiée). */
export type SourceId = "francetravail" | "adzuna" | "jsearch";

/** Offre normalisée pour l'affichage et le scoring (contrat unique client ⇄ serveur). */
export interface JobOffer {
  id: string;
  source: SourceId;
  title: string;
  company: string;
  location: string;            // libellé lisible (affichage)
  commuteDestination: string;  // "lat,lng" si dispo, sinon libellé ; "" si absent
  url: string;
  jobText: string;
  publishedAt: string;         // ISO ; "" si absente
  /** Logo de l'entreprise fourni par la source ; "" si aucune (≈ 1 offre sur 3). */
  logoUrl: string;
  /** Hôte complet du lien de l'offre, ex. "jobs.lilylifestyle.co.uk" ; "" si inconnu. */
  boardDomain: string;
  /** Nom lisible du jobboard, ex. "LinkedIn". Sert d'infobulle et de repli. */
  boardName: string;
  /** "CDI · Plein temps", "CDD · 8 mois"… ; "" si inconnu. */
  contractLabel: string;
  /** "33–36 k€ / an" ; "" si non précisé. */
  salaryLabel: string;
}

/**
 * Montants annuels en euros → libellé court. Adzuna et JSearch renvoient des
 * nombres ; France Travail renvoie déjà une phrase et n'utilise pas ce helper.
 */
export function yearlySalaryLabel(min?: number | null, max?: number | null): string {
  const k = (n: number) => {
    const v = n / 1000;
    // Une décimale seulement si elle apporte quelque chose (41,1 mais 40).
    return (Math.round(v * 10) / 10).toLocaleString("fr-FR");
  };
  if (min && max && max !== min) return `${k(min)}–${k(max)} k€ / an`;
  const one = min || max;
  return one ? `${k(one)} k€ / an` : "";
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/lib/jobs/offer.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Retirer `JobOffer` de `francetravail.ts` et le réexporter**

Dans `web/src/lib/jobs/francetravail.ts`, supprimer le bloc `export interface JobOffer { … }` (lignes 21-31) et ajouter en haut du fichier, sous l'import de `JobSearchProfile` :

```ts
import type { JobOffer } from "./offer";

// Réexport de compatibilité : plusieurs modules importent encore `JobOffer`
// depuis ce fichier. Les nouveaux modules importent depuis `./offer`.
export type { JobOffer } from "./offer";
```

`mapOffer` ne compile plus (champs manquants) — c'est attendu, la Task 4 le corrige. Pour garder l'arbre vert d'ici là, compléter provisoirement le retour de `mapOffer` :

```ts
export function mapOffer(offer: RawOffer, maxDescriptionChars: number): JobOffer {
  return {
    id: offer.id ?? "",
    source: "francetravail",
    title: offer.intitule ?? "",
    company: offer.entreprise?.nom ?? "",
    location: offer.lieuTravail?.libelle ?? "",
    commuteDestination: commuteDestination(offer),
    url: offer.origineOffre?.urlOrigine ?? "",
    jobText: (offer.description ?? "").slice(0, maxDescriptionChars),
    publishedAt: offer.dateCreation ?? "",
    logoUrl: "",
    boardDomain: "",
    boardName: "France Travail",
    contractLabel: "",
    salaryLabel: "",
  };
}
```

- [ ] **Step 6: Pointer `includeFilter.ts` sur le nouveau module**

Dans `web/src/lib/jobs/includeFilter.ts`, remplacer la ligne 1 :

```ts
import type { JobOffer } from "./offer";
```

- [ ] **Step 7: Adapter le test existant de `mapOffer`**

Dans `web/src/lib/jobs/francetravail.test.ts`, le test « tolère les champs manquants » utilise `toEqual` sur l'objet complet. Remplacer son corps :

```ts
  it("tolère les champs manquants", () => {
    expect(mapOffer({}, 3000)).toMatchObject({
      id: "", title: "", company: "", location: "",
      commuteDestination: "", url: "", jobText: "", publishedAt: "",
      source: "francetravail", logoUrl: "",
    });
  });
```

- [ ] **Step 8: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tous les tests passent, 0 erreur ESLint, build « Compiled successfully ».

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/jobs/offer.ts web/src/lib/jobs/offer.test.ts web/src/lib/jobs/francetravail.ts web/src/lib/jobs/francetravail.test.ts web/src/lib/jobs/includeFilter.ts
git commit -m "refactor(jobs): sortir JobOffer de francetravail.ts vers offer.ts

Trois providers vont produire ce type : le garder dans le module d'une
source obligerait les deux autres à importer depuis un concurrent.
Ajoute les champs source/logoUrl/boardDomain/boardName/contractLabel/
salaryLabel, remplis par les tâches suivantes."
```

---

### Task 2: Cascade de domaines pour le favicon du jobboard

Le service de favicons échoue sur certains sous-domaines. Vérifié en direct : `candidat.francetravail.fr` (l'URL que donne France Travail) et `jobs.lilylifestyle.co.uk` (vu dans une réponse JSearch réelle) renvoient tous deux 404. Une réduction fixe aux deux derniers labels casse le second cas (`co.uk`, suffixe public). D'où une cascade.

**Files:**
- Create: `web/src/lib/jobs/board.ts`
- Create: `web/src/lib/jobs/board.test.ts`

**Interfaces:**
- Produces: `hostnameOf(url): string`, `domainCandidates(host): string[]`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/lib/jobs/board.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { hostnameOf, domainCandidates } from "./board";

describe("hostnameOf", () => {
  it("extrait l'hôte d'une URL", () => {
    expect(hostnameOf("https://fr.linkedin.com/jobs/view/123")).toBe("fr.linkedin.com");
  });

  it("renvoie « » sur une URL invalide ou vide", () => {
    expect(hostnameOf("pas une url")).toBe("");
    expect(hostnameOf("")).toBe("");
  });
});

describe("domainCandidates", () => {
  it("descend d'un label à chaque échec", () => {
    expect(domainCandidates("candidat.francetravail.fr"))
      .toEqual(["candidat.francetravail.fr", "francetravail.fr"]);
  });

  it("gère un suffixe composé sans Public Suffix List", () => {
    // Cas réel vu dans une réponse JSearch. Une règle « 2 derniers labels »
    // donnerait "co.uk", un suffixe public sans favicon.
    expect(domainCandidates("jobs.lilylifestyle.co.uk"))
      .toEqual(["jobs.lilylifestyle.co.uk", "lilylifestyle.co.uk", "co.uk"]);
  });

  it("ne descend jamais sous deux labels", () => {
    expect(domainCandidates("adzuna.fr")).toEqual(["adzuna.fr"]);
  });

  it("renvoie [] sur une entrée vide ou sans point", () => {
    expect(domainCandidates("")).toEqual([]);
    expect(domainCandidates("localhost")).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/board.test.ts`
Expected: FAIL — `Failed to resolve import "./board"`.

- [ ] **Step 3: Écrire `board.ts`**

Créer `web/src/lib/jobs/board.ts` :

```ts
/**
 * Domaine du jobboard où une offre est réellement publiée, pour aller chercher
 * son favicon (cf. spec §5.3.1).
 *
 * Le service de favicons échoue sur certains sous-domaines : vérifié en direct,
 * `candidat.francetravail.fr` et `jobs.lilylifestyle.co.uk` renvoient 404 (avec
 * un globe générique, identique à celui d'un domaine inexistant). On produit donc
 * une liste de candidats, du plus précis au plus général, que l'affichage essaie
 * dans l'ordre.
 *
 * Une réduction fixe aux deux derniers labels avait été envisagée : elle casse
 * sur les suffixes composés (`jobs.lilylifestyle.co.uk` → `co.uk`, sans favicon).
 * La cascade n'a pas ce défaut et évite d'embarquer une Public Suffix List.
 */

/** Hôte d'une URL ; "" si l'URL est vide ou invalide. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Domaines à essayer, du plus précis au plus général. On s'arrête à deux labels :
 * en dessous, on ne demanderait plus qu'un TLD.
 */
export function domainCandidates(host: string): string[] {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i <= parts.length - 2; i++) out.push(parts.slice(i).join("."));
  return out;
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/lib/jobs/board.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/jobs/board.ts web/src/lib/jobs/board.test.ts
git commit -m "feat(jobs): cascade de domaines pour le favicon du jobboard

Le service de favicons renvoie 404 sur candidat.francetravail.fr et
jobs.lilylifestyle.co.uk (cas réels). Une règle « 2 derniers labels »
réduirait le second à co.uk, un suffixe public. La cascade essaie du
plus précis au plus général et se passe de Public Suffix List."
```

---

### Task 3: Choix des sources dans le profil

**Files:**
- Create: `web/src/lib/jobs/sources.ts`
- Modify: `web/src/lib/jobs/profile.ts` (champ `sources` + défaut)
- Modify: `web/src/lib/jobs/profileSchema.ts` (schéma tolérant)
- Modify: `web/src/lib/jobs/profileSchema.test.ts` (couverture du défaut)

**Interfaces:**
- Consumes: `SourceId` (Task 1)
- Produces: `SOURCES`, `SourceToggles`, `JobSearchProfile.sources`

- [ ] **Step 1: Écrire le test du défaut et de la tolérance**

Ajouter à la fin de `web/src/lib/jobs/profileSchema.test.ts` :

```ts
describe("sources", () => {
  it("active France Travail seule par défaut", () => {
    expect(parseProfile({}).sources).toEqual({
      francetravail: true, adzuna: false, jsearch: false,
    });
  });

  it("respecte un choix explicite", () => {
    const p = parseProfile({ sources: { francetravail: false, adzuna: true, jsearch: true } });
    expect(p.sources).toEqual({ francetravail: false, adzuna: true, jsearch: true });
  });

  it("retombe sur le défaut si la valeur est absurde", () => {
    expect(parseProfile({ sources: "oui" }).sources.francetravail).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/profileSchema.test.ts`
Expected: FAIL — `expected undefined to equal { francetravail: true, … }`.

- [ ] **Step 3: Créer `sources.ts`**

Créer `web/src/lib/jobs/sources.ts` :

```ts
import type { SourceId } from "./offer";

/**
 * Les trois sources interrogeables et leur quota mensuel gratuit.
 * `monthlyQuota: null` = pas de limite (France Travail).
 */
export const SOURCES: ReadonlyArray<{ id: SourceId; label: string; monthlyQuota: number | null }> = [
  { id: "francetravail", label: "France Travail", monthlyQuota: null },
  { id: "jsearch", label: "Google for Jobs", monthlyQuota: 200 },
  { id: "adzuna", label: "Adzuna", monthlyQuota: 1000 },
];

/** Quelles sources interroger lors d'une recherche. */
export type SourceToggles = Record<SourceId, boolean>;

/**
 * France Travail seule par défaut : l'utilisateur existant retrouve exactement
 * le comportement actuel, et aucun quota gratuit n'est consommé à son insu.
 */
export const DEFAULT_SOURCES: SourceToggles = {
  francetravail: true,
  adzuna: false,
  jsearch: false,
};
```

- [ ] **Step 4: Ajouter le champ au profil**

Dans `web/src/lib/jobs/profile.ts`, ajouter l'import en tête de fichier :

```ts
import { DEFAULT_SOURCES, type SourceToggles } from "./sources";
```

Puis, dans l'interface `JobSearchProfile`, juste après `aiShortlist` :

```ts
  /** Sources à interroger. Décochée = aucun appel réseau vers cette source. */
  sources: SourceToggles;
```

Et dans `EMPTY_PROFILE`, après `aiShortlist: 20,` :

```ts
  sources: DEFAULT_SOURCES,
```

- [ ] **Step 5: Ajouter le champ au schéma**

Dans `web/src/lib/jobs/profileSchema.ts`, ajouter après la ligne `aiShortlist: …` :

```ts
  sources: z.object({
    francetravail: z.boolean().catch(true),
    adzuna: z.boolean().catch(false),
    jsearch: z.boolean().catch(false),
  }).catch(EMPTY_PROFILE.sources),
```

- [ ] **Step 6: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/lib/jobs/profileSchema.test.ts`
Expected: PASS, dont les 3 nouveaux tests.

- [ ] **Step 7: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/jobs/sources.ts web/src/lib/jobs/profile.ts web/src/lib/jobs/profileSchema.ts web/src/lib/jobs/profileSchema.test.ts
git commit -m "feat(jobs): choix des sources dans le profil de recherche

France Travail seule par défaut : le comportement actuel est préservé
et aucun quota gratuit n'est consommé sans action de l'utilisateur."
```

---

### Task 4: France Travail au contrat `search()`

**Files:**
- Modify: `web/src/lib/jobs/francetravail.ts`
- Modify: `web/src/lib/jobs/francetravail.test.ts`

**Interfaces:**
- Consumes: `JobOffer`, `hostnameOf` (Tasks 1-2)
- Produces: `searchFranceTravail(profile, creds): Promise<{ offers: JobOffer[]; calls: number }>`

- [ ] **Step 1: Écrire les tests**

Ajouter à la fin de `web/src/lib/jobs/francetravail.test.ts` :

```ts
import { searchFranceTravail } from "./francetravail";

describe("searchFranceTravail", () => {
  const creds = { clientId: "id", clientSecret: "secret" };

  function stub(resultats: RawOffer[]) {
    const m = vi.fn(async (url: string) => {
      if (url.includes("access_token")) return { ok: true, json: async () => ({ access_token: "tok" }) };
      return { status: 200, json: async () => ({ resultats }) };
    });
    vi.stubGlobal("fetch", m);
    return m;
  }

  it("normalise une offre et déduit le domaine du jobboard", async () => {
    stub([{
      id: "1", intitule: "Webmaster", entreprise: { nom: "ACME" },
      lieuTravail: { libelle: "75 - Paris" },
      origineOffre: { urlOrigine: "https://candidat.francetravail.fr/offres/1" },
      typeContratLibelle: "CDI", salaire: { libelle: "Annuel de 33000 à 36000 Euros" },
    }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    const { offers, calls } = await searchFranceTravail(p, creds);
    expect(calls).toBe(1);
    expect(offers[0]).toMatchObject({
      source: "francetravail",
      boardDomain: "candidat.francetravail.fr",
      boardName: "France Travail",
      contractLabel: "CDI",
      salaryLabel: "Annuel de 33000 à 36000 Euros",
      logoUrl: "",
    });
  });

  it("compte un appel par mot-clé et dédoublonne par id", async () => {
    stub([{ id: "1", intitule: "Webmaster" }]);
    const p = parseProfile({ ...hariss, keywords: ["a", "b"] });
    const { offers, calls } = await searchFranceTravail(p, creds);
    expect(calls).toBe(2);
    expect(offers).toHaveLength(1);
  });

  it("écarte les stages/alternances", async () => {
    stub([{ id: "1", intitule: "Webmaster", alternance: true }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    expect((await searchFranceTravail(p, creds)).offers).toHaveLength(0);
  });

  it("renvoie 0 offre et 0 appel sans mot-clé", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: [] });
    expect(await searchFranceTravail(p, creds)).toEqual({ offers: [], calls: 0 });
    expect(m).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/francetravail.test.ts`
Expected: FAIL — `searchFranceTravail is not a function`.

- [ ] **Step 3: Ajouter le champ `salaire` à `RawOffer`**

Dans `web/src/lib/jobs/francetravail.ts`, ajouter à l'interface `RawOffer`, après `origineOffre` :

```ts
  salaire?: { libelle?: string };
```

- [ ] **Step 4: Compléter `mapOffer`**

Remplacer le corps de `mapOffer` par :

```ts
/** Offre brute → offre normalisée (description tronquée + destination de trajet). */
export function mapOffer(offer: RawOffer, maxDescriptionChars: number): JobOffer {
  const url = offer.origineOffre?.urlOrigine ?? "";
  return {
    id: offer.id ?? "",
    source: "francetravail",
    title: offer.intitule ?? "",
    company: offer.entreprise?.nom ?? "",
    location: offer.lieuTravail?.libelle ?? "",
    commuteDestination: commuteDestination(offer),
    url,
    jobText: (offer.description ?? "").slice(0, maxDescriptionChars),
    publishedAt: offer.dateCreation ?? "",
    // France Travail ne fournit aucun logo d'entreprise.
    logoUrl: "",
    boardDomain: hostnameOf(url),
    boardName: "France Travail",
    contractLabel: offer.typeContratLibelle ?? "",
    // France Travail renvoie déjà une phrase toute faite : on la garde telle quelle.
    salaryLabel: offer.salaire?.libelle ?? "",
  };
}
```

Ajouter l'import en tête de fichier :

```ts
import { hostnameOf } from "./board";
```

- [ ] **Step 5: Ajouter `searchFranceTravail`**

Ajouter à la fin de `web/src/lib/jobs/francetravail.ts` :

```ts
/**
 * Contrat commun aux trois sources : une requête par mot-clé, filtre
 * stages/alternances, dédoublonnage par id, description tronquée.
 * `calls` compte les appels de recherche facturables (le jeton ne compte pas).
 */
export async function searchFranceTravail(
  profile: JobSearchProfile,
  creds: { clientId: string; clientSecret: string },
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const token = await getToken(creds.clientId, creds.clientSecret);
  const seen = new Set<string>();
  const offers: JobOffer[] = [];
  let calls = 0;

  for (const keyword of profile.keywords) {
    const raw = await fetchOffers(token, keyword, profile);
    calls++;
    for (const offer of raw) {
      const id = offer.id ?? "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (isExcluded(offer, profile.excludedWords)) continue;
      offers.push(mapOffer(offer, profile.maxDescriptionChars));
    }
  }
  return { offers, calls };
}
```

- [ ] **Step 6: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/lib/jobs/francetravail.test.ts`
Expected: PASS, dont les 4 nouveaux tests.

- [ ] **Step 7: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/jobs/francetravail.ts web/src/lib/jobs/francetravail.test.ts
git commit -m "feat(jobs): France Travail expose le contrat search() commun

Remonte aussi le type de contrat, le salaire et le domaine du jobboard,
qui étaient perdus jusqu'ici."
```

---

### Task 5: Provider Adzuna

Adzuna n'a pas de notion de CDD : seulement `permanent`. Filtrer sur `permanent=1` dès que CDI est coché exclurait des CDD légitimes, d'où la règle « CDI seul → `permanent=1`, sinon aucun filtre » (spec §4.5). `where` attend un nom de lieu en clair, pas un code INSEE.

**Files:**
- Create: `web/src/lib/jobs/adzuna.ts`
- Create: `web/src/lib/jobs/adzuna.test.ts`

**Interfaces:**
- Consumes: `JobOffer`, `yearlySalaryLabel`, `hostnameOf` (Tasks 1-2)
- Produces: `searchAdzuna(profile, creds): Promise<{ offers: JobOffer[]; calls: number }>`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/lib/jobs/adzuna.test.ts` :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchAdzuna } from "./adzuna";
import { parseProfile } from "./profileSchema";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";

afterEach(() => vi.unstubAllGlobals());

const creds = { appId: "id", appKey: "key" };

function stub(results: unknown[]) {
  const m = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results }) }));
  vi.stubGlobal("fetch", m);
  return m;
}

describe("searchAdzuna", () => {
  it("normalise une offre", async () => {
    stub([{
      id: "42", title: "Webmaster", description: "Une description",
      company: { display_name: "ACME" },
      location: { display_name: "Paris, Ile-de-France" },
      redirect_url: "https://www.adzuna.fr/details/42",
      created: "2026-07-20T12:34:41Z",
      salary_min: 33000, salary_max: 36000,
      contract_type: "permanent", contract_time: "full_time",
    }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    const { offers, calls } = await searchAdzuna(p, creds);
    expect(calls).toBe(1);
    expect(offers[0]).toMatchObject({
      id: "adzuna-42", source: "adzuna", title: "Webmaster", company: "ACME",
      location: "Paris, Ile-de-France", boardDomain: "www.adzuna.fr",
      boardName: "Adzuna", contractLabel: "CDI · Plein temps",
      salaryLabel: "33–36 k€ / an", logoUrl: "",
    });
  });

  it("n'envoie aucun filtre de contrat quand CDI et CDD sont cochés", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: ["x"], contractTypes: ["CDI", "CDD"] });
    await searchAdzuna(p, creds);
    expect(String(m.mock.calls[0][0])).not.toContain("permanent=");
  });

  it("envoie permanent=1 quand CDI est le seul type coché", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: ["x"], contractTypes: ["CDI"] });
    await searchAdzuna(p, creds);
    expect(String(m.mock.calls[0][0])).toContain("permanent=1");
  });

  it("passe le lieu en clair et le rayon pour une commune", async () => {
    const m = stub([]);
    const p = parseProfile({
      ...hariss, keywords: ["x"],
      location: { kind: "commune", code: "75056", label: "Paris (75001)", radiusKm: 20 },
    });
    await searchAdzuna(p, creds);
    const url = String(m.mock.calls[0][0]);
    expect(url).toContain("where=Paris");   // le code postal entre parenthèses est retiré
    expect(url).toContain("distance=20");
  });

  it("écarte les stages/alternances via excludedWords", async () => {
    stub([{ id: "1", title: "Webmaster en alternance", description: "" }]);
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchAdzuna(p, creds)).offers).toHaveLength(0);
  });

  it("renvoie [] sans jeter si l'API échoue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchAdzuna(p, creds)).offers).toEqual([]);
  });

  it("renvoie 0 offre et 0 appel sans mot-clé", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: [] });
    expect(await searchAdzuna(p, creds)).toEqual({ offers: [], calls: 0 });
    expect(m).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/adzuna.test.ts`
Expected: FAIL — `Failed to resolve import "./adzuna"`.

- [ ] **Step 3: Extraire le filtre d'exclusion réutilisable**

`isExcluded` de `francetravail.ts` prend une `RawOffer`. Les trois sources ont besoin de la même règle sur du texte brut. Créer `web/src/lib/jobs/exclude.ts` :

```ts
/**
 * Filtre stages/alternances, partagé par les trois sources. Extrait de
 * `francetravail.ts`, où il était couplé au type d'offre brute France Travail.
 */

/** Minuscule + suppression des accents (aligné sur includeFilter). */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** True si le texte contient un mot interdit, ou « stage » en mot isolé. */
export function isExcludedText(text: string, excludedWords: string[]): boolean {
  const t = norm(text);
  if (excludedWords.some((w) => w.trim() !== "" && t.includes(norm(w)))) return true;
  // "stage" en mot isolé (les tirets comptent comme séparateurs).
  return t.replace(/-/g, " ").split(/\s+/).includes("stage");
}
```

Puis, dans `web/src/lib/jobs/francetravail.ts`, remplacer le corps de `isExcluded` (et supprimer la fonction locale `norm`, devenue inutilisée) :

```ts
/** True si l'offre est un stage/alternance (filtre local strict, port de `bot.py`). */
export function isExcluded(offer: RawOffer, excludedWords: string[]): boolean {
  if (offer.alternance) return true;
  return isExcludedText(
    `${offer.intitule ?? ""} ${offer.description ?? ""} ${offer.typeContratLibelle ?? ""}`,
    excludedWords,
  );
}
```

Ajouter l'import :

```ts
import { isExcludedText } from "./exclude";
```

- [ ] **Step 4: Écrire `adzuna.ts`**

Créer `web/src/lib/jobs/adzuna.ts` :

```ts
/**
 * Accès à l'API Adzuna (agrégateur de 270+ jobboards partenaires français).
 * Endpoint vérifié en direct : 2 258 offres pour « développeur » à Paris.
 *
 * Adzuna ne fournit ni logo d'entreprise ni jobboard d'origine : `redirect_url`
 * pointe toujours vers adzuna.fr. La pastille de la carte affiche donc Adzuna.
 */

import type { JobSearchProfile } from "./profile";
import { type JobOffer, yearlySalaryLabel } from "./offer";
import { hostnameOf } from "./board";
import { isExcludedText } from "./exclude";

const SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/fr/search/1";

/** Offre brute Adzuna (champs utilisés uniquement). */
interface RawAdzuna {
  id?: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number | null;
  salary_max?: number | null;
  contract_type?: string;  // "permanent" | "contract"
  contract_time?: string;  // "full_time" | "part_time"
}

/** `where` attend un nom de lieu en clair : on retire le code postal entre parenthèses. */
function placeName(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "").trim();
}

/** "CDI · Plein temps", "CDD", "" — Adzuna ne connaît que permanent/contract. */
function contractLabel(o: RawAdzuna): string {
  const kind = o.contract_type === "permanent" ? "CDI" : o.contract_type === "contract" ? "CDD" : "";
  const time = o.contract_time === "full_time" ? "Plein temps"
    : o.contract_time === "part_time" ? "Temps partiel" : "";
  return [kind, time].filter(Boolean).join(" · ");
}

/**
 * Une requête par mot-clé, résultats fusionnés et dédoublonnés par id.
 * `calls` compte les requêtes émises (quota gratuit : 1 000 / mois).
 * Une requête en échec renvoie [] sans faire échouer les autres.
 */
export async function searchAdzuna(
  profile: JobSearchProfile,
  creds: { appId: string; appKey: string },
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const seen = new Set<string>();
  const offers: JobOffer[] = [];
  let calls = 0;

  for (const keyword of profile.keywords) {
    const params = new URLSearchParams({
      app_id: creds.appId,
      app_key: creds.appKey,
      results_per_page: "50",
      what: keyword,
      max_days_old: String(profile.maxAgeDays),
      "content-type": "application/json",
    });

    const place = placeName(profile.location.label);
    if (place) {
      params.set("where", place);
      // Le rayon n'a de sens que pour une commune (cf. LocationFilter).
      if (profile.location.kind === "commune") params.set("distance", String(profile.location.radiusKm));
    }

    // Adzuna n'a pas de CDD : filtrer sur permanent dès que CDI est coché
    // exclurait des CDD légitimes. On ne filtre que si CDI est le seul type.
    if (profile.contractTypes.length === 1 && profile.contractTypes[0] === "CDI") {
      params.set("permanent", "1");
    }
    if (profile.salaireMin != null) params.set("salary_min", String(profile.salaireMin));

    calls++;
    let raw: RawAdzuna[] = [];
    try {
      const res = await fetch(`${SEARCH_URL}?${params}`, { headers: { Accept: "application/json" } });
      if (res.ok) raw = ((await res.json()) as { results?: RawAdzuna[] }).results ?? [];
    } catch {
      // Panne réseau ponctuelle : cette requête ne rapporte rien, les autres continuent.
    }

    for (const o of raw) {
      const id = o.id ? `adzuna-${o.id}` : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (isExcludedText(`${o.title ?? ""} ${o.description ?? ""}`, profile.excludedWords)) continue;

      const url = o.redirect_url ?? "";
      offers.push({
        id,
        source: "adzuna",
        title: o.title ?? "",
        company: o.company?.display_name ?? "",
        location: o.location?.display_name ?? "",
        commuteDestination: o.location?.display_name ?? "",
        url,
        jobText: (o.description ?? "").slice(0, profile.maxDescriptionChars),
        publishedAt: o.created ?? "",
        logoUrl: "",
        boardDomain: hostnameOf(url),
        boardName: "Adzuna",
        contractLabel: contractLabel(o),
        salaryLabel: yearlySalaryLabel(o.salary_min, o.salary_max),
      });
    }
  }
  return { offers, calls };
}
```

- [ ] **Step 5: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/lib/jobs/adzuna.test.ts src/lib/jobs/francetravail.test.ts`
Expected: PASS — les 7 tests Adzuna et les tests France Travail existants (dont ceux de `isExcluded`, inchangés).

- [ ] **Step 6: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/jobs/adzuna.ts web/src/lib/jobs/adzuna.test.ts web/src/lib/jobs/exclude.ts web/src/lib/jobs/francetravail.ts
git commit -m "feat(jobs): provider Adzuna

Adzuna ne connaît pas le CDD : on ne filtre sur permanent que si CDI est
le seul type coché, sinon des CDD légitimes seraient exclus. Le filtre
stages/alternances est extrait dans exclude.ts, partagé par les sources."
```

---

### Task 6: Provider JSearch (Google for Jobs)

Seule source à fournir un logo d'entreprise (≈ 6 offres sur 10, mesuré en direct) et le vrai jobboard d'origine. Elle ne connaît ni rayon, ni contrat, ni salaire en filtre : ces critères sont absorbés par les filtres app-side et le scoring IA (spec §4.4).

**Files:**
- Create: `web/src/lib/jobs/jsearch.ts`
- Create: `web/src/lib/jobs/jsearch.test.ts`

**Interfaces:**
- Consumes: `JobOffer`, `yearlySalaryLabel`, `hostnameOf`, `isExcludedText` (Tasks 1-2, 5)
- Produces: `searchJSearch(profile, creds): Promise<{ offers: JobOffer[]; calls: number }>`, `datePosted(maxAgeDays)`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/lib/jobs/jsearch.test.ts` :

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchJSearch, datePosted } from "./jsearch";
import { parseProfile } from "./profileSchema";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";

afterEach(() => vi.unstubAllGlobals());

const creds = { apiKey: "ak_test" };

function stub(jobs: unknown[]) {
  const m = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { jobs } }) }));
  vi.stubGlobal("fetch", m);
  return m;
}

describe("datePosted", () => {
  it("prend le plus grand palier ne dépassant pas maxAgeDays", () => {
    expect(datePosted(30)).toBe("month");
    expect(datePosted(7)).toBe("week");
    expect(datePosted(5)).toBe("3days");
    expect(datePosted(3)).toBe("3days");
    expect(datePosted(1)).toBe("today");
  });
});

describe("searchJSearch", () => {
  it("normalise une offre avec logo et jobboard réel", async () => {
    stub([{
      job_id: "abc", job_title: "Webmaster F/H",
      employer_name: "Médecins sans Frontières France",
      employer_logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:X&s=0",
      job_location: "Paris", job_description: "Une description",
      job_employment_type: "À plein temps",
      job_publisher: "Jobs That Make Sense",
      job_apply_link: "https://jobs.makesense.org/fr/jobs/msf",
      job_posted_at_datetime_utc: "2026-07-23T00:00:00.000Z",
      job_min_salary: null, job_max_salary: null,
    }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    const { offers, calls } = await searchJSearch(p, creds);
    expect(calls).toBe(1);
    expect(offers[0]).toMatchObject({
      id: "jsearch-abc", source: "jsearch",
      company: "Médecins sans Frontières France",
      logoUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:X&s=0",
      boardDomain: "jobs.makesense.org",
      boardName: "Jobs That Make Sense",
      contractLabel: "À plein temps",
      salaryLabel: "",
    });
  });

  it("laisse logoUrl vide quand l'API n'en fournit pas", async () => {
    stub([{ job_id: "x", job_title: "Webmaster", employer_logo: null, job_description: "" }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    expect((await searchJSearch(p, creds)).offers[0].logoUrl).toBe("");
  });

  it("injecte le lieu dans la requête et envoie la clé en en-tête", async () => {
    const m = stub([]);
    const p = parseProfile({
      ...hariss, keywords: ["Webmaster"],
      location: { kind: "commune", code: "75056", label: "Paris (75001)", radiusKm: 20 },
    });
    await searchJSearch(p, creds);
    const [url, init] = m.mock.calls[0] as unknown as [string, RequestInit];
    expect(decodeURIComponent(String(url))).toContain("query=Webmaster en Paris");
    expect(String(url)).toContain("country=fr");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("ak_test");
  });

  it("écarte les stages/alternances via excludedWords", async () => {
    stub([{ job_id: "1", job_title: "Webmaster en alternance", job_description: "" }]);
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchJSearch(p, creds)).offers).toHaveLength(0);
  });

  it("renvoie [] sans jeter si l'API échoue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchJSearch(p, creds)).offers).toEqual([]);
  });

  it("renvoie 0 offre et 0 appel sans mot-clé", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: [] });
    expect(await searchJSearch(p, creds)).toEqual({ offers: [], calls: 0 });
    expect(m).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/jsearch.test.ts`
Expected: FAIL — `Failed to resolve import "./jsearch"`.

- [ ] **Step 3: Écrire `jsearch.ts`**

Créer `web/src/lib/jobs/jsearch.ts` :

```ts
/**
 * Accès à JSearch (OpenWeb Ninja), wrapper légal de Google for Jobs : LinkedIn,
 * Indeed, Glassdoor et des milliers d'autres sites via l'index Google.
 *
 * Seule source à fournir un logo d'entreprise (`employer_logo`, ≈ 6 offres sur
 * 10 mesuré en direct) et le jobboard réel (`job_publisher` + `job_apply_link`).
 *
 * Elle ignore rayon, type de contrat et salaire : ces critères ne sont pas des
 * paramètres de l'API. Les filtres app-side (`excludedWords`, `includeKeywords`)
 * et le scoring IA, qui reçoit le profil complet, absorbent l'écart.
 *
 * Quota gratuit : 200 appels / mois.
 */

import type { JobSearchProfile } from "./profile";
import { type JobOffer, yearlySalaryLabel } from "./offer";
import { hostnameOf } from "./board";
import { isExcludedText } from "./exclude";

const SEARCH_URL = "https://api.openwebninja.com/jsearch/search-v2";

/** Offre brute JSearch (champs utilisés uniquement). */
interface RawJSearch {
  job_id?: string;
  job_title?: string;
  job_description?: string;
  employer_name?: string;
  employer_logo?: string | null;
  job_location?: string;
  job_city?: string;
  job_employment_type?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
}

/** Paliers de `date_posted` : le plus grand ne dépassant pas `maxAgeDays`. */
export function datePosted(maxAgeDays: number): "today" | "3days" | "week" | "month" {
  if (maxAgeDays >= 30) return "month";
  if (maxAgeDays >= 7) return "week";
  if (maxAgeDays >= 3) return "3days";
  return "today";
}

/** Le lieu n'a pas de paramètre dédié : il s'écrit dans la requête en langage naturel. */
function placeName(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * Une requête par mot-clé, résultats fusionnés et dédoublonnés par id.
 * Une requête en échec renvoie [] sans faire échouer les autres.
 */
export async function searchJSearch(
  profile: JobSearchProfile,
  creds: { apiKey: string },
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const place = placeName(profile.location.label);
  const seen = new Set<string>();
  const offers: JobOffer[] = [];
  let calls = 0;

  for (const keyword of profile.keywords) {
    const params = new URLSearchParams({
      query: place ? `${keyword} en ${place}` : keyword,
      country: "fr",
      language: "fr",
      date_posted: datePosted(profile.maxAgeDays),
      num_pages: "1",
    });

    calls++;
    let raw: RawJSearch[] = [];
    try {
      const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: { "x-api-key": creds.apiKey, Accept: "application/json" },
      });
      if (res.ok) raw = ((await res.json()) as { data?: { jobs?: RawJSearch[] } }).data?.jobs ?? [];
    } catch {
      // Panne réseau ponctuelle : cette requête ne rapporte rien, les autres continuent.
    }

    for (const o of raw) {
      const id = o.job_id ? `jsearch-${o.job_id}` : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (isExcludedText(`${o.job_title ?? ""} ${o.job_description ?? ""}`, profile.excludedWords)) continue;

      const url = o.job_apply_link ?? "";
      const domain = hostnameOf(url);
      const place2 = o.job_location || o.job_city || "";
      offers.push({
        id,
        source: "jsearch",
        title: o.job_title ?? "",
        company: o.employer_name ?? "",
        location: place2,
        commuteDestination: place2,
        url,
        jobText: (o.job_description ?? "").slice(0, profile.maxDescriptionChars),
        publishedAt: o.job_posted_at_datetime_utc ?? "",
        logoUrl: o.employer_logo ?? "",
        boardDomain: domain,
        // `job_publisher` est le vrai nom du jobboard ("LinkedIn", "Indeed"…).
        boardName: o.job_publisher || domain,
        contractLabel: o.job_employment_type ?? "",
        salaryLabel: yearlySalaryLabel(o.job_min_salary, o.job_max_salary),
      });
    }
  }
  return { offers, calls };
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/lib/jobs/jsearch.test.ts`
Expected: PASS — 11 tests (5 `datePosted` + 6 `searchJSearch`).

- [ ] **Step 5: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/jobs/jsearch.ts web/src/lib/jobs/jsearch.test.ts
git commit -m "feat(jobs): provider JSearch (Google for Jobs)

Seule source fournissant un logo d'entreprise et le jobboard réel.
Elle ignore rayon, contrat et salaire : absence de paramètres côté API,
absorbée par les filtres app-side et le scoring IA."
```

---

### Task 7: Dédoublonnage inter-source

Une même offre peut remonter de deux sources avec des identifiants différents : le dédoublonnage par `id` ne peut rien. On réutilise `normKey(entreprise, poste)`, déjà éprouvée par le tracker de candidatures.

**Files:**
- Create: `web/src/lib/jobs/dedupe.ts`
- Create: `web/src/lib/jobs/dedupe.test.ts`

**Interfaces:**
- Consumes: `JobOffer` (Task 1), `normKey` de `@/lib/applications/normKey`
- Produces: `dedupeOffers(offers): JobOffer[]`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/lib/jobs/dedupe.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { dedupeOffers } from "./dedupe";
import type { JobOffer, SourceId } from "./offer";

function offer(source: SourceId, company: string, title: string, extra: Partial<JobOffer> = {}): JobOffer {
  return {
    id: `${source}-${company}-${title}`, source, title, company,
    location: "", commuteDestination: "", url: "", jobText: "", publishedAt: "",
    logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "",
    ...extra,
  };
}

describe("dedupeOffers", () => {
  it("garde France Travail face à JSearch et Adzuna", () => {
    const out = dedupeOffers([
      offer("adzuna", "ACME", "Webmaster"),
      offer("francetravail", "ACME", "Webmaster"),
      offer("jsearch", "ACME", "Webmaster"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("francetravail");
  });

  it("garde JSearch face à Adzuna", () => {
    const out = dedupeOffers([
      offer("adzuna", "ACME", "Webmaster"),
      offer("jsearch", "ACME", "Webmaster"),
    ]);
    expect(out[0].source).toBe("jsearch");
  });

  it("adopte le logo d'un doublon écarté", () => {
    const out = dedupeOffers([
      offer("francetravail", "ACME", "Webmaster"),
      offer("jsearch", "ACME", "Webmaster", { logoUrl: "https://logo/acme.png" }),
    ]);
    expect(out[0].source).toBe("francetravail");
    expect(out[0].logoUrl).toBe("https://logo/acme.png");
  });

  it("n'écrase pas un logo déjà présent", () => {
    const out = dedupeOffers([
      offer("jsearch", "ACME", "Webmaster", { logoUrl: "https://logo/garde.png" }),
      offer("adzuna", "ACME", "Webmaster", { logoUrl: "https://logo/autre.png" }),
    ]);
    expect(out[0].logoUrl).toBe("https://logo/garde.png");
  });

  it("ignore la casse et les accents", () => {
    const out = dedupeOffers([
      offer("francetravail", "Médecins Sans Frontières", "Webmaster F/H"),
      offer("jsearch", "medecins sans frontieres", "webmaster f h"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("garde deux offres distinctes", () => {
    const out = dedupeOffers([
      offer("francetravail", "ACME", "Webmaster"),
      offer("francetravail", "ACME", "Développeur"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("garde les offres sans entreprise ni poste exploitables", () => {
    const out = dedupeOffers([offer("adzuna", "", ""), offer("jsearch", "", "")]);
    expect(out).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/dedupe.test.ts`
Expected: FAIL — `Failed to resolve import "./dedupe"`.

- [ ] **Step 3: Écrire `dedupe.ts`**

Créer `web/src/lib/jobs/dedupe.ts` :

```ts
/**
 * Dédoublonnage inter-source. Une même offre peut remonter de deux sources avec
 * des identifiants différents (un partenaire d'Adzuna republie une offre France
 * Travail ; Google indexe les deux) : le dédoublonnage par id ne peut rien.
 *
 * On réutilise `normKey(entreprise, poste)`, déjà éprouvée par le tracker de
 * candidatures. Ce choix accepte un risque connu : deux postes réellement
 * distincts au même intitulé dans la même entreprise fusionnent. C'est le
 * compromis déjà retenu côté candidatures, sans problème en usage réel.
 *
 * Appelé AVANT le pré-tri, donc avant tout appel IA : deux publications de la
 * même offre ne consomment jamais deux notations.
 */

import { normKey } from "@/lib/applications/normKey";
import type { JobOffer, SourceId } from "./offer";

/**
 * France Travail d'abord (description la plus complète, lien direct), puis
 * JSearch (apporte le logo), puis Adzuna. Plus petit = prioritaire.
 */
const PRIORITY: Record<SourceId, number> = { francetravail: 0, jsearch: 1, adzuna: 2 };

export function dedupeOffers(offers: JobOffer[]): JobOffer[] {
  const best = new Map<string, JobOffer>();
  const out: JobOffer[] = [];

  for (const offer of offers) {
    const key = normKey(offer.company, offer.title);
    // Sans entreprise ni poste exploitables, aucune fusion possible : on garde.
    if (!key) {
      out.push(offer);
      continue;
    }
    const current = best.get(key);
    if (!current) {
      best.set(key, offer);
      continue;
    }
    const winner = PRIORITY[offer.source] < PRIORITY[current.source] ? offer : current;
    const loser = winner === offer ? current : offer;
    // Le gagnant reste la référence, mais récupère le logo du perdant s'il n'en
    // a pas : garder la meilleure description en jetant la seule information
    // visuelle disponible serait absurde.
    best.set(key, winner.logoUrl ? winner : { ...winner, logoUrl: loser.logoUrl });
  }

  return [...out, ...best.values()];
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/lib/jobs/dedupe.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/jobs/dedupe.ts web/src/lib/jobs/dedupe.test.ts
git commit -m "feat(jobs): dédoublonnage inter-source par normKey

Avant le pré-tri, donc avant tout appel IA. Le gagnant adopte le logo
d'un doublon écarté quand il n'en a pas."
```

---

### Task 8: Orchestration de la route de recherche

**Files:**
- Modify: `web/src/app/api/jobs/search/route.ts` (réécriture complète)
- Create: `web/src/app/api/jobs/search/route.test.ts`

**Interfaces:**
- Consumes: `searchFranceTravail`, `searchAdzuna`, `searchJSearch`, `dedupeOffers`, `matchesIncludeKeywords`
- Produces: réponse `{ offers: JobOffer[]; calls: Record<SourceId, number>; failed: SourceId[] }`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/app/api/jobs/search/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import hariss from "../../../../../tests/fixtures/job_profile_hariss.json";

const ft = vi.hoisted(() => vi.fn());
const adz = vi.hoisted(() => vi.fn());
const js = vi.hoisted(() => vi.fn());

vi.mock("@/lib/jobs/francetravail", async (orig) => ({
  ...(await orig<typeof import("@/lib/jobs/francetravail")>()),
  searchFranceTravail: ft,
}));
vi.mock("@/lib/jobs/adzuna", () => ({ searchAdzuna: adz }));
vi.mock("@/lib/jobs/jsearch", () => ({ searchJSearch: js }));

import { POST } from "./route";

function offer(id: string, source: string, extra: Record<string, unknown> = {}) {
  return {
    id, source, title: `Poste ${id}`, company: `Boite ${id}`,
    location: "", commuteDestination: "", url: "", jobText: "mot", publishedAt: "",
    logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "",
    ...extra,
  };
}

function req(profile: Record<string, unknown>) {
  return new Request("http://x/api/jobs/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FT_CLIENT_ID = "id";
  process.env.FT_CLIENT_SECRET = "secret";
  process.env.ADZUNA_APP_ID = "aid";
  process.env.ADZUNA_APP_KEY = "akey";
  process.env.JSEARCH_API_KEY = "jkey";
  ft.mockResolvedValue({ offers: [], calls: 0 });
  adz.mockResolvedValue({ offers: [], calls: 0 });
  js.mockResolvedValue({ offers: [], calls: 0 });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/jobs/search", () => {
  it("n'interroge que les sources activées", async () => {
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: false, jsearch: false } }));
    expect(res.status).toBe(200);
    expect(ft).toHaveBeenCalledTimes(1);
    expect(adz).not.toHaveBeenCalled();
    expect(js).not.toHaveBeenCalled();
  });

  it("interroge les trois quand elles sont activées", async () => {
    await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: true, jsearch: true } }));
    expect(ft).toHaveBeenCalledTimes(1);
    expect(adz).toHaveBeenCalledTimes(1);
    expect(js).toHaveBeenCalledTimes(1);
  });

  it("une source en échec n'empêche pas les autres", async () => {
    ft.mockRejectedValue(new Error("FT HS"));
    js.mockResolvedValue({ offers: [offer("1", "jsearch")], calls: 1 });
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: false, jsearch: true } }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(1);
    expect(data.failed).toEqual(["francetravail"]);
  });

  it("remonte le nombre d'appels par source", async () => {
    ft.mockResolvedValue({ offers: [], calls: 2 });
    js.mockResolvedValue({ offers: [], calls: 3 });
    const res = await POST(req({ ...hariss, keywords: ["a", "b"],
      sources: { francetravail: true, adzuna: false, jsearch: true } }));
    const data = await res.json();
    expect(data.calls).toEqual({ francetravail: 2, adzuna: 0, jsearch: 3 });
  });

  it("dédoublonne entre sources", async () => {
    ft.mockResolvedValue({ offers: [offer("a", "francetravail",
      { company: "ACME", title: "Webmaster" })], calls: 1 });
    js.mockResolvedValue({ offers: [offer("b", "jsearch",
      { company: "ACME", title: "Webmaster" })], calls: 1 });
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: false, jsearch: true } }));
    const data = await res.json();
    expect(data.offers).toHaveLength(1);
    expect(data.offers[0].source).toBe("francetravail");
  });

  it("400 config si les clés d'une source activée manquent", async () => {
    delete process.env.JSEARCH_API_KEY;
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: false, adzuna: false, jsearch: true } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("config");
  });

  it("400 config si aucune source n'est activée", async () => {
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: false, adzuna: false, jsearch: false } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("config");
  });

  it("applique le filtre includeKeywords", async () => {
    ft.mockResolvedValue({ offers: [
      offer("1", "francetravail", { title: "Avec wordpress" }),
      offer("2", "francetravail", { title: "Sans rien", jobText: "" }),
    ], calls: 1 });
    const res = await POST(req({ ...hariss, keywords: ["x"], includeKeywords: ["wordpress"],
      sources: { francetravail: true, adzuna: false, jsearch: false } }));
    const data = await res.json();
    expect(data.offers).toHaveLength(1);
    expect(data.offers[0].title).toBe("Avec wordpress");
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/app/api/jobs/search/route.test.ts`
Expected: FAIL — la route ignore encore `sources` et ne renvoie ni `calls` ni `failed`.

- [ ] **Step 3: Réécrire la route**

Remplacer entièrement `web/src/app/api/jobs/search/route.ts` :

```ts
import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/jobs/resolveProfile";
import { searchFranceTravail } from "@/lib/jobs/francetravail";
import { searchAdzuna } from "@/lib/jobs/adzuna";
import { searchJSearch } from "@/lib/jobs/jsearch";
import { dedupeOffers } from "@/lib/jobs/dedupe";
import { matchesIncludeKeywords } from "@/lib/jobs/includeFilter";
import type { JobOffer, SourceId } from "@/lib/jobs/offer";

// Appels réseau sortants : runtime Node.js.
export const runtime = "nodejs";
export const maxDuration = 60;

const ZERO_CALLS: Record<SourceId, number> = { francetravail: 0, adzuna: 0, jsearch: 0 };

/**
 * Recherche les offres pour le profil courant, sur les seules sources activées.
 *
 * Les sources sont interrogées en parallèle : une panne de l'une n'empêche pas
 * les autres de répondre (elle est signalée dans `failed`). Les résultats sont
 * fusionnés, dédoublonnés inter-source, puis filtrés par `includeKeywords`.
 *
 * Réponse : `{ offers, calls, failed }`. `calls` alimente le compteur de quota
 * local côté client.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // corps vide/invalide toléré → profil neutre
  }
  const profile = resolveProfile(body);

  if (profile.keywords.length === 0) {
    return NextResponse.json({ offers: [], calls: ZERO_CALLS, failed: [] });
  }

  const ftId = process.env.FT_CLIENT_ID;
  const ftSecret = process.env.FT_CLIENT_SECRET;
  const adzId = process.env.ADZUNA_APP_ID;
  const adzKey = process.env.ADZUNA_APP_KEY;
  const jsKey = process.env.JSEARCH_API_KEY;

  // Chaque source activée doit avoir ses clés : mieux vaut le dire tout de suite
  // que de renvoyer une liste amputée sans explication.
  const missing: string[] = [];
  if (profile.sources.francetravail && !(ftId && ftSecret)) missing.push("FT_CLIENT_ID / FT_CLIENT_SECRET");
  if (profile.sources.adzuna && !(adzId && adzKey)) missing.push("ADZUNA_APP_ID / ADZUNA_APP_KEY");
  if (profile.sources.jsearch && !jsKey) missing.push("JSEARCH_API_KEY");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "config", message: `Clés manquantes pour les sources activées : ${missing.join(", ")}.` },
      { status: 400 },
    );
  }

  const enabled = (Object.keys(profile.sources) as SourceId[]).filter((s) => profile.sources[s]);
  if (enabled.length === 0) {
    return NextResponse.json(
      { error: "config", message: "Aucune source sélectionnée. Coche au moins une source dans « Mes critères »." },
      { status: 400 },
    );
  }

  const runners: Record<SourceId, () => Promise<{ offers: JobOffer[]; calls: number }>> = {
    francetravail: () => searchFranceTravail(profile, { clientId: ftId!, clientSecret: ftSecret! }),
    adzuna: () => searchAdzuna(profile, { appId: adzId!, appKey: adzKey! }),
    jsearch: () => searchJSearch(profile, { apiKey: jsKey! }),
  };

  // `allSettled` : une source qui jette ne doit pas emporter les autres.
  const settled = await Promise.allSettled(enabled.map((s) => runners[s]()));

  const calls = { ...ZERO_CALLS };
  const failed: SourceId[] = [];
  let merged: JobOffer[] = [];

  settled.forEach((r, i) => {
    const source = enabled[i];
    if (r.status === "fulfilled") {
      calls[source] = r.value.calls;
      merged = merged.concat(r.value.offers);
    } else {
      failed.push(source);
      console.warn(`Source ${source} en échec :`, r.reason);
    }
  });

  const offers = dedupeOffers(merged).filter((o) => matchesIncludeKeywords(o, profile.includeKeywords));
  return NextResponse.json({ offers, calls, failed });
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/app/api/jobs/search/route.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/api/jobs/search/route.ts web/src/app/api/jobs/search/route.test.ts
git commit -m "feat(jobs): orchestration multi-source de la recherche

Sources activées interrogées en parallèle via allSettled : une panne de
l'une ne casse pas les autres, elle est signalée dans failed. Renvoie
aussi le nombre d'appels par source pour le compteur de quota."
```

---

### Task 9: Dexie v9 — champs d'offre et compteur de quota

**Files:**
- Modify: `web/src/lib/storage/db.ts` (interface `JobEntry`, version 9, table `apiUsage`, helpers)
- Create: `web/src/lib/storage/apiUsage.test.ts`

**Interfaces:**
- Consumes: `SourceId` (Task 1)
- Produces: `bumpApiUsage(calls)`, `getApiUsage()`, `usageKey(source, date)`

- [ ] **Step 1: Écrire le test de la clé de période**

Créer `web/src/lib/storage/apiUsage.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { usageKey } from "./db";

describe("usageKey", () => {
  it("compose source + mois courant", () => {
    expect(usageKey("jsearch", new Date("2026-07-27T10:00:00Z"))).toBe("jsearch-2026-07");
  });

  it("garde le mois sur deux chiffres", () => {
    expect(usageKey("adzuna", new Date("2026-01-03T10:00:00Z"))).toBe("adzuna-2026-01");
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/lib/storage/apiUsage.test.ts`
Expected: FAIL — `usageKey is not a function`.

- [ ] **Step 3: Étendre `JobEntry`**

Dans `web/src/lib/storage/db.ts`, ajouter dans l'interface `JobEntry`, après `applicationId?: string;` :

```ts
  /** Source qui a fait remonter l'offre. Absent = donnée d'avant la v9. */
  source?: SourceId;
  /** Logo d'entreprise fourni par la source ; absent/"" → repli sur l'initiale. */
  logoUrl?: string;
  /** Hôte du lien de l'offre, pour le favicon du jobboard. */
  boardDomain?: string;
  /** Nom lisible du jobboard, ex. "LinkedIn". */
  boardName?: string;
  /** "CDI · Plein temps"… ; absent/"" → « Type non précisé ». */
  contractLabel?: string;
  /** "33–36 k€ / an" ; absent/"" → « Salaire non précisé ». */
  salaryLabel?: string;
```

Ajouter l'import en tête de fichier, à côté des autres imports de types :

```ts
import type { SourceId } from "@/lib/jobs/offer";
```

Ces champs sont **optionnels** à dessein : les offres déjà stockées ne les ont pas, et l'affichage retombe sur ses valeurs de repli. Aucun `upgrade` n'est donc nécessaire.

- [ ] **Step 4: Déclarer la table de quota et la version 9**

Ajouter la déclaration de table dans la classe `AppDatabase`, après `applications!: …` :

```ts
  apiUsage!: Table<{ key: string; count: number }, string>; // Primary key: key
```

Puis, après le bloc `this.version(8)…` :

```ts
    // v9 : sources multiples. Les champs ajoutés à JobEntry sont optionnels —
    // les offres existantes n'en ont pas et l'affichage retombe sur ses replis,
    // donc aucun upgrade n'est nécessaire. Nouvelle table de comptage d'appels.
    this.version(9).stores({
      apiUsage: "key",
    });
```

- [ ] **Step 5: Ajouter les helpers de quota**

Ajouter à la fin de `web/src/lib/storage/db.ts` :

```ts
// ---------------------------------------------------------------------------
// QUOTA D'APPELS API
// ---------------------------------------------------------------------------

/** Clé de comptage : une ligne par source et par mois. */
export function usageKey(source: SourceId, at: Date): string {
  const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
  return `${source}-${month}`;
}

/**
 * Incrémente les compteurs du mois courant.
 *
 * Compteur **local et indicatif** : il mesure ce que ce navigateur a consommé,
 * pas ce que le fournisseur a facturé. Il sert à éviter d'épuiser un quota
 * gratuit sans s'en rendre compte, pas à faire autorité.
 */
export async function bumpApiUsage(calls: Partial<Record<SourceId, number>>): Promise<void> {
  const now = new Date();
  try {
    await db.transaction("rw", db.apiUsage, async () => {
      for (const [source, n] of Object.entries(calls) as [SourceId, number][]) {
        if (!n) continue;
        const key = usageKey(source, now);
        const row = await db.apiUsage.get(key);
        await db.apiUsage.put({ key, count: (row?.count ?? 0) + n });
      }
    });
  } catch (e) {
    console.warn("bumpApiUsage error:", e);
  }
}

/** Appels consommés ce mois-ci, par source. */
export async function getApiUsage(): Promise<Record<SourceId, number>> {
  const now = new Date();
  const out: Record<SourceId, number> = { francetravail: 0, adzuna: 0, jsearch: 0 };
  try {
    for (const source of Object.keys(out) as SourceId[]) {
      out[source] = (await db.apiUsage.get(usageKey(source, now)))?.count ?? 0;
    }
  } catch (e) {
    console.warn("getApiUsage error:", e);
  }
  return out;
}
```

- [ ] **Step 6: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/lib/storage/apiUsage.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 7: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/storage/db.ts web/src/lib/storage/apiUsage.test.ts
git commit -m "feat(storage): Dexie v9 — champs d'offre et compteur d'appels

Les champs ajoutés à JobEntry sont optionnels : les offres déjà
stockées n'en ont pas et l'affichage retombe sur ses replis, donc pas
d'upgrade. Le compteur de quota est local et indicatif, pas comptable."
```

---

### Task 10: Composant `BoardIcon` — favicon avec cascade

**Files:**
- Create: `web/src/components/jobs/BoardIcon.tsx`
- Create: `web/src/components/jobs/BoardIcon.test.tsx`

**Interfaces:**
- Consumes: `domainCandidates` (Task 2)
- Produces: `<BoardIcon domain={string} name={string} />`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/components/jobs/BoardIcon.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BoardIcon } from "./BoardIcon";

describe("BoardIcon", () => {
  it("demande le favicon du domaine le plus précis d'abord", () => {
    render(<BoardIcon domain="candidat.francetravail.fr" name="France Travail" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src", expect.stringContaining("domain=candidat.francetravail.fr"));
  });

  it("descend d'un label quand le favicon échoue", () => {
    render(<BoardIcon domain="candidat.francetravail.fr" name="France Travail" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src", expect.stringContaining("domain=francetravail.fr"));
  });

  it("retombe sur l'initiale une fois la cascade épuisée", () => {
    render(<BoardIcon domain="acme.fr" name="Acme Jobs" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("affiche directement l'initiale sans domaine exploitable", () => {
    render(<BoardIcon domain="" name="Acme Jobs" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("affiche « ? » quand même le nom est vide", () => {
    render(<BoardIcon domain="" name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/components/jobs/BoardIcon.test.tsx`
Expected: FAIL — `Failed to resolve import "./BoardIcon"`.

- [ ] **Step 3: Écrire `BoardIcon.tsx`**

Créer `web/src/components/jobs/BoardIcon.tsx` :

```tsx
"use client";

import { useState } from "react";
import { domainCandidates } from "@/lib/jobs/board";

/**
 * Favicon du jobboard où l'offre est publiée (LinkedIn, Indeed, France Travail…).
 *
 * Le service de favicons échoue sur certains sous-domaines et renvoie alors un
 * globe générique **en HTTP 404** : le navigateur déclenche `onError`, ce qui
 * fait avancer la cascade. Ne jamais se fier à l'absence d'image pour détecter
 * l'échec — il y a toujours une image dans le corps de la réponse.
 *
 * Compromis assumé (cf. spec §5.3.1) : le service reçoit le domaine de chaque
 * offre affichée, donc Google apprend quels jobboards sont consultés.
 */
export function BoardIcon({ domain, name }: { domain: string; name: string }) {
  const candidates = domainCandidates(domain);
  const [step, setStep] = useState(0);
  const current = candidates[step];

  if (!current) {
    return (
      <span className="job-src" title={name || undefined}>
        <span className="job-src__initial">{name.trim().charAt(0).toUpperCase() || "?"}</span>
      </span>
    );
  }

  return (
    <span className="job-src" title={name ? `Publiée sur ${name}` : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(current)}&sz=64`}
        alt={name || "Jobboard"}
        onError={() => setStep((s) => s + 1)}
      />
    </span>
  );
}
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/components/jobs/BoardIcon.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/jobs/BoardIcon.tsx web/src/components/jobs/BoardIcon.test.tsx
git commit -m "feat(jobs): BoardIcon — favicon du jobboard avec cascade

Le repli se déclenche sur onError, jamais sur l'absence d'image : un
domaine inconnu reçoit un globe générique en 404, donc il y a toujours
une image dans la réponse."
```

---

### Task 11: Refonte de la carte d'offre

Reproduit `docs/design/jobs/page-light.html` : deux actions visibles au lieu de cinq, faits en pastilles sur une ligne, description repliable, pastille du jobboard en pied.

**Files:**
- Modify: `web/src/components/jobs/JobCard.tsx` (réécriture complète)
- Create: `web/src/components/jobs/JobCard.test.tsx`
- Modify: `web/src/app/globals.css` (styles de la nouvelle carte)

**Interfaces:**
- Consumes: `JobEntry` (Task 9), `BoardIcon` (Task 10)
- Produces: `<JobCard job onAdapt onApply onTrack onDismiss onSeen />` (mêmes props qu'avant)

- [ ] **Step 1: Écrire les tests**

Créer `web/src/components/jobs/JobCard.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import JobCard from "./JobCard";
import type { JobEntry } from "@/lib/storage/db";

const base: JobEntry = {
  id: "1", createdAt: 0, title: "Webmaster F/H", company: "ACME",
  location: "Paris", commute: "28 min en transport", score: 91,
  url: "https://ex.fr/1", jobText: "Une description", status: "new", seen: false,
  source: "jsearch", logoUrl: "", boardDomain: "fr.linkedin.com", boardName: "LinkedIn",
  contractLabel: "CDI · Plein temps", salaryLabel: "33–36 k€ / an",
};

const noop = () => {};
const handlers = { onAdapt: noop, onApply: noop, onTrack: noop, onDismiss: noop, onSeen: noop };

describe("JobCard", () => {
  it("affiche titre, entreprise, score et faits", () => {
    render(<JobCard job={base} {...handlers} />);
    expect(screen.getByText("Webmaster F/H")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("CDI · Plein temps")).toBeInTheDocument();
    expect(screen.getByText("33–36 k€ / an")).toBeInTheDocument();
  });

  it("dit explicitement ce qui est inconnu", () => {
    render(<JobCard job={{ ...base, contractLabel: "", salaryLabel: "" }} {...handlers} />);
    expect(screen.getByText("Type non précisé")).toBeInTheDocument();
    expect(screen.getByText("Salaire non précisé")).toBeInTheDocument();
  });

  it("affiche le logo d'entreprise quand il existe, sinon l'initiale", () => {
    const { rerender } = render(<JobCard job={{ ...base, logoUrl: "https://l/acme.png" }} {...handlers} />);
    expect(screen.getByAltText("ACME")).toBeInTheDocument();
    rerender(<JobCard job={base} {...handlers} />);
    expect(screen.queryByAltText("ACME")).toBeNull();
    expect(screen.getByTestId("job-logo-initial")).toHaveTextContent("A");
  });

  it("n'expose que deux actions, le reste dans le menu", () => {
    render(<JobCard job={base} {...handlers} />);
    expect(screen.getByTestId("job-adapt")).toBeInTheDocument();
    expect(screen.getByText("Voir l'offre")).toBeInTheDocument();
    expect(screen.queryByTestId("job-apply")).toBeNull();
    fireEvent.click(screen.getByTestId("job-menu-toggle"));
    expect(screen.getByTestId("job-apply")).toBeInTheDocument();
    expect(screen.getByTestId("job-track")).toBeInTheDocument();
    expect(screen.getByTestId("job-dismiss")).toBeInTheDocument();
  });

  it("déclenche l'action principale", () => {
    const onAdapt = vi.fn();
    render(<JobCard job={base} {...handlers} onAdapt={onAdapt} />);
    fireEvent.click(screen.getByTestId("job-adapt"));
    expect(onAdapt).toHaveBeenCalledWith(base);
  });

  it("déplie la description", () => {
    render(<JobCard job={base} {...handlers} />);
    const card = screen.getByTestId("job-card");
    expect(card.className).not.toContain("is-open");
    fireEvent.click(screen.getByText("Voir plus"));
    expect(screen.getByTestId("job-card").className).toContain("is-open");
    expect(screen.getByText("Voir moins")).toBeInTheDocument();
  });

  it("marque une offre déjà suivie", () => {
    render(<JobCard job={{ ...base, applicationId: "app-1" }} {...handlers} />);
    fireEvent.click(screen.getByTestId("job-menu-toggle"));
    expect(screen.getByTestId("job-track")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/components/jobs/JobCard.test.tsx`
Expected: FAIL — `job-menu-toggle` introuvable, `job-apply` présent d'emblée.

- [ ] **Step 3: Réécrire `JobCard.tsx`**

Remplacer entièrement `web/src/components/jobs/JobCard.tsx` :

```tsx
"use client";

import { useState } from "react";
import type { JobEntry } from "@/lib/storage/db";
import { BoardIcon } from "./BoardIcon";

/** Date de publication relative (« il y a 4 jours ») ou null si absente/invalide. */
function relativeDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }} />
  );
}

const PIN = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>';
const CASE = '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>';
const EURO = '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>';
const TRAIN = '<rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 11h16M8 21l2-3m6 3-2-3"/>';

/**
 * Carte d'une offre retenue. Deux actions visibles seulement — « Adapter mon CV »
 * et « Voir l'offre » — le reste dans le menu « ⋯ » : cinq boutons par carte
 * rendaient la grille illisible (cf. spec §5.3).
 */
export default function JobCard({
  job, onAdapt, onApply, onTrack, onDismiss, onSeen,
}: {
  job: JobEntry;
  onAdapt: (job: JobEntry) => void;
  onApply: (job: JobEntry) => void;
  onTrack: (job: JobEntry) => void;
  onDismiss: (job: JobEntry) => void;
  onSeen: (job: JobEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const tier = job.score >= 85 ? "high" : job.score >= 70 ? "mid" : "low";
  const date = relativeDate(job.publishedAt);

  return (
    <article className={`job-card${open ? " is-open" : ""}`} data-testid="job-card">
      <div className="job-card__head">
        <div className="job-logo">
          {job.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.logoUrl} alt={job.company || "Entreprise"} />
          ) : (
            <span className="job-logo__initial" data-testid="job-logo-initial">
              {job.company.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </div>

        <div className="job-card__id">
          <h2 className="job-title">{job.title || "Sans titre"}</h2>
          <div className="job-company">
            <span className="job-company__name">{job.company || "Entreprise inconnue"}</span>
          </div>
        </div>

        <div className="job-card__aside">
          <span className={`job-score job-score--${tier}`} title="Score de pertinence">
            <span className="job-score__num">{job.score}</span>
            <span className="job-score__max">/100</span>
          </span>
          {job.seen === false ? (
            <span className="job-new" data-testid="job-new">Nouveau</span>
          ) : date ? (
            <span className="job-date">{date}</span>
          ) : null}
        </div>
      </div>

      <div className="job-facts">
        <span className="job-fact"><Icon path={PIN} />{job.location || "Lieu non précisé"}</span>
        <span className={`job-fact${job.contractLabel ? "" : " job-fact--none"}`}>
          <Icon path={CASE} />{job.contractLabel || "Type non précisé"}
        </span>
        <span className={`job-fact${job.salaryLabel ? "" : " job-fact--none"}`}>
          <Icon path={EURO} />{job.salaryLabel || "Salaire non précisé"}
        </span>
        {job.commute ? (
          <span className="job-fact job-fact--commute"><Icon path={TRAIN} />{job.commute}</span>
        ) : null}
      </div>

      {job.jobText ? (
        <>
          <p className="job-desc">{job.jobText}</p>
          <button type="button" className="job-more" onClick={() => setOpen((o) => !o)}>
            {open ? "Voir moins" : "Voir plus"}
          </button>
        </>
      ) : null}

      {menu ? (
        <div className="job-menu">
          <button type="button" className="job-menu__item" data-testid="job-apply"
            onClick={() => { setMenu(false); onApply(job); }}>
            Candidater (CV + lettre)
          </button>
          <button type="button" className="job-menu__item" data-testid="job-track"
            disabled={Boolean(job.applicationId)}
            title={job.applicationId ? "Déjà suivie dans Mes candidatures" : "Suivre cette candidature"}
            onClick={() => { setMenu(false); onTrack(job); }}>
            {job.applicationId ? "Déjà suivie" : "Suivre cette candidature"}
          </button>
          <div className="job-menu__sep" />
          <button type="button" className="job-menu__item job-menu__item--danger" data-testid="job-dismiss"
            onClick={() => { setMenu(false); onDismiss(job); }}>
            Pas intéressé
          </button>
        </div>
      ) : null}

      <div className="job-card__foot">
        <BoardIcon domain={job.boardDomain ?? ""} name={job.boardName ?? ""} />
        <button type="button" className="job-cta" data-testid="job-adapt" onClick={() => onAdapt(job)}>
          Adapter mon CV
        </button>
        <div className="job-card__foot-spacer" />
        {job.url ? (
          <a className="job-ghost" href={job.url} target="_blank" rel="noopener noreferrer"
            onClick={() => onSeen(job)}>
            Voir l&apos;offre
          </a>
        ) : null}
        <button type="button" className="job-kebab" data-testid="job-menu-toggle"
          aria-label="Plus d'actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Ajouter les styles**

Ajouter à la fin de `web/src/app/globals.css` (les tokens utilisés existent déjà) :

```css
/* ---------------------------------------------------------------------------
   Offres — carte remaniée (cf. docs/design/jobs/). Deux actions visibles,
   grille deux colonnes, faits en pastilles. Les anciennes règles .job-card /
   .job-score / .job-actions plus haut dans ce fichier sont remplacées par
   celles-ci, qui viennent après et gagnent donc en cascade.
   --------------------------------------------------------------------------- */
.jobs-list {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;
}
@media (max-width: 900px) { .jobs-list { grid-template-columns: 1fr; } }

.job-card {
  background: var(--bg); box-shadow: var(--neu-raised-sm); border-radius: 16px;
  padding: 16px 18px; display: flex; flex-direction: column;
  transition: box-shadow 150ms, transform 150ms; position: relative; min-width: 0;
}
.job-card:hover { box-shadow: var(--neu-raised); transform: translateY(-1px); }

.job-card__head { display: flex; gap: 12px; align-items: flex-start; }
.job-logo {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  background: var(--field); box-shadow: var(--neu-inset);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.job-logo img { width: 100%; height: 100%; object-fit: contain; padding: 6px; }
/* Tuile claire en thème sombre : les logos d'entreprise sont presque toujours
   de l'encre sombre sur fond transparent et disparaîtraient sinon. */
[data-theme="dark"] .job-logo:has(img) { background: #F2EFEA; }
.job-logo__initial { font-size: 17px; font-weight: 800; color: var(--faint); letter-spacing: -0.5px; }

.job-card__id { min-width: 0; flex: 1; }
.job-title {
  font-size: 14.5px; font-weight: 700; color: var(--text); line-height: 1.35; margin: 0 0 3px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.job-company { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 6px; min-width: 0; }
.job-company__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.job-card__aside { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.job-score {
  display: inline-flex; align-items: baseline; gap: 1px; padding: 4px 10px; border-radius: 999px;
  background: var(--bg); box-shadow: var(--neu-raised-sm); font-weight: 800; letter-spacing: -0.3px;
}
.job-score__num { font-size: 14px; }
.job-score__max { font-size: 9.5px; color: var(--faint); font-weight: 600; }
.job-score--high { color: var(--apply-text); box-shadow: var(--neu-raised-sm), 0 0 0 1px var(--apply); }
.job-score--mid { color: var(--orange-text); }
.job-score--low { color: var(--muted); }
.job-date { font-size: 11px; color: var(--faint); white-space: nowrap; }
.job-new {
  font-size: 9px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;
  color: #fff; background: var(--cta-grad); box-shadow: var(--cta-shadow);
  padding: 2.5px 7px; border-radius: 999px;
}

.job-facts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.job-fact {
  display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted);
  background: var(--bg); box-shadow: var(--neu-raised-sm);
  padding: 4px 10px; border-radius: 999px; white-space: nowrap;
}
.job-fact svg { color: var(--faint); flex-shrink: 0; }
.job-fact--none { color: var(--faint); }
.job-fact--commute { color: var(--apply-text); }

.job-desc {
  font-size: 12.5px; line-height: 1.6; color: var(--muted); margin: 12px 0 0;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.job-card.is-open .job-desc { -webkit-line-clamp: unset; display: block; }
.job-more {
  background: none; border: none; padding: 6px 0 0; cursor: pointer;
  font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--link);
  align-self: flex-start;
}
.job-more:hover { text-decoration: underline; }

.job-card__foot {
  display: flex; align-items: center; gap: 8px;
  margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--border);
}
.job-card__foot-spacer { flex: 1 1 auto; }

/* Pastille du jobboard : favicon dérivé du domaine (cf. BoardIcon). */
.job-src {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  background: var(--field); box-shadow: var(--neu-inset);
  display: inline-flex; align-items: center; justify-content: center; overflow: hidden;
}
.job-src img { width: 15px; height: 15px; object-fit: contain; display: block; }
.job-src__initial { font-size: 10px; font-weight: 800; color: var(--faint); }
[data-theme="dark"] .job-src { background: #F2EFEA; box-shadow: none; }

.job-cta {
  background: var(--cta-grad); color: #fff; border: none;
  font-family: var(--font-ui); font-size: 12.5px; font-weight: 600;
  height: 34px; padding: 0 15px; border-radius: 10px; cursor: pointer;
  box-shadow: var(--cta-shadow); display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
}
.job-cta:hover { transform: translateY(-1px); }
.job-ghost {
  background: var(--bg); border: none; color: var(--muted);
  font-family: var(--font-ui); font-size: 12.5px; font-weight: 600;
  height: 34px; padding: 0 13px; border-radius: 10px; cursor: pointer;
  box-shadow: var(--neu-raised-sm); display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap; text-decoration: none;
}
.job-ghost:hover { color: var(--text); box-shadow: var(--neu-raised); }
.job-kebab {
  background: var(--bg); border: none; color: var(--muted);
  width: 34px; height: 34px; border-radius: 10px; cursor: pointer;
  box-shadow: var(--neu-raised-sm); display: inline-flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}
.job-kebab:hover { color: var(--text); box-shadow: var(--neu-raised); }

.job-menu {
  position: absolute; right: 18px; bottom: 58px; z-index: 5;
  background: var(--glass); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border); border-radius: 13px;
  box-shadow: var(--neu-raised-lg); padding: 5px; min-width: 178px;
  display: flex; flex-direction: column; gap: 1px;
}
.job-menu__item {
  background: none; border: none; text-align: left; cursor: pointer;
  font-family: var(--font-ui); font-size: 12.5px; font-weight: 600; color: var(--text);
  padding: 9px 11px; border-radius: 9px; display: flex; align-items: center; gap: 9px;
}
.job-menu__item:hover:not(:disabled) { background: var(--card); }
.job-menu__item:disabled { color: var(--faint); cursor: default; }
.job-menu__item--danger { color: var(--error); }
.job-menu__sep { height: 1px; background: var(--border); margin: 4px 6px; }
```

- [ ] **Step 5: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/components/jobs/JobCard.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 6: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/jobs/JobCard.tsx web/src/components/jobs/JobCard.test.tsx web/src/app/globals.css
git commit -m "feat(jobs): carte d'offre allégée, deux actions visibles

Cinq boutons par carte rendaient la grille illisible. Reste visible
« Adapter mon CV » et « Voir l'offre » ; Candidater, Suivre et Pas
intéressé passent dans le menu « ⋯ ». Grille deux colonnes, faits en
pastilles, description repliable, pastille du jobboard en pied."
```

---

### Task 12: Sélecteur de sources dans le formulaire de critères

**Files:**
- Create: `web/src/components/jobs/SourcePicker.tsx`
- Create: `web/src/components/jobs/SourcePicker.test.tsx`
- Modify: `web/src/components/jobs/ProfileForm.tsx` (monter le sélecteur, corriger le sous-titre)
- Modify: `web/src/app/globals.css` (styles du sélecteur)

**Interfaces:**
- Consumes: `SOURCES` (Task 3), `getApiUsage` (Task 9), `BoardIcon` (Task 10)
- Produces: `<SourcePicker value={SourceToggles} onChange usage={Record<SourceId, number>} />`

- [ ] **Step 1: Écrire les tests**

Créer `web/src/components/jobs/SourcePicker.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SourcePicker } from "./SourcePicker";

const value = { francetravail: true, adzuna: false, jsearch: false };
const usage = { francetravail: 0, adzuna: 947, jsearch: 183 };

describe("SourcePicker", () => {
  it("affiche les trois sources", () => {
    render(<SourcePicker value={value} onChange={() => {}} usage={usage} />);
    expect(screen.getByLabelText(/France Travail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Google for Jobs/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adzuna/)).toBeInTheDocument();
  });

  it("montre le quota consommé, « illimité » pour France Travail", () => {
    render(<SourcePicker value={value} onChange={() => {}} usage={usage} />);
    expect(screen.getByText("illimité")).toBeInTheDocument();
    expect(screen.getByText("183/200 ce mois")).toBeInTheDocument();
    expect(screen.getByText("947/1000 ce mois")).toBeInTheDocument();
  });

  it("bascule une source", () => {
    const onChange = vi.fn();
    render(<SourcePicker value={value} onChange={onChange} usage={usage} />);
    fireEvent.click(screen.getByLabelText(/Adzuna/));
    expect(onChange).toHaveBeenCalledWith({ francetravail: true, adzuna: true, jsearch: false });
  });

  it("reflète l'état coché", () => {
    render(<SourcePicker value={value} onChange={() => {}} usage={usage} />);
    expect(screen.getByLabelText(/France Travail/)).toBeChecked();
    expect(screen.getByLabelText(/Adzuna/)).not.toBeChecked();
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `cd web && npx vitest run src/components/jobs/SourcePicker.test.tsx`
Expected: FAIL — `Failed to resolve import "./SourcePicker"`.

- [ ] **Step 3: Écrire `SourcePicker.tsx`**

Créer `web/src/components/jobs/SourcePicker.tsx` :

```tsx
"use client";

import { SOURCES, type SourceToggles } from "@/lib/jobs/sources";
import type { SourceId } from "@/lib/jobs/offer";
import { BoardIcon } from "./BoardIcon";

/** Domaine de chaque source, pour afficher son favicon (aucun logo stocké). */
const SOURCE_DOMAIN: Record<SourceId, string> = {
  francetravail: "francetravail.fr",
  jsearch: "google.com",
  adzuna: "adzuna.fr",
};

/**
 * Choix des sources à interroger. Vit dans le panneau « Mes critères », replié
 * par défaut : rien n'est ajouté à l'écran principal (cf. spec §5.2).
 *
 * Décocher une source signifie **ne pas l'interroger** — pas masquer ses
 * résultats : c'est la seule sémantique qui préserve réellement le quota.
 */
export function SourcePicker({
  value, onChange, usage,
}: {
  value: SourceToggles;
  onChange: (v: SourceToggles) => void;
  usage: Record<SourceId, number>;
}) {
  return (
    <div className="jf-sources">
      <span className="jf-label">Où chercher</span>
      <div className="jf-sources-row">
        {SOURCES.map((s) => (
          <label key={s.id} className={`jf-source ${value[s.id] ? "is-on" : ""}`}>
            <input
              type="checkbox"
              checked={value[s.id]}
              aria-label={s.label}
              onChange={() => onChange({ ...value, [s.id]: !value[s.id] })}
            />
            <BoardIcon domain={SOURCE_DOMAIN[s.id]} name={s.label} />
            <span className="jf-source-name">{s.label}</span>
            <span className="jf-source-quota">
              {s.monthlyQuota == null ? "illimité" : `${usage[s.id]}/${s.monthlyQuota} ce mois`}
            </span>
          </label>
        ))}
      </div>
      <p className="jf-note">
        Décocher une source, c&apos;est ne pas l&apos;interroger — le quota mensuel est préservé.
        Ce compteur mesure ce que ce navigateur a consommé, il est indicatif.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Ajouter les styles**

Ajouter à la fin de `web/src/app/globals.css` :

```css
/* ---- Choix des sources (dans le panneau de critères) ---- */
.jf-sources { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
.jf-sources-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.jf-source {
  display: inline-flex; align-items: center; gap: 9px; cursor: pointer;
  background: var(--bg); box-shadow: var(--neu-raised-sm);
  border-radius: 12px; padding: 8px 14px 8px 11px; transition: box-shadow 120ms;
}
.jf-source:hover { box-shadow: var(--neu-raised); }
.jf-source.is-on { box-shadow: var(--neu-raised-sm), 0 0 0 1.5px var(--orange2); }
.jf-source input { accent-color: var(--orange); width: 15px; height: 15px; cursor: pointer; }
.jf-source-name { font-size: 12.5px; font-weight: 600; color: var(--text); }
.jf-source-quota { font-size: 10.5px; color: var(--faint); font-family: var(--font-code); }
```

- [ ] **Step 5: Monter le sélecteur dans `ProfileForm`**

Dans `web/src/components/jobs/ProfileForm.tsx` :

Ajouter les imports en tête :

```ts
import { SourcePicker } from "./SourcePicker";
import type { SourceId } from "@/lib/jobs/offer";
```

Ajouter `usage` aux props du composant :

```tsx
export function ProfileForm({
  profile,
  onChange,
  usage,
}: {
  profile: JobSearchProfile;
  onChange: (p: JobSearchProfile) => void;
  usage: Record<SourceId, number>;
}) {
```

Corriger le sous-titre, qui ne parle que de France Travail (`jf-hint`, ligne ~82) :

```tsx
        <p className="jf-hint">Ces critères pilotent la recherche sur les sources choisies et le tri des offres.</p>
```

Puis insérer le sélecteur juste après la fermeture du bloc `<div className="jf-primary">` (donc avant `{/* Filtres rapides */}`) :

```tsx
      <SourcePicker value={profile.sources} onChange={(s) => set("sources", s)} usage={usage} />
```

- [ ] **Step 6: Lancer les tests pour les voir passer**

Run: `cd web && npx vitest run src/components/jobs/SourcePicker.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 7: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: `npm run build` échoue tant que `JobsView` ne passe pas `usage` à `ProfileForm` — c'est corrigé en Task 13. Si le build échoue **uniquement** sur cette prop manquante, passer à l'étape suivante ; toute autre erreur doit être corrigée ici.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/jobs/SourcePicker.tsx web/src/components/jobs/SourcePicker.test.tsx web/src/components/jobs/ProfileForm.tsx web/src/app/globals.css
git commit -m "feat(jobs): sélecteur de sources dans le panneau de critères

Les trois cases vivent dans le panneau replié : rien n'est ajouté à
l'écran principal. Chacune affiche son quota consommé — le compteur est
local et indicatif, ce que dit la note sous les cases."
```

---

### Task 13: Orchestration côté vue

Trois choses ici, indissociables : persister les nouveaux champs d'offre (sans quoi la carte de la Task 11 n'a rien à afficher après rechargement), afficher le résumé des critères de l'écran principal (spec §5.1), et brancher quota + sources en panne.

**Files:**
- Create: `web/src/lib/jobs/summary.ts`
- Create: `web/src/lib/jobs/summary.test.ts`
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: `getApiUsage`, `bumpApiUsage` (Task 9), `SOURCES` (Task 3), `ProfileForm` (Task 12)
- Produces: `summarizeProfile(profile): string[]`

- [ ] **Step 1: Écrire le test du résumé de critères**

Créer `web/src/lib/jobs/summary.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { summarizeProfile } from "./summary";
import { parseProfile } from "./profileSchema";

describe("summarizeProfile", () => {
  it("liste postes, lieu avec rayon et contrats", () => {
    const p = parseProfile({
      keywords: ["Webmaster", "Intégrateur web"],
      location: { kind: "commune", code: "75056", label: "Paris (75001)", radiusKm: 20 },
      contractTypes: ["CDI", "CDD"],
    });
    expect(summarizeProfile(p)).toEqual(["Webmaster", "Intégrateur web", "Paris + 20 km", "CDI, CDD"]);
  });

  it("omet le rayon hors commune", () => {
    const p = parseProfile({
      keywords: ["Webmaster"],
      location: { kind: "region", code: "11", label: "Île-de-France", radiusKm: 20 },
      contractTypes: ["CDI"],
    });
    expect(summarizeProfile(p)).toEqual(["Webmaster", "Île-de-France", "CDI"]);
  });

  it("annonce une recherche nationale sans lieu", () => {
    const p = parseProfile({ keywords: ["Webmaster"], location: { kind: "commune", code: "", label: "", radiusKm: 10 }, contractTypes: [] });
    expect(summarizeProfile(p)).toEqual(["Webmaster", "Toute la France"]);
  });

  it("invite à renseigner un poste quand il n'y en a pas", () => {
    const p = parseProfile({ keywords: [], contractTypes: [] });
    expect(summarizeProfile(p)).toEqual(["Aucun poste renseigné", "Toute la France"]);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/summary.test.ts`
Expected: FAIL — `Failed to resolve import "./summary"`.

- [ ] **Step 3: Écrire `summary.ts`**

Créer `web/src/lib/jobs/summary.ts` :

```ts
import type { JobSearchProfile } from "./profile";

/**
 * Résumé des critères actifs, affiché en une ligne sur l'écran principal.
 * Il rend le panneau inutile en usage courant : on voit ses réglages sans
 * avoir à les ouvrir (cf. spec §5.1).
 */
export function summarizeProfile(p: JobSearchProfile): string[] {
  const parts: string[] = [];

  if (p.keywords.length > 0) parts.push(...p.keywords);
  else parts.push("Aucun poste renseigné");

  if (p.location.label) {
    // Le rayon n'a de sens que pour une commune (cf. LocationFilter).
    parts.push(p.location.kind === "commune" ? `${p.location.label} + ${p.location.radiusKm} km` : p.location.label);
  } else {
    parts.push("Toute la France");
  }

  if (p.contractTypes.length > 0) parts.push(p.contractTypes.join(", "));
  return parts;
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/lib/jobs/summary.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Persister les nouveaux champs d'offre**

Dans `web/src/components/jobs/JobsView.tsx`, l'appel `saveJob` du worker de notation ignore encore les champs ajoutés en Task 9 : sans eux, la carte perd logo, contrat, salaire et jobboard au premier rechargement. Remplacer l'appel :

```ts
            await saveJob({
              id: offer.id,
              createdAt: Date.now(),
              title: offer.title,
              company: offer.company,
              location: offer.location,
              commute: d.commuteText ?? "",
              score: d.score,
              url: offer.url,
              jobText: offer.jobText,
              publishedAt: offer.publishedAt,
              status: "new",
              seen: false,
              source: offer.source,
              logoUrl: offer.logoUrl,
              boardDomain: offer.boardDomain,
              boardName: offer.boardName,
              contractLabel: offer.contractLabel,
              salaryLabel: offer.salaryLabel,
            });
```

- [ ] **Step 6: Charger et rafraîchir le compteur de quota**

Dans `web/src/components/jobs/JobsView.tsx`, ajouter les imports :

```ts
import { getApiUsage, bumpApiUsage } from "@/lib/storage/db";
import type { SourceId } from "@/lib/jobs/offer";
import { SOURCES } from "@/lib/jobs/sources";
import { summarizeProfile } from "@/lib/jobs/summary";
```

Ajouter l'état, après `const [configMsg, setConfigMsg] = useState<string | null>(null);` :

```ts
  const [usage, setUsage] = useState<Record<SourceId, number>>({ francetravail: 0, adzuna: 0, jsearch: 0 });
```

Dans le `useEffect` de montage, ajouter le chargement :

```ts
    getApiUsage().then(setUsage);
```

- [ ] **Step 7: Consommer `calls` et `failed` après une recherche**

Dans `scan`, juste après `const offers: JobOffer[] = data.offers ?? [];`, insérer :

```ts
      // Compteur de quota : local et indicatif, il mesure ce que CE navigateur
      // a consommé, pas ce que le fournisseur a facturé.
      if (data.calls) {
        await bumpApiUsage(data.calls);
        setUsage(await getApiUsage());
      }

      // Une source en panne ne fait pas échouer la recherche : on le dit sans bloquer.
      const failed: SourceId[] = data.failed ?? [];
      if (failed.length > 0) {
        const names = failed.map((s) => SOURCES.find((x) => x.id === s)?.label ?? s).join(", ");
        toast(`Source(s) indisponible(s) : ${names}. Les autres résultats sont affichés.`, "error");
      }
```

- [ ] **Step 8: Passer `usage` au formulaire et afficher le résumé des critères**

Remplacer le bloc `jobs-form-bar` et la ligne de rendu du formulaire par :

```tsx
      <div className="jobs-form-bar">
        <button
          type="button"
          className="ghost jobs-form-toggle"
          onClick={() => setShowForm((s) => !s)}
          aria-expanded={showForm}
        >
          {showForm ? "Masquer les critères" : "Mes critères"}
        </button>
        {/* Le résumé rend le panneau inutile en usage courant : on voit ses
            réglages sans avoir à les ouvrir (cf. spec §5.1). */}
        <div className="jobs-summary">
          {summarizeProfile(profile).map((part, i) => (
            <span key={`${part}-${i}`}>
              {i > 0 && <span className="jobs-summary__dot">•</span>}
              {part}
            </span>
          ))}
        </div>
      </div>

      {showForm && <ProfileForm profile={profile} onChange={updateProfile} usage={usage} />}
```

Ajouter les styles à la fin de `web/src/app/globals.css` :

```css
/* ---- Résumé des critères, sur l'écran principal ---- */
.jobs-form-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.jobs-summary {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  font-size: 12px; color: var(--muted); min-width: 0;
}
.jobs-summary__dot { color: var(--faint); margin-right: 7px; }
```

- [ ] **Step 9: Corriger le message de configuration**

Le bloc `configMsg` cite en dur les variables France Travail. Remplacer le paragraphe d'aide :

```tsx
        <p className="jobs-config-hint">
          Renseigne les variables d&apos;environnement des sources que tu as cochées dans
          « Mes critères de recherche ».
        </p>
```

- [ ] **Step 10: Vérifier tests, lint et types**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout au vert, y compris le build (la prop `usage` manquante de la Task 12 est maintenant fournie).

- [ ] **Step 11: Commit**

```bash
git add web/src/lib/jobs/summary.ts web/src/lib/jobs/summary.test.ts web/src/components/jobs/JobsView.tsx web/src/app/globals.css
git commit -m "feat(jobs): résumé des critères, quota et sources en panne

Persiste les champs d'offre ajoutés en v9 : sans eux la carte perdait
logo, contrat, salaire et jobboard au premier rechargement. Ajoute le
résumé de critères qui rend le panneau inutile en usage courant,
incrémente le compteur de quota local et signale sans bloquer les
sources indisponibles."
```

---

### Task 14: Vérification bout en bout et documentation

**Files:**
- Modify: `PROJECT_INDEX.md`
- Modify: `WORK_HISTORY.md`

- [ ] **Step 1: Lancer la suite complète**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tous les tests passent, 0 erreur ESLint, build « Compiled successfully ». Lire réellement la sortie — ne rien déclarer sans l'avoir vue.

- [ ] **Step 2: Vérifier dans le navigateur**

Démarrer l'aperçu avec la configuration `web-dev` (`preview_start`, jamais `npm run dev` via le terminal), puis sur `/jobs` :

1. Ouvrir « Mes critères » → les trois sources apparaissent, France Travail seule cochée.
2. Cocher Google for Jobs et Adzuna, renseigner un poste (ex. « Webmaster ») et un lieu (ex. Paris).
3. Lancer la recherche. Vérifier dans l'onglet réseau qu'il part bien un appel vers chaque source cochée, et **aucun** vers une source décochée (critère de succès n° 2).
4. Sur les cartes : logos d'entreprise présents pour une partie des offres, initiale pour les autres ; pastille de jobboard en pied ; « Voir plus » déplie ; le menu « ⋯ » expose Candidater / Suivre / Pas intéressé.
5. Rouvrir « Mes critères » : les compteurs de quota ont augmenté.
6. Basculer en thème sombre : logos et favicons restent lisibles.

- [ ] **Step 3: Consigner les captures dans le rapport**

Prendre une capture de la liste d'offres en thème clair et une en thème sombre, et les joindre au rapport de fin. Si un point de l'étape 2 échoue, le corriger avant de continuer — ne pas passer à la documentation.

- [ ] **Step 4: Mettre à jour `PROJECT_INDEX.md`**

Dans la section décrivant la recherche d'offres, remplacer toute mention d'une source unique par :

```markdown
La recherche interroge trois sources au choix de l'utilisateur : **France Travail**
(illimité), **Adzuna** (1 000 appels/mois) et **JSearch / Google for Jobs**
(200 appels/mois, seule source à fournir un logo d'entreprise et le jobboard réel).
Un module par source dans `web/src/lib/jobs/` expose `search(profile, creds)` et
renvoie des `JobOffer` (`web/src/lib/jobs/offer.ts`). `/api/jobs/search` les appelle
en parallèle, fusionne, dédoublonne par `normKey` (`dedupe.ts`), puis le pipeline
existant prend le relais. Le plafond `aiShortlist` s'applique au pool fusionné :
ajouter des sources n'augmente pas le coût IA.

Pièges :
- Décocher une source signifie **ne pas l'interroger**, pas masquer ses résultats.
- Le favicon du jobboard passe par une **cascade de domaines** (`board.ts`) : le
  service échoue sur certains sous-domaines et renvoie un globe générique **en
  HTTP 404**, donc le repli doit se déclencher sur l'erreur de chargement.
- Le compteur de quota (table Dexie `apiUsage`) est **local et indicatif**.
```

- [ ] **Step 5: Ajouter l'entrée de journal**

Ajouter en tête du Journal de `WORK_HISTORY.md` une entrée datée du jour décrivant : les trois sources, le contrat `search()` commun, le dédoublonnage inter-source avant tout appel IA, la carte allégée à deux actions, la cascade de favicon et le compteur de quota local. Mentionner que la maquette de référence est `docs/design/jobs/` et qu'elle a été bâtie sur des données d'API réelles.

- [ ] **Step 6: Commit**

```bash
git add PROJECT_INDEX.md WORK_HISTORY.md
git commit -m "docs: sources d'offres multi-plateformes dans l'index et le journal"
```

---

## Récapitulatif des critères de succès

| Critère (spec §2) | Vérifié par |
|---|---|
| 1. Offres des trois sources dans une seule liste triée | Task 8 (dédoublonnage inter-source) + Task 14 étape 2 |
| 2. Décocher une source = aucun appel réseau | Task 8 (« n'interroge que les sources activées ») + Task 14 étape 2.3 |
| 3. Appels IA plafonnés à `aiShortlist` | Pipeline `JobsView` inchangé, appliqué au pool fusionné — à confirmer en Task 14 étape 2 (le compteur « X notées » ne dépasse jamais `aiShortlist`) |
| 4. Panne d'une source sans effet sur les autres | Task 8 (« une source en échec n'empêche pas les autres ») |
| 5. Même offre sur deux sources = une carte | Task 7 (`dedupe.test.ts`) + Task 8 (« dédoublonne entre sources ») |

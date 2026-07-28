# Classement des offres en lettres (S/A/B/C/D) — Plan d'implémentation

> **Pour les agents d'exécution :** ce plan se lit avec `web/CADRAGE_EXECUTION.md`
> (le contrat, qui prime en cas de conflit) et
> `docs/superpowers/specs/2026-07-28-notation-lettres-design.md` (la spec, qui
> justifie chaque choix par une mesure réelle).
> Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**But :** remplacer la notation IA sur 100 (Gemini, 30-50 s et gros quota par
scan) par un classement S/A/B/C/D calculé localement, instantané et gratuit.

**Architecture :** un module de classement en fonctions pures
(`lib/jobs/rank/`) note chaque offre sur 100 à partir de deux voies — les champs
structurés que France Travail fournit déjà (code métier officiel, compétences
codifiées) et l'analyse du texte de l'annonce pour toutes les sources. Le score
est traduit en lettre par des seuils réglables. Aucun appel réseau entre la
recherche et l'affichage.

**Stack :** TypeScript strict, Vitest, Dexie/IndexedDB, Next.js 16 (App Router).
Aucune dépendance npm nouvelle.

## Contraintes globales

Ces règles s'appliquent à **toutes** les tâches, sans être répétées à chaque fois.

- **Aucune dépendance npm ajoutée ou mise à jour.** Tout se fait avec l'existant.
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.** TypeScript
  strict doit compiler.
- **Jamais `alert`/`confirm`/`prompt` natifs** → `uiAlert`/`uiConfirm`/`uiPrompt`/
  `toast` de `@/state/uiStore`.
- **Jamais de couleur en dur** → variables de thème dans `src/app/globals.css`.
- **PUSH STRICTEMENT INTERDIT.** Commit local par tâche uniquement. Un push
  déploie la production Vercel. ⚠️ Le cadrage mentionne la branche
  `feature/refonte-ui-nextjs` ; la branche courante est aujourd'hui `main`.
  **Travaille sur la branche courante, quelle qu'elle soit, et ne pousse pas.**
- **Journal obligatoire** après chaque tâche : entrée datée en tête de la section
  `## Journal` de `WORK_HISTORY.md` (racine) + mise à jour de la ligne
  « Prochaine étape suggérée ». Rien d'autre dans ce fichier.
- **Vérification après CHAQUE tâche**, depuis `web/`, dans cet ordre, sortie
  collée dans le rapport :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  npm run build
  ```
  `npx playwright test` en plus dès qu'une tâche touche l'UI, et en fin de plan.
- **Une vérification rouge = tâche NON LIVRÉE.** On corrige avant de continuer.
  On ne désactive jamais une règle pour passer.
- **Tu ne modifies pas un test existant pour le faire passer**, sauf quand ce plan
  l'ordonne explicitement (tâches 11 et 12 le précisent).
- **Encodage du référentiel ROME : latin-1, pas UTF-8.** Lire ce fichier en UTF-8
  lève une `UnicodeDecodeError`. Constat de la spec §2.2.

---

## Vue d'ensemble des fichiers

| Fichier | Sort |
|---|---|
| `scripts/build-rome.mjs` | **Créé** — régénère les données ROME depuis l'open data |
| `web/src/lib/jobs/data/rome-competences.json` | **Créé** — table dérivée (~835 Ko) |
| `web/src/lib/jobs/data/rome-appellations.json` | **Régénéré** — passage en ROME 4.0 |
| `web/src/lib/jobs/rome.ts` | **Créé** — cibles, voisins, compétences attendues |
| `web/src/lib/jobs/geo.ts` | **Créé** — distance à vol d'oiseau (pur) |
| `web/src/lib/jobs/grade.ts` | **Créé** — lettres et seuils. Module feuille, sans import |
| `web/src/lib/jobs/homeCoords.ts` | **Créé** — géocodage du domicile, clé de cache |
| `web/src/lib/jobs/rank/text.ts` | **Créé** — zones + saturation |
| `web/src/lib/jobs/rank/criteria.ts` | **Créé** — un critère = une fonction pure |
| `web/src/lib/jobs/rank/index.ts` | **Créé** — orchestration, lettre, `shouldPersist` |
| `web/src/lib/jobs/offer.ts` | Modifié — champs structurés optionnels |
| `web/src/lib/jobs/francetravail.ts` | Modifié — lire les champs ignorés |
| `web/src/lib/jobs/adzuna.ts` | Modifié — lire `latitude`/`longitude` |
| `web/src/lib/jobs/profile.ts` + `profileSchema.ts` | Modifiés — seuils de lettres |
| `web/src/components/jobs/MetierInput.tsx` | Modifié — conserver le code ROME |
| `web/src/lib/storage/db.ts` | Modifié — Dexie v10, caches |
| `web/src/components/jobs/JobsView.tsx` | Modifié — `scan()` réécrit |
| `web/src/components/jobs/JobCard.tsx` | Modifié — lettre + détail |
| `web/src/components/jobs/ScoringInfo.tsx` | Modifié — texte de transparence |
| `web/src/lib/jobs/score.ts` + test | **Supprimés** |
| `web/src/app/api/jobs/score/route.ts` + test | **Supprimés** |

---

## Task 1 : Script de génération des données ROME

**Files:**
- Create: `scripts/build-rome.mjs`
- Create: `web/src/lib/jobs/data/rome-competences.json` (produit par le script)
- Modify: `web/src/lib/jobs/data/rome-appellations.json` (régénéré par le script)

**Interfaces:**
- Consumes: rien.
- Produces: deux fichiers JSON consommés par la tâche 2.
  - `rome-competences.json` : `Record<string, { i: string; c: Record<string, 1|2>; v: string[] }>`
    où la clé est le code ROME, `i` l'intitulé, `c` la table `code_ogr → poids`
    (2 = cœur de métier, 1 = secondaire), `v` la liste des codes ROME voisins.
  - `rome-appellations.json` : `{ l: string; r: string }[]` (format inchangé,
    contenu régénéré en ROME 4.0).

**Contexte.** Le fichier `rome-appellations.json` actuel est en ROME 3.x : 532
codes, alors que les offres réelles portent des codes ROME 4.0 absents de ce
fichier (M1834, M1855, M1886, M1716, E1112 — vérifié, spec §2.5). Le filtre
« codes ROME » du profil est donc aujourd'hui inopérant. Ce script corrige ça et
produit en plus la table des compétences.

- [ ] **Step 1 : Écrire le script**

Créer `scripts/build-rome.mjs` :

```js
// Régénère les données ROME depuis l'open data France Travail (licence Etalab).
// Usage : node scripts/build-rome.mjs
// Produit : web/src/lib/jobs/data/rome-competences.json et rome-appellations.json
//
// ⚠️ Les JSON du ZIP sont encodés en latin-1, pas en UTF-8.
// ⚠️ Le bloc `savoirs` s'ouvre sur `categories`, les deux autres sur `enjeux`.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

const SRC = "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");

const work = join(tmpdir(), `rome-${process.pid}`);
mkdirSync(work, { recursive: true });

console.log("Téléchargement du ROME open data…");
const res = await fetch(SRC);
if (!res.ok) throw new Error(`Téléchargement échoué (${res.status}). URL changée ? Voir ${SRC}`);
const zipPath = join(work, "rome.zip");
writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));

// Décompression via l'outil système (aucune dépendance npm autorisée).
execFileSync("tar", ["-xf", zipPath, "-C", work], { stdio: "inherit" });

// Le nom du fichier porte un numéro de version (ex. _v461) : on le retrouve par motif.
const { readdirSync, readFileSync } = await import("node:fs");
const files = readdirSync(work);
const find = (frag) => {
  const f = files.find((n) => n.includes(frag) && n.endsWith(".json"));
  if (!f) throw new Error(`Fichier "${frag}" introuvable dans l'archive. Contenu : ${files.join(", ")}`);
  return join(work, f);
};

const readLatin1 = (p) => JSON.parse(readFileSync(p, "latin1"));
const fiches = readLatin1(find("fiche_emploi_metier"));

const BLOCS = [
  ["savoir_faire", "enjeux"],
  ["savoir_etre_professionnel", "enjeux"],
  ["savoirs", "categories"],
];

const table = {};
const appellations = [];

for (const f of fiches) {
  const rome = f.rome?.code_rome;
  if (!rome) continue;

  const c = {};
  for (const [bloc, cle] of BLOCS) {
    for (const grp of f.competences?.[bloc]?.[cle] ?? []) {
      for (const it of grp.items ?? []) {
        const poids = it.coeur_metier === "Principale" ? 2 : 1;
        const code = String(it.code_ogr);
        c[code] = Math.max(c[code] ?? 0, poids);
      }
    }
  }

  const v = (f.mobilites ?? [])
    .map((m) => String(m.rome_cible ?? "").split(" - ")[0])
    .filter((x) => /^[A-Z]\d{4}$/.test(x));

  table[rome] = { i: f.rome.intitule ?? "", c, v: [...new Set(v)] };

  for (const a of f.appellations ?? []) {
    if (a.libelle) appellations.push({ l: a.libelle, r: rome });
  }
}

appellations.sort((a, b) => a.l.localeCompare(b.l, "fr"));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "rome-competences.json"), JSON.stringify(table), "utf8");
writeFileSync(join(OUT_DIR, "rome-appellations.json"), JSON.stringify(appellations), "utf8");
rmSync(work, { recursive: true, force: true });

console.log(`OK — ${Object.keys(table).length} fiches ROME, ${appellations.length} appellations.`);
```

- [ ] **Step 2 : Lancer le script**

Depuis la racine du repo :

```bash
node scripts/build-rome.mjs
```

Sortie attendue, avec des nombres de cet ordre (le ROME évolue, les chiffres
exacts peuvent bouger un peu) :

```
Téléchargement du ROME open data…
OK — 1911 fiches ROME, 14301 appellations.
```

Si `tar` n'est pas disponible, utiliser `unzip -o -q <zip> -d <dir>` à la place
dans le script — Git Bash sur Windows fournit les deux.

- [ ] **Step 3 : Écrire le test de non-régression des données**

Créer `web/src/lib/jobs/data/rome-data.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import competences from "./rome-competences.json";
import appellations from "./rome-appellations.json";

const table = competences as Record<string, { i: string; c: Record<string, number>; v: string[] }>;
const appels = appellations as { l: string; r: string }[];

describe("données ROME 4.0", () => {
  // Codes relevés sur de vraies offres France Travail (spec §2.5). Ils étaient
  // absents du fichier ROME 3.x, ce qui rendait le filtre « codes ROME » inopérant.
  it("contient les codes portés par les offres réelles", () => {
    for (const code of ["M1834", "M1855", "M1886", "M1716", "E1112", "K2101"]) {
      expect(table[code], `code ${code} manquant`).toBeDefined();
    }
  });

  it("expose intitulé, compétences pondérées et voisins", () => {
    const f = table.M1855;
    expect(f.i).toMatch(/velopp/); // « Développeur / Développeuse web »
    expect(Object.keys(f.c).length).toBeGreaterThan(10);
    expect(Object.values(f.c).every((p) => p === 1 || p === 2)).toBe(true);
    expect(f.v.length).toBeGreaterThan(0);
    expect(f.v.every((r) => /^[A-Z]\d{4}$/.test(r))).toBe(true);
  });

  // Les codes de compétence des offres doivent exister au référentiel (spec §2.2).
  it("couvre les codes de compétence vus sur des offres", () => {
    const tous = new Set(Object.values(table).flatMap((f) => Object.keys(f.c)));
    expect(tous.has("100341")).toBe(true);
    expect(tous.has("300374")).toBe(true);
  });

  it("mappe les appellations vers des codes existants", () => {
    expect(appels.length).toBeGreaterThan(12000);
    for (const a of appels.slice(0, 200)) {
      expect(table[a.r], `appellation « ${a.l} » → code ${a.r} inconnu`).toBeDefined();
    }
  });
});
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/data/rome-data.test.ts
```

Attendu : 4 tests verts. S'il échoue sur l'import JSON, vérifier que
`resolveJsonModule` est actif dans `tsconfig.json` (il l'est déjà — le fichier
`rome-appellations.json` est déjà importé ailleurs).

- [ ] **Step 5 : Commit**

```bash
git add scripts/build-rome.mjs web/src/lib/jobs/data/
git commit -m "feat(offres): script de génération des données ROME 4.0

Le fichier rome-appellations.json était en ROME 3.x : aucun des codes portés
par les offres réelles (M1834, M1855, M1886…) ne s'y trouvait, rendant le
filtre « codes ROME » inopérant. Le script régénère ce fichier depuis l'open
data et produit en plus la table des compétences par métier, avec le marqueur
cœur-de-métier et la liste des métiers voisins."
```

---

## Task 2 : Module ROME

**Files:**
- Create: `web/src/lib/jobs/rome.ts`
- Test: `web/src/lib/jobs/rome.test.ts`

**Interfaces:**
- Consumes: `rome-competences.json` (tâche 1).
- Produces :
  ```ts
  export interface RomeTargets {
    cibles: Set<string>;
    voisins: Set<string>;
    attendues: Map<string, number>; // code_ogr → poids 1 ou 2
  }
  export function buildRomeTargets(romeCodes: string[]): RomeTargets
  export function romeLabel(code: string): string
  ```

- [ ] **Step 1 : Écrire le test**

Créer `web/src/lib/jobs/rome.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildRomeTargets, romeLabel } from "./rome";

describe("buildRomeTargets", () => {
  it("renvoie des ensembles vides sans code cible", () => {
    const t = buildRomeTargets([]);
    expect(t.cibles.size).toBe(0);
    expect(t.voisins.size).toBe(0);
    expect(t.attendues.size).toBe(0);
  });

  it("classe les cibles et leurs voisins officiels", () => {
    const t = buildRomeTargets(["M1855"]);
    expect(t.cibles.has("M1855")).toBe(true);
    expect(t.voisins.size).toBeGreaterThan(0);
    // Un voisin n'est jamais aussi une cible : la distinction porte le barème.
    for (const v of t.voisins) expect(t.cibles.has(v)).toBe(false);
  });

  it("agrège les compétences attendues en gardant le poids le plus fort", () => {
    const t = buildRomeTargets(["M1855", "M1886"]);
    expect(t.attendues.size).toBeGreaterThan(10);
    for (const p of t.attendues.values()) expect([1, 2]).toContain(p);
  });

  it("ignore un code inconnu sans planter", () => {
    const t = buildRomeTargets(["M1855", "ZZZZZ"]);
    expect(t.cibles.has("M1855")).toBe(true);
    expect(t.cibles.has("ZZZZZ")).toBe(true); // conservé comme cible déclarée
    expect(t.attendues.size).toBeGreaterThan(0);
  });
});

describe("romeLabel", () => {
  it("renvoie l'intitulé officiel", () => {
    expect(romeLabel("M1855")).toMatch(/velopp/);
  });

  it("renvoie le code brut si inconnu", () => {
    expect(romeLabel("ZZZZZ")).toBe("ZZZZZ");
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/rome.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./rome"`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `web/src/lib/jobs/rome.ts` :

```ts
/**
 * Accès au référentiel ROME 4.0 embarqué (`data/rome-competences.json`, généré
 * par `scripts/build-rome.mjs`).
 *
 * Le code ROME sert d'abord à ÉCARTER le hors-sujet : sur 60 offres remontées
 * par le mot « webmaster », 20 étaient des postes de conseiller en formation
 * (spec §2.3). D'où la distinction cible / voisin / hors-sujet, qui alimente à
 * la fois le critère « Métier » et le malus.
 *
 * Les compétences, elles, ne transfèrent quasiment pas d'un métier à son voisin
 * (2,4 % de recouvrement, spec §2.4) : elles n'affinent qu'à l'intérieur d'un
 * même code, et ne portent donc jamais le classement à elles seules.
 */

import data from "./data/rome-competences.json";

interface Fiche {
  i: string;                    // intitulé officiel
  c: Record<string, number>;    // code_ogr → 2 (cœur de métier) ou 1
  v: string[];                  // codes ROME voisins (mobilités officielles)
}

const TABLE = data as Record<string, Fiche>;

export interface RomeTargets {
  /** Codes visés par le candidat. */
  cibles: Set<string>;
  /** Métiers voisins officiels des cibles, cibles exclues. */
  voisins: Set<string>;
  /** Compétences attendues, agrégées sur les cibles : code_ogr → poids. */
  attendues: Map<string, number>;
}

/** Prépare une fois par scan les ensembles utilisés par le classement. */
export function buildRomeTargets(romeCodes: string[]): RomeTargets {
  const cibles = new Set(romeCodes.filter(Boolean));
  const voisins = new Set<string>();
  const attendues = new Map<string, number>();

  for (const code of cibles) {
    const fiche = TABLE[code];
    if (!fiche) continue; // code déclaré mais absent du référentiel : toléré
    for (const v of fiche.v) if (!cibles.has(v)) voisins.add(v);
    for (const [ogr, poids] of Object.entries(fiche.c)) {
      attendues.set(ogr, Math.max(attendues.get(ogr) ?? 0, poids));
    }
  }

  return { cibles, voisins, attendues };
}

/** Intitulé officiel d'un code ROME ; le code brut si inconnu. */
export function romeLabel(code: string): string {
  return TABLE[code]?.i || code;
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/rome.test.ts
```

Attendu : 6 tests verts.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/rome.ts web/src/lib/jobs/rome.test.ts
git commit -m "feat(offres): module d'accès au référentiel ROME 4.0

buildRomeTargets prépare une fois par scan les ensembles cibles / voisins /
compétences attendues. La distinction cible-voisin-hors-sujet porte le critère
« Métier » et le malus anti-bruit."
```

---

## Task 3 : Distance à vol d'oiseau

**Files:**
- Create: `web/src/lib/jobs/geo.ts`
- Test: `web/src/lib/jobs/geo.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces :
  ```ts
  export interface LatLng { lat: number; lng: number }
  export function parseLatLng(s: string): LatLng | null
  export function haversineKm(a: LatLng, b: LatLng): number
  export function distancePoints(km: number | null, radiusKm: number, max: number): number
  ```

**Contexte.** `getCommuteTimes` émet 3 appels Google Maps facturés par offre, sans
cache : 354 appels par scan si l'on classe toutes les offres, soit jusqu'à
162 $/mois et 30 à 45 s ajoutées à chaque scan (spec §2.7). Le classement se fait
donc sur la distance à vol d'oiseau, calculée localement.

- [ ] **Step 1 : Écrire le test**

Créer `web/src/lib/jobs/geo.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { parseLatLng, haversineKm, distancePoints } from "./geo";

describe("parseLatLng", () => {
  it("lit le format « lat,lng » produit par France Travail", () => {
    expect(parseLatLng("48.8,2.3")).toEqual({ lat: 48.8, lng: 2.3 });
  });

  it("accepte les espaces et les négatifs", () => {
    expect(parseLatLng(" -1.55 , 47.21 ")).toEqual({ lat: -1.55, lng: 47.21 });
  });

  it("rejette un libellé de ville", () => {
    expect(parseLatLng("75 - Paris")).toBeNull();
    expect(parseLatLng("")).toBeNull();
  });

  it("rejette des coordonnées hors bornes", () => {
    expect(parseLatLng("100,2.3")).toBeNull();
    expect(parseLatLng("48.8,200")).toBeNull();
  });
});

describe("haversineKm", () => {
  it("renvoie 0 pour deux points identiques", () => {
    expect(haversineKm({ lat: 48.85, lng: 2.35 }, { lat: 48.85, lng: 2.35 })).toBe(0);
  });

  it("mesure Paris–Lyon à ~392 km", () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.7640, lng: 4.8357 });
    expect(d).toBeGreaterThan(385);
    expect(d).toBeLessThan(400);
  });
});

describe("distancePoints", () => {
  it("donne le maximum dans le rayon souhaité", () => {
    expect(distancePoints(5, 10, 15)).toBe(15);
    expect(distancePoints(10, 10, 15)).toBe(15);
  });

  it("décroît au-delà du rayon puis tombe à zéro", () => {
    const proche = distancePoints(15, 10, 15);
    const loin = distancePoints(25, 10, 15);
    expect(proche).toBeGreaterThan(loin);
    expect(distancePoints(31, 10, 15)).toBe(0);
  });

  // Une distance inconnue ne doit ni avantager ni condamner l'offre : 12 % des
  // offres Adzuna n'ont pas de coordonnées (spec §2.6).
  it("reste neutre quand la distance est inconnue", () => {
    expect(distancePoints(null, 10, 15)).toBe(8);
  });

  it("traite un rayon nul comme le rayon minimal de 1 km", () => {
    expect(distancePoints(0.5, 0, 15)).toBe(15);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/geo.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./geo"`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `web/src/lib/jobs/geo.ts` :

```ts
/**
 * Distance à vol d'oiseau, en local. Sert à NOTER la proximité d'une offre ;
 * le temps de trajet réel (Google Maps) est calculé à la demande à l'ouverture
 * d'une offre, jamais pendant le scan — cf. spec §2.7 (354 appels facturés par
 * scan sinon, et 30 à 45 s de latence).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Lit « lat,lng » (format de `commuteDestination` chez France Travail) ; null sinon. */
export function parseLatLng(s: string): LatLng | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const R_TERRE_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique entre deux points, en kilomètres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points de proximité : plein tarif dans le rayon souhaité, décroissance
 * linéaire jusqu'à 3× ce rayon, zéro au-delà.
 * Distance inconnue → moitié des points : ne pas condamner une offre sur une
 * donnée absente (12 % des offres Adzuna n'ont pas de coordonnées).
 */
export function distancePoints(km: number | null, radiusKm: number, max: number): number {
  if (km === null) return Math.round(max / 2);
  const rayon = Math.max(1, radiusKm);
  if (km <= rayon) return max;
  const limite = rayon * 3;
  if (km >= limite) return 0;
  return Math.round(max * (1 - (km - rayon) / (limite - rayon)));
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/geo.test.ts
```

Attendu : 10 tests verts.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/geo.ts web/src/lib/jobs/geo.test.ts
git commit -m "feat(offres): distance à vol d'oiseau en local

Remplace l'appel Google Maps dans le chemin de notation. Une distance inconnue
vaut la moitié des points : 12 % des offres Adzuna n'ont pas de coordonnées et
ne doivent pas être pénalisées pour autant."
```

---

## Task 4 : Champs structurés France Travail

**Files:**
- Modify: `web/src/lib/jobs/offer.ts` (interface `JobOffer`)
- Modify: `web/src/lib/jobs/francetravail.ts:9-19` (`RawOffer`) et `:126-143` (`mapOffer`)
- Test: `web/src/lib/jobs/francetravail.test.ts` (ajouts)

**Interfaces:**
- Consumes: rien.
- Produces : champs optionnels sur `JobOffer`, consommés par les tâches 7 et 8 :
  ```ts
  romeCode?: string;
  competences?: { code: string; exigence: string }[];
  experienceExige?: string;      // "D" débutant accepté, "S" souhaitée, "E" exigée
  experienceYears?: number;      // extrait de experienceLibelle ("1 An(s)" → 1)
  lat?: number;
  lng?: number;
  ```

**Contexte.** `mapOffer` ignore aujourd'hui tout ce que France Travail fournit
déjà : `romeCode` (100 % des offres), `competences` codifiées (87 %), `salaire`
(96 %), `experienceExige` (100 %), `entreprise.logo`. Mesuré sur 150 offres
réelles (spec §2.1).

- [ ] **Step 1 : Écrire les tests**

Ajouter à la fin de `web/src/lib/jobs/francetravail.test.ts` :

```ts
describe("mapOffer — champs structurés", () => {
  const brut = {
    id: "77",
    intitule: "Développeur web",
    description: "Mission.",
    dateCreation: "2026-07-01T09:00:00Z",
    entreprise: { nom: "ACME", logo: "https://ex.fr/logo.png" },
    lieuTravail: { libelle: "75 - Paris", latitude: 48.86, longitude: 2.35 },
    origineOffre: { urlOrigine: "https://ex.fr/77" },
    romeCode: "M1855",
    competences: [
      { code: "100341", libelle: "Procédures", exigence: "E" },
      { code: "300374", libelle: "Valoriser", exigence: "S" },
    ],
    experienceExige: "E",
    experienceLibelle: "3 An(s)",
    typeContratLibelle: "CDI",
    salaire: { libelle: "Annuel de 34000.0 Euros sur 12 mois" },
  };

  it("reporte le code ROME et les compétences codifiées", () => {
    const o = mapOffer(brut, 3000);
    expect(o.romeCode).toBe("M1855");
    expect(o.competences).toEqual([
      { code: "100341", exigence: "E" },
      { code: "300374", exigence: "S" },
    ]);
  });

  it("extrait les coordonnées et le logo d'entreprise", () => {
    const o = mapOffer(brut, 3000);
    expect(o.lat).toBe(48.86);
    expect(o.lng).toBe(2.35);
    expect(o.logoUrl).toBe("https://ex.fr/logo.png");
  });

  it("reporte l'expérience et en extrait le nombre d'années", () => {
    const o = mapOffer(brut, 3000);
    expect(o.experienceExige).toBe("E");
    expect(o.experienceYears).toBe(3);
  });

  it("remplit contrat et salaire, jusqu'ici toujours vides", () => {
    const o = mapOffer(brut, 3000);
    expect(o.contractLabel).toBe("CDI");
    expect(o.salaryLabel).toBe("Annuel de 34000.0 Euros sur 12 mois");
  });

  // 13 % des offres n'ont pas de compétences, 4 % pas de salaire (spec §2.1).
  it("survit à une offre dépourvue de champs structurés", () => {
    const o = mapOffer({ id: "8", intitule: "X" }, 3000);
    expect(o.romeCode).toBeUndefined();
    expect(o.competences).toBeUndefined();
    expect(o.lat).toBeUndefined();
    expect(o.logoUrl).toBe("");
    expect(o.experienceYears).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd web && npx vitest run src/lib/jobs/francetravail.test.ts
```

Attendu : ÉCHEC sur les 4 premiers nouveaux tests (`undefined` au lieu des
valeurs). Les tests existants du fichier restent verts.

- [ ] **Step 3 : Étendre `JobOffer`**

Dans `web/src/lib/jobs/offer.ts`, ajouter à la fin de l'interface `JobOffer`
(juste avant l'accolade fermante) :

```ts
  // --- Champs structurés, fournis par France Travail uniquement. -------------
  // Absents chez Adzuna et JSearch, qui n'exposent aucune taxonomie métier
  // exploitable (spec §2.6). Le classement a donc une voie textuelle de repli
  // pour chaque critère qui s'appuie dessus.

  /** Code ROME 4.0 officiel de l'offre (100 % des offres France Travail). */
  romeCode?: string;
  /** Compétences codifiées ; `exigence` vaut "E" (exigée) ou "S" (souhaitée). */
  competences?: { code: string; exigence: string }[];
  /** "D" débutant accepté, "S" expérience souhaitée, "E" expérience exigée. */
  experienceExige?: string;
  /** Années d'expérience extraites de `experienceLibelle` ("3 An(s)" → 3). */
  experienceYears?: number;
  /** Latitude du lieu de travail, pour la distance locale. */
  lat?: number;
  /** Longitude du lieu de travail. */
  lng?: number;
```

- [ ] **Step 4 : Étendre `RawOffer` et `mapOffer`**

Dans `web/src/lib/jobs/francetravail.ts`, remplacer l'interface `RawOffer`
(lignes 9-19) par :

```ts
/** Offre brute renvoyée par l'API France Travail (champs utilisés uniquement). */
export interface RawOffer {
  id?: string;
  intitule?: string;
  description?: string;
  alternance?: boolean;
  typeContratLibelle?: string;
  dateCreation?: string;
  entreprise?: { nom?: string; logo?: string };
  lieuTravail?: { libelle?: string; latitude?: number; longitude?: number };
  origineOffre?: { urlOrigine?: string };
  romeCode?: string;
  competences?: { code?: string; libelle?: string; exigence?: string }[];
  experienceExige?: string;
  experienceLibelle?: string;
  salaire?: { libelle?: string };
}
```

Puis, juste au-dessus de `mapOffer`, ajouter :

```ts
/** « 3 An(s) » → 3 ; undefined si le libellé n'annonce pas d'années. */
function experienceYears(libelle?: string): number | undefined {
  const m = /(\d+)\s*an/i.exec(libelle ?? "");
  return m ? Number(m[1]) : undefined;
}
```

Enfin, remplacer le corps de `mapOffer` par :

```ts
export function mapOffer(offer: RawOffer, maxDescriptionChars: number): JobOffer {
  const lieu = offer.lieuTravail;
  const competences = (offer.competences ?? [])
    .filter((c): c is { code: string; exigence?: string } => Boolean(c.code))
    .map((c) => ({ code: c.code, exigence: c.exigence ?? "S" }));

  return {
    id: offer.id ?? "",
    source: "francetravail",
    title: offer.intitule ?? "",
    company: offer.entreprise?.nom ?? "",
    location: lieu?.libelle ?? "",
    commuteDestination: commuteDestination(offer),
    url: offer.origineOffre?.urlOrigine ?? "",
    jobText: (offer.description ?? "").slice(0, maxDescriptionChars),
    publishedAt: offer.dateCreation ?? "",
    logoUrl: offer.entreprise?.logo ?? "",
    boardDomain: "",
    boardName: "France Travail",
    contractLabel: offer.typeContratLibelle ?? "",
    salaryLabel: offer.salaire?.libelle ?? "",
    ...(offer.romeCode ? { romeCode: offer.romeCode } : {}),
    ...(competences.length > 0 ? { competences } : {}),
    ...(offer.experienceExige ? { experienceExige: offer.experienceExige } : {}),
    ...(experienceYears(offer.experienceLibelle) !== undefined
      ? { experienceYears: experienceYears(offer.experienceLibelle) }
      : {}),
    ...(typeof lieu?.latitude === "number" ? { lat: lieu.latitude } : {}),
    ...(typeof lieu?.longitude === "number" ? { lng: lieu.longitude } : {}),
  };
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
cd web && npx vitest run src/lib/jobs/francetravail.test.ts
```

Attendu : tous verts, anciens tests compris.

⚠️ Le test existant ligne 45 vérifie `toMatchObject({...})`. `toMatchObject`
tolère les propriétés supplémentaires : il doit rester vert sans modification. Si
un test existant casse, c'est le code qui est faux — ne pas toucher au test.

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/jobs/offer.ts web/src/lib/jobs/francetravail.ts web/src/lib/jobs/francetravail.test.ts
git commit -m "feat(offres): lire les champs structurés de France Travail

romeCode, competences codifiées, expérience, coordonnées, contrat, salaire et
logo d'entreprise étaient tous ignorés par mapOffer alors que l'API les fournit
(100 %, 87 %, 100 %, 100 %, 96 % de couverture mesurée sur 150 offres réelles)."
```

---

## Task 5 : Coordonnées Adzuna

**Files:**
- Modify: `web/src/lib/jobs/adzuna.ts` (interface brute + poussée de l'offre ligne ~99)
- Test: `web/src/lib/jobs/adzuna.test.ts` (ajout)

**Interfaces:**
- Consumes: `lat`/`lng` sur `JobOffer` (tâche 4).
- Produces: rien de nouveau.

**Contexte.** Adzuna expose `latitude`/`longitude` sur 88 % de ses offres. Sa
`category` en revanche est inexploitable (21 offres sur 50 en « Unknown », et un
poste de webmaster classé « Fabrication ») : on ne la lit pas.

- [ ] **Step 1 : Écrire le test**

Ajouter à la fin de `web/src/lib/jobs/adzuna.test.ts` :

```ts
describe("adzuna — coordonnées", () => {
  it("reporte latitude et longitude quand elles sont présentes", async () => {
    const brut = {
      id: "12",
      title: "Webmaster",
      description: "Mission.",
      redirect_url: "https://ex.fr/12",
      company: { display_name: "ACME" },
      location: { display_name: "Paris" },
      latitude: 48.86,
      longitude: 2.35,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [brut] }),
    }) as unknown as typeof fetch;

    const { offers } = await searchAdzuna(
      { ...EMPTY_PROFILE, keywords: ["webmaster"] },
      { appId: "a", appKey: "b" },
    );
    expect(offers[0].lat).toBe(48.86);
    expect(offers[0].lng).toBe(2.35);
  });

  it("laisse les coordonnées absentes sur les 12 % d'offres sans GPS", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: "13", title: "X", redirect_url: "https://ex.fr/13" }],
      }),
    }) as unknown as typeof fetch;

    const { offers } = await searchAdzuna(
      { ...EMPTY_PROFILE, keywords: ["x"] },
      { appId: "a", appKey: "b" },
    );
    expect(offers[0].lat).toBeUndefined();
    expect(offers[0].lng).toBeUndefined();
  });
});
```

⚠️ Vérifier en tête de `adzuna.test.ts` que `vi`, `EMPTY_PROFILE` et
`searchAdzuna` sont bien importés ; ajouter uniquement ce qui manque, sans
toucher au reste du fichier.

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/adzuna.test.ts
```

Attendu : ÉCHEC — `expected undefined to be 48.86`.

- [ ] **Step 3 : Implémenter**

Dans `web/src/lib/jobs/adzuna.ts`, ajouter à l'interface `RawAdzuna` :

```ts
  latitude?: number;
  longitude?: number;
```

Puis, dans l'objet poussé dans `offers` (autour de la ligne 99), ajouter juste
avant l'accolade fermante `});` :

```ts
        ...(typeof o.latitude === "number" ? { lat: o.latitude } : {}),
        ...(typeof o.longitude === "number" ? { lng: o.longitude } : {}),
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/adzuna.test.ts
```

Attendu : tous verts.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/adzuna.ts web/src/lib/jobs/adzuna.test.ts
git commit -m "feat(offres): lire les coordonnées Adzuna

Présentes sur 88 % des offres, elles alimentent la distance locale. La
catégorie Adzuna reste ignorée : 21 offres sur 50 en « Unknown » et un poste
de webmaster classé « Fabrication »."
```

---

## Task 6 : Analyse textuelle (zones et saturation)

**Files:**
- Create: `web/src/lib/jobs/rank/text.ts`
- Test: `web/src/lib/jobs/rank/text.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces :
  ```ts
  export interface Zones { titre: string; profil: string; reste: string }
  export function splitZones(title: string, jobText: string): Zones
  export function keywordPoints(
    zones: Zones, keywords: string[], max: number,
  ): { points: number; trouves: string[] }
  ```

**Contexte.** C'est le socle du critère qui pèse le plus (45 points sur 100). Un
même métier se présente sous des intitulés multiples qu'aucune taxonomie ne
réconcilie : seule la description les couvre tous (spec §3.2). La saturation
évite qu'une annonce répétant douze fois « SEO » vaille douze fois une annonce
le mentionnant deux fois.

- [ ] **Step 1 : Écrire le test**

Créer `web/src/lib/jobs/rank/text.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { splitZones, keywordPoints } from "./text";

describe("splitZones", () => {
  it("isole la section « profil recherché »", () => {
    const z = splitZones("Webmaster", "Missions variées.\nProfil recherché : maîtrise du SEO.");
    expect(z.titre).toBe("webmaster");
    expect(z.profil).toContain("seo");
    expect(z.reste).toContain("missions variees");
    expect(z.reste).not.toContain("seo");
  });

  it("reconnaît les autres intitulés usuels", () => {
    for (const marqueur of ["Votre profil", "Compétences requises", "Profil souhaité", "Vous êtes"]) {
      const z = splitZones("T", `Blabla.\n${marqueur} : expert Matomo.`);
      expect(z.profil, `marqueur « ${marqueur} » non reconnu`).toContain("matomo");
    }
  });

  it("met tout dans « reste » si aucune section n'est identifiable", () => {
    const z = splitZones("Webmaster", "Une annonce sans structure.");
    expect(z.profil).toBe("");
    expect(z.reste).toContain("annonce sans structure");
  });

  it("ignore accents et casse", () => {
    const z = splitZones("Chargé de Référencement", "");
    expect(z.titre).toBe("charge de referencement");
  });
});

describe("keywordPoints", () => {
  const zones = (t: string, d: string) => splitZones(t, d);

  it("rend zéro sans mot-clé", () => {
    expect(keywordPoints(zones("Webmaster", "SEO"), [], 45)).toEqual({ points: 0, trouves: [] });
  });

  it("rend zéro si rien ne correspond", () => {
    const r = keywordPoints(zones("Comptable", "Bilans."), ["SEO"], 45);
    expect(r.points).toBe(0);
    expect(r.trouves).toEqual([]);
  });

  it("donne le maximum quand tous les mots-clés sont dans le titre", () => {
    const r = keywordPoints(zones("Webmaster SEO", ""), ["webmaster", "seo"], 45);
    expect(r.points).toBe(45);
    expect(r.trouves).toEqual(["webmaster", "seo"]);
  });

  it("pèse plus lourd dans le titre que dans le corps", () => {
    const dansTitre = keywordPoints(zones("Expert SEO", ""), ["seo"], 45).points;
    const dansCorps = keywordPoints(zones("Poste", "un peu de seo"), ["seo"], 45).points;
    expect(dansTitre).toBeGreaterThan(dansCorps);
  });

  it("pèse plus lourd dans « profil recherché » que dans le reste", () => {
    const dansProfil = keywordPoints(zones("P", "Profil recherché : seo."), ["seo"], 45).points;
    const dansReste = keywordPoints(zones("P", "on fait du seo parfois."), ["seo"], 45).points;
    expect(dansProfil).toBeGreaterThan(dansReste);
  });

  // Le cœur de la saturation : la répétition ne doit pas gonfler la note.
  it("sature — douze mentions ne valent pas douze fois deux mentions", () => {
    const deux = keywordPoints(zones("P", "seo seo"), ["seo"], 45).points;
    const douze = keywordPoints(zones("P", "seo ".repeat(12)), ["seo"], 45).points;
    expect(douze).toBeLessThanOrEqual(deux * 2);
    expect(douze).toBeLessThanOrEqual(45);
  });

  it("note au prorata des mots-clés trouvés", () => {
    const r = keywordPoints(zones("Webmaster", ""), ["webmaster", "matomo"], 40);
    expect(r.points).toBeGreaterThan(0);
    expect(r.points).toBeLessThan(40);
    expect(r.trouves).toEqual(["webmaster"]);
  });

  it("ignore les mots de deux lettres ou moins", () => {
    expect(keywordPoints(zones("Un poste", "de la"), ["de"], 45).points).toBe(0);
  });

  it("gère un mot-clé multi-mots", () => {
    const r = keywordPoints(zones("Chargé de communication digitale", ""), ["communication digitale"], 45);
    expect(r.points).toBe(45);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/rank/text.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./text"`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `web/src/lib/jobs/rank/text.ts` :

```ts
/**
 * Analyse textuelle d'une annonce : découpage en zones et notation saturante.
 *
 * C'est le socle du critère le plus lourd (45 points sur 100). Un même métier
 * réel se présente sous des intitulés multiples — webmaster, chargé de contenu
 * web, chargé de communication digitale… — qu'aucune nomenclature ne réconcilie
 * (« contenu web » et « webmarketing » sont introuvables même en ROME 4.0,
 * spec §2.5). La description est la seule source qui les couvre tous.
 *
 * S'applique à TOUTES les sources : c'est ce qui rend une offre Adzuna
 * comparable à une offre France Travail sur la même échelle (spec §3.4).
 */

/** Minuscules + suppression des accents (aligné sur `prefilter.ts`). */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface Zones {
  /** Titre de l'offre, normalisé. Poids 3. */
  titre: string;
  /** Section « profil recherché » si identifiable, normalisée. Poids 2. */
  profil: string;
  /** Tout le reste de la description, normalisé. Poids 1. */
  reste: string;
}

/** Intitulés de section usuels, déjà normalisés. */
const MARQUEURS = [
  "profil recherche",
  "profil souhaite",
  "votre profil",
  "competences requises",
  "vos competences",
  "vous etes",
];

/** Longueur retenue pour la section « profil » à partir de son intitulé. */
const LONGUEUR_PROFIL = 800;

/** Découpe le texte en zones pondérées. Sans section identifiable, `profil` est vide. */
export function splitZones(title: string, jobText: string): Zones {
  const titre = normalize(title);
  const texte = normalize(jobText);

  let debut = -1;
  for (const m of MARQUEURS) {
    const i = texte.indexOf(m);
    if (i !== -1 && (debut === -1 || i < debut)) debut = i;
  }
  if (debut === -1) return { titre, profil: "", reste: texte };

  const fin = debut + LONGUEUR_PROFIL;
  return {
    titre,
    profil: texte.slice(debut, fin),
    reste: texte.slice(0, debut) + texte.slice(fin),
  };
}

const POIDS_TITRE = 3;
const POIDS_PROFIL = 2;
const POIDS_RESTE = 1;

/** Plafond de crédit par mot-clé : au-delà, la répétition n'ajoute plus rien. */
const PLAFOND = 4;

/** Occurrences d'un terme dans un texte (sous-chaîne, sans limite de mot). */
function compte(texte: string, terme: string): number {
  if (!terme) return 0;
  let n = 0;
  let i = texte.indexOf(terme);
  while (i !== -1) {
    n++;
    i = texte.indexOf(terme, i + terme.length);
  }
  return n;
}

/**
 * Note la présence des mots-clés, pondérée par zone et **saturante** : chaque
 * mot-clé rapporte au plus `PLAFOND` de crédit, donc répéter un terme douze fois
 * ne vaut pas douze fois le mentionner deux fois. Le score final est le prorata
 * des crédits sur le nombre de mots-clés.
 *
 * Un mot-clé multi-mots (« communication digitale ») est cherché tel quel puis,
 * à défaut, mot à mot — sans quoi un intitulé légèrement différent le raterait.
 */
export function keywordPoints(
  zones: Zones,
  keywords: string[],
  max: number,
): { points: number; trouves: string[] } {
  const utiles = keywords.map((k) => k.trim()).filter((k) => k.length > 2);
  if (utiles.length === 0) return { points: 0, trouves: [] };

  const trouves: string[] = [];
  let credit = 0;

  for (const kw of utiles) {
    const terme = normalize(kw);
    const termes = compte(zones.titre + " " + zones.profil + " " + zones.reste, terme) > 0
      ? [terme]
      : terme.split(/\s+/).filter((m) => m.length > 2);

    let brut = 0;
    for (const t of termes) {
      brut +=
        POIDS_TITRE * compte(zones.titre, t) +
        POIDS_PROFIL * compte(zones.profil, t) +
        POIDS_RESTE * compte(zones.reste, t);
    }
    // Un mot-clé multi-mots éclaté cumulerait mécaniquement plus : on ramène à
    // la moyenne par mot pour rester comparable à un mot-clé simple.
    if (termes.length > 1) brut = brut / termes.length;

    if (brut > 0) {
      trouves.push(kw);
      credit += Math.min(brut, PLAFOND) / PLAFOND;
    }
  }

  return { points: Math.round((max * credit) / utiles.length), trouves };
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/rank/text.test.ts
```

Attendu : 14 tests verts.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/rank/text.ts web/src/lib/jobs/rank/text.test.ts
git commit -m "feat(offres): analyse textuelle par zones avec saturation

Socle du critère le plus lourd (45/100). Le titre pèse 3, la section « profil
recherché » 2, le reste 1. La saturation empêche qu'une annonce répétant douze
fois un terme vaille douze fois celle qui le mentionne deux fois."
```

---

## Task 7 : Les critères

**Files:**
- Create: `web/src/lib/jobs/rank/criteria.ts`
- Test: `web/src/lib/jobs/rank/criteria.test.ts`

**Interfaces:**
- Consumes: `buildRomeTargets`/`RomeTargets` (tâche 2), `parseLatLng`/`haversineKm`/
  `distancePoints` (tâche 3), champs structurés de `JobOffer` (tâches 4-5),
  `splitZones`/`keywordPoints` (tâche 6).
- Produces :
  ```ts
  export interface RankContext { rome: RomeTargets; home: LatLng | null }
  export interface Ligne { key: string; label: string; points: number; max: number; reason: string }
  export function competencesPoints(o: JobOffer, p: JobSearchProfile, c: RankContext): Ligne
  export function metierPoints(o: JobOffer, p: JobSearchProfile, c: RankContext): Ligne
  export function distanceLigne(o: JobOffer, p: JobSearchProfile, c: RankContext): Ligne
  export function contratSalairePoints(o: JobOffer, p: JobSearchProfile): Ligne
  export function experiencePoints(o: JobOffer, p: JobSearchProfile): Ligne
  export function malusHorsSujet(o: JobOffer, c: RankContext): Ligne
  export function malusSignaux(o: JobOffer, p: JobSearchProfile, maintenant: number): Ligne
  export const MAX: { competences: 45; metier: 20; distance: 15; contrat: 10; experience: 10 }
  ```

- [ ] **Step 1 : Écrire le test**

Créer `web/src/lib/jobs/rank/criteria.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  competencesPoints, metierPoints, distanceLigne, contratSalairePoints,
  experiencePoints, malusHorsSujet, malusSignaux, MAX,
} from "./criteria";
import { buildRomeTargets } from "../rome";
import { EMPTY_PROFILE } from "../profile";
import type { JobOffer } from "../offer";

const offre = (p: Partial<JobOffer> = {}): JobOffer => ({
  id: "1", source: "francetravail", title: "", company: "", location: "",
  commuteDestination: "", url: "", jobText: "", publishedAt: "", logoUrl: "",
  boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "", ...p,
});

const ctx = (romeCodes: string[] = [], home: { lat: number; lng: number } | null = null) => ({
  rome: buildRomeTargets(romeCodes),
  home,
});

describe("competencesPoints", () => {
  it("note la description même sans donnée structurée", () => {
    const l = competencesPoints(
      offre({ title: "Webmaster", jobText: "Profil recherché : SEO et Matomo." }),
      { ...EMPTY_PROFILE, prefilterKeywords: ["seo", "matomo"] },
      ctx(),
    );
    expect(l.points).toBeGreaterThan(0);
    expect(l.max).toBe(MAX.competences);
    expect(l.reason).toMatch(/seo/i);
  });

  it("retombe sur les intitulés de poste si aucune compétence n'est saisie", () => {
    const l = competencesPoints(
      offre({ title: "Webmaster", jobText: "Poste de webmaster." }),
      { ...EMPTY_PROFILE, keywords: ["webmaster"], prefilterKeywords: [] },
      ctx(),
    );
    expect(l.points).toBeGreaterThan(0);
  });

  it("ne dépasse jamais son maximum, même avec les deux voies", () => {
    const l = competencesPoints(
      offre({
        title: "Webmaster SEO", jobText: "Profil recherché : seo. ".repeat(20),
        romeCode: "M1855",
        competences: [{ code: "100341", exigence: "E" }, { code: "300374", exigence: "E" }],
      }),
      { ...EMPTY_PROFILE, prefilterKeywords: ["seo"] },
      ctx(["M1855"]),
    );
    expect(l.points).toBeLessThanOrEqual(MAX.competences);
  });

  it("rend zéro sur une offre hors-sujet", () => {
    const l = competencesPoints(
      offre({ title: "Comptable", jobText: "Bilans et écritures." }),
      { ...EMPTY_PROFILE, prefilterKeywords: ["seo"] },
      ctx(),
    );
    expect(l.points).toBe(0);
  });
});

describe("metierPoints", () => {
  it("donne le maximum sur un code ROME visé", () => {
    const l = metierPoints(offre({ romeCode: "M1855" }), EMPTY_PROFILE, ctx(["M1855"]));
    expect(l.points).toBe(MAX.metier);
    expect(l.reason).toMatch(/cible/i);
  });

  it("donne une note partielle sur un métier voisin", () => {
    const t = buildRomeTargets(["M1855"]);
    const voisin = [...t.voisins][0];
    const l = metierPoints(offre({ romeCode: voisin }), EMPTY_PROFILE, ctx(["M1855"]));
    expect(l.points).toBeGreaterThan(0);
    expect(l.points).toBeLessThan(MAX.metier);
    expect(l.reason).toMatch(/voisin/i);
  });

  it("rend zéro sur un code hors-sujet", () => {
    // K2101 « Conseiller en formation » : 20 offres sur 60 pour « webmaster ».
    const l = metierPoints(offre({ romeCode: "K2101" }), EMPTY_PROFILE, ctx(["M1855"]));
    expect(l.points).toBe(0);
  });

  it("retombe sur le titre quand l'offre n'a pas de code ROME", () => {
    const l = metierPoints(
      offre({ title: "Webmaster senior" }),
      { ...EMPTY_PROFILE, keywords: ["webmaster"] },
      ctx(["M1855"]),
    );
    expect(l.points).toBeGreaterThan(0);
  });
});

describe("distanceLigne", () => {
  it("donne le maximum dans le rayon", () => {
    const l = distanceLigne(
      offre({ lat: 48.86, lng: 2.35 }),
      { ...EMPTY_PROFILE, location: { ...EMPTY_PROFILE.location, radiusKm: 20 } },
      ctx([], { lat: 48.85, lng: 2.35 }),
    );
    expect(l.points).toBe(MAX.distance);
    expect(l.reason).toMatch(/km/);
  });

  it("reste neutre sans domicile connu", () => {
    const l = distanceLigne(offre({ lat: 48.86, lng: 2.35 }), EMPTY_PROFILE, ctx());
    expect(l.points).toBe(Math.round(MAX.distance / 2));
  });

  it("lit les coordonnées depuis commuteDestination en repli", () => {
    const l = distanceLigne(
      offre({ commuteDestination: "48.86,2.35" }),
      { ...EMPTY_PROFILE, location: { ...EMPTY_PROFILE.location, radiusKm: 20 } },
      ctx([], { lat: 48.85, lng: 2.35 }),
    );
    expect(l.points).toBe(MAX.distance);
  });
});

describe("contratSalairePoints", () => {
  it("récompense un contrat voulu et un salaire annoncé", () => {
    const l = contratSalairePoints(
      offre({ contractLabel: "CDI", salaryLabel: "34 k€ / an" }),
      { ...EMPTY_PROFILE, contractTypes: ["CDI"] },
    );
    expect(l.points).toBe(MAX.contrat);
  });

  it("ne donne que la part salaire si le contrat ne correspond pas", () => {
    const l = contratSalairePoints(
      offre({ contractLabel: "CDD", salaryLabel: "34 k€" }),
      { ...EMPTY_PROFILE, contractTypes: ["CDI"] },
    );
    expect(l.points).toBeGreaterThan(0);
    expect(l.points).toBeLessThan(MAX.contrat);
  });

  it("rend zéro sans aucune information", () => {
    expect(contratSalairePoints(offre(), EMPTY_PROFILE).points).toBe(0);
  });
});

describe("experiencePoints", () => {
  it("donne le maximum si le niveau demandé est indifférent", () => {
    expect(experiencePoints(offre(), { ...EMPTY_PROFILE, experienceLevel: "" }).points)
      .toBe(MAX.experience);
  });

  it("donne le maximum quand les débutants sont acceptés", () => {
    const l = experiencePoints(
      offre({ experienceExige: "D" }),
      { ...EMPTY_PROFILE, experienceLevel: "1" },
    );
    expect(l.points).toBe(MAX.experience);
  });

  it("pénalise une exigence supérieure au niveau du candidat", () => {
    const l = experiencePoints(
      offre({ experienceExige: "E", experienceYears: 8 }),
      { ...EMPTY_PROFILE, experienceLevel: "1" },
    );
    expect(l.points).toBeLessThan(MAX.experience);
  });

  it("reste neutre sans information", () => {
    const l = experiencePoints(offre(), { ...EMPTY_PROFILE, experienceLevel: "2" });
    expect(l.points).toBeGreaterThan(0);
    expect(l.points).toBeLessThan(MAX.experience);
  });
});

describe("malusHorsSujet", () => {
  it("frappe un code ROME ni cible ni voisin", () => {
    const l = malusHorsSujet(offre({ romeCode: "K2101" }), ctx(["M1855"]));
    expect(l.points).toBe(-20);
  });

  it("épargne une cible et un voisin", () => {
    expect(malusHorsSujet(offre({ romeCode: "M1855" }), ctx(["M1855"])).points).toBe(0);
  });

  // Adzuna et JSearch n'ont pas de code ROME : ni punis, ni protégés (spec §4).
  it("n'affecte jamais une offre sans code ROME", () => {
    expect(malusHorsSujet(offre({ source: "adzuna" }), ctx(["M1855"])).points).toBe(0);
  });

  it("ne s'applique pas si le candidat n'a déclaré aucun métier", () => {
    expect(malusHorsSujet(offre({ romeCode: "K2101" }), ctx([])).points).toBe(0);
  });
});

describe("malusSignaux", () => {
  const T0 = Date.UTC(2026, 6, 28);

  it("ne retire rien à une offre saine et récente", () => {
    const l = malusSignaux(
      offre({ jobText: "Poste clair.", publishedAt: new Date(T0 - 86400e3).toISOString() }),
      EMPTY_PROFILE, T0,
    );
    expect(l.points).toBe(0);
  });

  it("pénalise un salaire non annoncé", () => {
    const l = malusSignaux(offre({ jobText: "Rémunération selon profil." }), EMPTY_PROFILE, T0);
    expect(l.points).toBeLessThan(0);
    expect(l.reason).toMatch(/selon profil/i);
  });

  it("pénalise une offre plus ancienne que le maximum voulu", () => {
    const l = malusSignaux(
      offre({ publishedAt: new Date(T0 - 60 * 86400e3).toISOString() }),
      { ...EMPTY_PROFILE, maxAgeDays: 30 }, T0,
    );
    expect(l.points).toBeLessThan(0);
  });

  it("pénalise la présence d'un mot exclu", () => {
    const l = malusSignaux(
      offre({ jobText: "Contrat en alternance." }),
      { ...EMPTY_PROFILE, excludedWords: ["alternan"] }, T0,
    );
    expect(l.points).toBeLessThan(0);
  });

  it("plafonne le malus à -15 quoi qu'il arrive", () => {
    const l = malusSignaux(
      offre({
        jobText: "Salaire selon profil, jeune et dynamique, esprit startup, alternance.",
        publishedAt: new Date(T0 - 90 * 86400e3).toISOString(),
      }),
      { ...EMPTY_PROFILE, excludedWords: ["alternan"] }, T0,
    );
    expect(l.points).toBe(-15);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/rank/criteria.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./criteria"`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `web/src/lib/jobs/rank/criteria.ts` :

```ts
/**
 * Les critères de classement, une fonction pure par critère.
 *
 * Chaque critère a DEUX voies pour le même nombre de points : une voie
 * structurée (France Travail) et une voie textuelle (toutes les sources). C'est
 * ce qui garde une offre Adzuna comparable à une offre France Travail sur une
 * seule échelle de 100 — sans quoi les offres FT seraient systématiquement
 * avantagées (spec §3.4).
 */

import type { JobOffer } from "../offer";
import type { JobSearchProfile } from "../profile";
import { romeLabel, type RomeTargets } from "../rome";
import { parseLatLng, haversineKm, distancePoints, type LatLng } from "../geo";
import { splitZones, keywordPoints } from "./text";

export interface RankContext {
  rome: RomeTargets;
  /** Coordonnées du domicile ; null si l'adresse n'a pas pu être géocodée. */
  home: LatLng | null;
}

export interface Ligne {
  key: string;
  label: string;
  points: number;
  max: number;
  reason: string;
}

/** Barème. Les compétences pèsent plus du double du métier (décision §3.2). */
export const MAX = {
  competences: 45,
  metier: 20,
  distance: 15,
  contrat: 10,
  experience: 10,
} as const;

export const MALUS_HORS_SUJET = -20;
export const MALUS_SIGNAUX_MAX = -15;

/** Part de l'enveloppe « compétences » réservée à la voie structurée. */
const PART_STRUCTUREE = 0.4;

/** Crédit structuré considéré comme plein (offres FT : 4 compétences en moyenne). */
const CREDIT_PLEIN = 6;

/**
 * Compétences et missions — le critère le plus lourd.
 *
 * La voie textuelle sert de socle pour toutes les sources. Sur France Travail,
 * le recouvrement des codes de compétence l'affine, pondéré par le marqueur
 * cœur-de-métier (2 vs 1) et par l'exigence (E vs S). Le total reste plafonné
 * à `MAX.competences` : la part structurée redistribue dans l'enveloppe, elle
 * ne s'y ajoute pas.
 */
export function competencesPoints(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
): Ligne {
  // À défaut de compétences saisies, on retombe sur les intitulés de poste —
  // même repli que le pré-tri historique.
  const mots = profile.prefilterKeywords.length > 0 ? profile.prefilterKeywords : profile.keywords;
  const zones = splitZones(offer.title, offer.jobText);
  const texte = keywordPoints(zones, mots, MAX.competences);

  const structurable = offer.competences && offer.competences.length > 0 && ctx.rome.attendues.size > 0;
  if (!structurable) {
    return {
      key: "competences",
      label: "Compétences & missions",
      points: texte.points,
      max: MAX.competences,
      reason: texte.trouves.length > 0
        ? `${texte.trouves.length} trouvée(s) : ${texte.trouves.slice(0, 4).join(", ")}`
        : "aucune compétence repérée",
    };
  }

  let credit = 0;
  const nomsTrouves: string[] = [];
  for (const c of offer.competences ?? []) {
    const poids = ctx.rome.attendues.get(c.code);
    if (!poids) continue;
    credit += poids * (c.exigence === "E" ? 1.5 : 1);
    nomsTrouves.push(c.code);
  }
  const structure = Math.round(MAX.competences * Math.min(1, credit / CREDIT_PLEIN));

  const points = Math.min(
    MAX.competences,
    Math.round(texte.points * (1 - PART_STRUCTUREE) + structure * PART_STRUCTUREE),
  );

  const bouts = [
    texte.trouves.length > 0 ? texte.trouves.slice(0, 3).join(", ") : "",
    nomsTrouves.length > 0 ? `${nomsTrouves.length} compétence(s) officielle(s)` : "",
  ].filter(Boolean);

  return {
    key: "competences",
    label: "Compétences & missions",
    points,
    max: MAX.competences,
    reason: bouts.length > 0 ? bouts.join(" · ") : "aucune correspondance",
  };
}

/** Part des points « métier » accordée à un métier voisin officiel. */
const PART_VOISIN = 0.55;

/**
 * Métier. Le code ROME quand il existe, le titre sinon. On garde la meilleure
 * des deux voies : un titre parlant ne doit pas être puni parce que l'offre est
 * classée dans un code voisin.
 */
export function metierPoints(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
): Ligne {
  const zones = splitZones(offer.title, "");
  const titre = keywordPoints(zones, profile.keywords, MAX.metier);

  let parRome = 0;
  let motif = "";
  if (offer.romeCode && ctx.rome.cibles.size > 0) {
    if (ctx.rome.cibles.has(offer.romeCode)) {
      parRome = MAX.metier;
      motif = `${romeLabel(offer.romeCode)} (métier cible)`;
    } else if (ctx.rome.voisins.has(offer.romeCode)) {
      parRome = Math.round(MAX.metier * PART_VOISIN);
      motif = `${romeLabel(offer.romeCode)} (métier voisin)`;
    }
  }

  const points = Math.max(parRome, titre.points);
  const reason = parRome >= titre.points && motif
    ? motif
    : titre.trouves.length > 0
      ? `titre : ${titre.trouves.join(", ")}`
      : "métier non reconnu";

  return { key: "metier", label: "Métier", points, max: MAX.metier, reason };
}

/** Coordonnées de l'offre : champs dédiés, puis repli sur `commuteDestination`. */
function offerLatLng(offer: JobOffer): LatLng | null {
  if (typeof offer.lat === "number" && typeof offer.lng === "number") {
    return { lat: offer.lat, lng: offer.lng };
  }
  return parseLatLng(offer.commuteDestination);
}

/** Distance à vol d'oiseau. Aucun appel réseau (spec §2.7). */
export function distanceLigne(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
): Ligne {
  const cible = offerLatLng(offer);
  const km = ctx.home && cible ? haversineKm(ctx.home, cible) : null;
  return {
    key: "distance",
    label: "Distance",
    points: distancePoints(km, profile.location.radiusKm, MAX.distance),
    max: MAX.distance,
    reason: km === null ? "distance inconnue" : `${Math.round(km)} km à vol d'oiseau`,
  };
}

const PART_CONTRAT = 6;
const PART_SALAIRE = 4;

/** Contrat voulu et salaire annoncé. Un salaire affiché vaut des points en soi. */
export function contratSalairePoints(offer: JobOffer, profile: JobSearchProfile): Ligne {
  const label = offer.contractLabel.toUpperCase();
  const contratOk = profile.contractTypes.some((t) => label.includes(t.toUpperCase()));
  const salaireOk = offer.salaryLabel.trim() !== "";

  const bouts: string[] = [];
  if (contratOk) bouts.push(offer.contractLabel);
  if (salaireOk) bouts.push("salaire annoncé");

  return {
    key: "contrat",
    label: "Contrat & salaire",
    points: (contratOk ? PART_CONTRAT : 0) + (salaireOk ? PART_SALAIRE : 0),
    max: MAX.contrat,
    reason: bouts.length > 0 ? bouts.join(" · ") : "contrat et salaire non précisés",
  };
}

/** Années d'expérience que le profil déclare pouvoir couvrir. */
const PLAFOND_NIVEAU: Record<JobSearchProfile["experienceLevel"], number> = {
  "": Number.POSITIVE_INFINITY,
  "1": 1,
  "2": 3,
  "3": Number.POSITIVE_INFINITY,
};

/** Expérience exigée face au niveau déclaré. Neutre quand l'information manque. */
export function experiencePoints(offer: JobOffer, profile: JobSearchProfile): Ligne {
  const key = "experience";
  const label = "Expérience";
  const max = MAX.experience;

  if (profile.experienceLevel === "") {
    return { key, label, points: max, max, reason: "niveau indifférent" };
  }
  if (offer.experienceExige === "D") {
    return { key, label, points: max, max, reason: "débutant accepté" };
  }
  if (!offer.experienceExige) {
    return { key, label, points: Math.round(max * 0.7), max, reason: "non précisée" };
  }
  if (offer.experienceExige === "S") {
    return { key, label, points: Math.round(max * 0.8), max, reason: "expérience souhaitée" };
  }

  const demande = offer.experienceYears ?? 0;
  const couvert = PLAFOND_NIVEAU[profile.experienceLevel];
  return demande <= couvert
    ? { key, label, points: max, max, reason: `${demande} an(s) exigé(s), dans ton niveau` }
    : { key, label, points: Math.round(max * 0.4), max, reason: `${demande} an(s) exigé(s), au-dessus de ton niveau` };
}

/**
 * Malus anti-bruit. C'est la vraie valeur du code ROME : sur 60 offres remontées
 * par le mot « webmaster », 20 étaient des postes de conseiller en formation
 * (spec §2.3). Le cumul avec un « Métier » à 0 est voulu — une telle offre
 * plafonne à 80 et devra exceller partout ailleurs pour seulement atteindre A.
 *
 * Ne s'applique jamais aux sources sans code ROME : ni punies, ni protégées.
 */
export function malusHorsSujet(offer: JobOffer, ctx: RankContext): Ligne {
  const applicable =
    Boolean(offer.romeCode) &&
    ctx.rome.cibles.size > 0 &&
    !ctx.rome.cibles.has(offer.romeCode as string) &&
    !ctx.rome.voisins.has(offer.romeCode as string);

  return {
    key: "hors_sujet",
    label: "Métier hors-sujet",
    points: applicable ? MALUS_HORS_SUJET : 0,
    max: 0,
    reason: applicable ? `classée ${romeLabel(offer.romeCode as string)}` : "",
  };
}

/** Motifs littéraux qui trahissent une annonce peu sérieuse. */
const MOTIFS: { motif: string; libelle: string }[] = [
  { motif: "selon profil", libelle: "salaire selon profil" },
  { motif: "selon experience", libelle: "salaire selon expérience" },
  { motif: "jeune et dynamique", libelle: "« jeune et dynamique »" },
  { motif: "esprit startup", libelle: "« esprit startup »" },
  { motif: "esprit start-up", libelle: "« esprit start-up »" },
];

const PENALITE = -5;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Signaux négatifs, plafonnés. `maintenant` est injecté pour rendre le test déterministe. */
export function malusSignaux(
  offer: JobOffer,
  profile: JobSearchProfile,
  maintenant: number,
): Ligne {
  const texte = normalize(`${offer.title} ${offer.jobText}`);
  let points = 0;
  const causes: string[] = [];

  for (const { motif, libelle } of MOTIFS) {
    if (texte.includes(motif)) {
      points += PENALITE;
      causes.push(libelle);
      break; // un seul malus « annonce floue », pas un par formulation
    }
  }

  for (const mot of profile.excludedWords) {
    const m = normalize(mot);
    if (m.length > 2 && texte.includes(m)) {
      points += PENALITE;
      causes.push(`mot exclu « ${mot} »`);
      break;
    }
  }

  if (offer.publishedAt) {
    const t = Date.parse(offer.publishedAt);
    if (!Number.isNaN(t)) {
      const jours = Math.floor((maintenant - t) / 86_400_000);
      if (jours > profile.maxAgeDays) {
        points += PENALITE;
        causes.push(`publiée il y a ${jours} jours`);
      }
    }
  }

  return {
    key: "signaux",
    label: "Signaux négatifs",
    points: Math.max(MALUS_SIGNAUX_MAX, points),
    max: 0,
    reason: causes.join(" · "),
  };
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/rank/criteria.test.ts
```

Attendu : 23 tests verts.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/jobs/rank/criteria.ts web/src/lib/jobs/rank/criteria.test.ts
git commit -m "feat(offres): les critères de classement, une fonction pure par critère

Deux voies par critère (structurée France Travail / textuelle toutes sources)
pour le même nombre de points, afin que les sources restent comparables. Le
code ROME agit surtout en malus anti-bruit : c'est ce qui écarte les 20 offres
« conseiller en formation » remontées par le mot « webmaster »."
```

---

## Task 8 : Orchestration et lettres

**Files:**
- Create: `web/src/lib/jobs/grade.ts`
- Create: `web/src/lib/jobs/rank/index.ts`
- Test: `web/src/lib/jobs/rank/index.test.ts`

**Interfaces:**
- Consumes: tous les critères (tâche 7), `buildRomeTargets` (tâche 2).
- Produces, dans `grade.ts` (**module feuille, sans aucune dépendance**) :
  ```ts
  export type Grade = "S" | "A" | "B" | "C" | "D";
  export interface GradeThresholds { S: number; A: number; B: number; C: number }
  export const DEFAULT_THRESHOLDS: GradeThresholds; // { S: 85, A: 70, B: 55, C: 40 }
  export const GRADE_ORDER: Grade[];                // ["S","A","B","C","D"]
  export function gradeOf(score: number, t?: GradeThresholds): Grade
  ```
- Produces, dans `rank/index.ts` :
  ```ts
  export interface RankResult { score: number; grade: Grade; breakdown: Ligne[] }
  export function buildRankContext(profile: JobSearchProfile, home: LatLng | null): RankContext
  export function rankOffer(o: JobOffer, p: JobSearchProfile, c: RankContext, maintenant?: number): RankResult
  export function shouldPersist(r: RankResult, p: JobSearchProfile): boolean
  // + réexport de tout `grade.ts` pour confort d'import
  ```

> **Pourquoi `grade.ts` séparé.** `rank/index.ts` importe `rome.ts`, qui importe
> les 835 Ko de `rome-competences.json`. Or `db.ts`, `profile.ts` et `JobCard`
> n'ont besoin que du type `Grade` et de la fonction `gradeOf`. S'ils importaient
> depuis `rank/`, le bundler embarquerait le référentiel ROME **dans chaque page**
> qui touche à Dexie. Le module feuille coupe cette chaîne. Les modules qui
> classent réellement (`JobsView`) importent depuis `rank/` ; les autres importent
> depuis `grade.ts`.

- [ ] **Step 1 : Écrire le test**

Créer `web/src/lib/jobs/rank/index.test.ts` :

```ts
import { describe, it, expect } from "vitest";
// `gradeOf` et consorts viennent de `grade.ts` mais sont réexportés par `index.ts` :
// on importe ici comme le fera JobsView, ce qui vérifie aussi le réexport.
import { rankOffer, gradeOf, buildRankContext, shouldPersist, DEFAULT_THRESHOLDS, GRADE_ORDER } from "./index";
import { EMPTY_PROFILE, type JobSearchProfile } from "../profile";
import type { JobOffer } from "../offer";

const T0 = Date.UTC(2026, 6, 28);

const offre = (p: Partial<JobOffer> = {}): JobOffer => ({
  id: "1", source: "francetravail", title: "", company: "", location: "",
  commuteDestination: "", url: "", jobText: "", publishedAt: new Date(T0 - 86400e3).toISOString(),
  logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "", ...p,
});

const profilWeb: JobSearchProfile = {
  ...EMPTY_PROFILE,
  keywords: ["webmaster", "développeur web"],
  romeCodes: ["M1855", "M1834"],
  prefilterKeywords: ["seo", "wordpress", "matomo"],
  contractTypes: ["CDI"],
};

describe("gradeOf", () => {
  it("applique les seuils par défaut", () => {
    expect(gradeOf(95)).toBe("S");
    expect(gradeOf(85)).toBe("S");
    expect(gradeOf(84)).toBe("A");
    expect(gradeOf(70)).toBe("A");
    expect(gradeOf(55)).toBe("B");
    expect(gradeOf(40)).toBe("C");
    expect(gradeOf(39)).toBe("D");
    expect(gradeOf(0)).toBe("D");
  });

  it("accepte des seuils personnalisés", () => {
    expect(gradeOf(60, { S: 95, A: 80, B: 60, C: 30 })).toBe("B");
  });

  it("expose l'ordre des lettres du meilleur au moins bon", () => {
    expect(GRADE_ORDER).toEqual(["S", "A", "B", "C", "D"]);
  });
});

describe("rankOffer", () => {
  const ctx = () => buildRankContext(profilWeb, { lat: 48.85, lng: 2.35 });

  it("borne le score entre 0 et 100", () => {
    const bas = rankOffer(offre({ title: "Comptable", jobText: "Bilans.", romeCode: "M1203" }), profilWeb, ctx(), T0);
    expect(bas.score).toBeGreaterThanOrEqual(0);
    expect(bas.score).toBeLessThanOrEqual(100);
  });

  it("renvoie une ligne de détail par critère", () => {
    const r = rankOffer(offre({ title: "Webmaster" }), profilWeb, ctx(), T0);
    const cles = r.breakdown.map((l) => l.key);
    expect(cles).toContain("competences");
    expect(cles).toContain("metier");
    expect(cles).toContain("distance");
    expect(cles).toContain("contrat");
    expect(cles).toContain("experience");
  });

  it("classe haut une offre en plein dans la cible", () => {
    const r = rankOffer(offre({
      title: "Webmaster",
      jobText: "Profil recherché : SEO, WordPress, Matomo.",
      romeCode: "M1855",
      contractLabel: "CDI",
      salaryLabel: "34 k€ / an",
      lat: 48.86, lng: 2.35,
    }), profilWeb, ctx(), T0);
    expect(r.score).toBeGreaterThanOrEqual(55);
    expect(["S", "A", "B"]).toContain(r.grade);
  });

  // Critère de succès n°4 de la spec : le bruit de la recherche plein-texte
  // (K2101 « Conseiller en formation ») ne doit jamais remonter.
  it("écrase une offre hors-sujet malgré un titre trompeur", () => {
    const r = rankOffer(offre({
      title: "Conseiller en formation webmaster",
      jobText: "Accompagnement de stagiaires.",
      romeCode: "K2101",
      contractLabel: "CDI",
      salaryLabel: "30 k€",
      lat: 48.86, lng: 2.35,
    }), profilWeb, ctx(), T0);
    expect(r.grade === "C" || r.grade === "D").toBe(true);
  });

  it("classe une offre franchement étrangère tout en bas", () => {
    const r = rankOffer(offre({
      title: "Comptable",
      jobText: "Écritures et bilans annuels.",
      romeCode: "M1203",
    }), profilWeb, ctx(), T0);
    expect(r.grade).toBe("D");
  });

  it("note une offre sans code ROME sur la seule voie textuelle", () => {
    const r = rankOffer(offre({
      source: "adzuna",
      title: "Webmaster",
      jobText: "Profil recherché : SEO et WordPress.",
      contractLabel: "CDI",
      salaryLabel: "35 k€",
      lat: 48.86, lng: 2.35,
    }), profilWeb, ctx(), T0);
    expect(r.score).toBeGreaterThan(0);
    expect(r.breakdown.find((l) => l.key === "hors_sujet")?.points ?? 0).toBe(0);
  });

  it("reste stable : deux appels donnent le même résultat", () => {
    const o = offre({ title: "Webmaster", romeCode: "M1855" });
    expect(rankOffer(o, profilWeb, ctx(), T0).score).toBe(rankOffer(o, profilWeb, ctx(), T0).score);
  });
});

describe("shouldPersist", () => {
  // Couture prévue pour un futur seuil de rejet réglable (spec §3.5).
  // Aujourd'hui : on garde tout.
  it("conserve toutes les offres, y compris les plus mauvaises", () => {
    const r = { score: 0, grade: "D" as const, breakdown: [] };
    expect(shouldPersist(r, EMPTY_PROFILE)).toBe(true);
  });
});

describe("DEFAULT_THRESHOLDS", () => {
  it("vaut 85 / 70 / 55 / 40", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/rank/index.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./index"`.

- [ ] **Step 3a : Écrire le module feuille `grade.ts`**

Créer `web/src/lib/jobs/grade.ts` :

```ts
/**
 * Lettres de classement, isolées de tout le reste.
 *
 * Ce module n'importe RIEN, volontairement : `db.ts`, `profile.ts` et `JobCard`
 * n'ont besoin que d'ici. S'ils importaient depuis `rank/`, ils tireraient
 * `rome.ts` et ses 835 Ko de référentiel dans le bundle de chaque page touchant
 * à Dexie.
 */

export type Grade = "S" | "A" | "B" | "C" | "D";

/** De la meilleure à la moins bonne — sert aux filtres d'affichage. */
export const GRADE_ORDER: Grade[] = ["S", "A", "B", "C", "D"];

export interface GradeThresholds {
  S: number;
  A: number;
  B: number;
  C: number;
}

export const DEFAULT_THRESHOLDS: GradeThresholds = { S: 85, A: 70, B: 55, C: 40 };

/** Traduit un score en lettre. Seuils inclusifs, du haut vers le bas. */
export function gradeOf(score: number, t: GradeThresholds = DEFAULT_THRESHOLDS): Grade {
  if (score >= t.S) return "S";
  if (score >= t.A) return "A";
  if (score >= t.B) return "B";
  if (score >= t.C) return "C";
  return "D";
}
```

- [ ] **Step 3b : Écrire l'orchestration**

Créer `web/src/lib/jobs/rank/index.ts` :

```ts
/**
 * Classement d'une offre : score sur 100 puis lettre.
 *
 * Entièrement local et déterministe — aucun appel réseau, aucune dépendance au
 * lot analysé. C'est cette dernière propriété qui rend les lettres ABSOLUES :
 * une offre en A aujourd'hui reste en A demain, condition pour filtrer et
 * comparer dans le temps (spec §3.1). C'est aussi ce qui exclut BM25, dont la
 * pondération se calcule sur le corpus courant.
 */

import type { JobOffer } from "../offer";
import type { JobSearchProfile } from "../profile";
import { buildRomeTargets } from "../rome";
import type { LatLng } from "../geo";
import {
  competencesPoints, metierPoints, distanceLigne, contratSalairePoints,
  experiencePoints, malusHorsSujet, malusSignaux,
  type Ligne, type RankContext,
} from "./criteria";

export type { Ligne, RankContext } from "./criteria";
export { MAX } from "./criteria";

// Réexport du module feuille : les modules qui classent réellement importent
// tout depuis `rank/`, ceux qui ne veulent que la lettre importent `grade.ts`.
export type { Grade, GradeThresholds } from "../grade";
export { GRADE_ORDER, DEFAULT_THRESHOLDS, gradeOf } from "../grade";

export interface RankResult {
  score: number;
  grade: Grade;
  breakdown: Ligne[];
}

/** Prépare le contexte une seule fois par scan (le référentiel ROME est lourd). */
export function buildRankContext(profile: JobSearchProfile, home: LatLng | null): RankContext {
  return { rome: buildRomeTargets(profile.romeCodes), home };
}

/**
 * Note une offre. `maintenant` est injecté pour que les tests restent
 * déterministes ; en production il vaut l'heure courante.
 */
export function rankOffer(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
  maintenant: number = Date.now(),
): RankResult {
  const breakdown: Ligne[] = [
    competencesPoints(offer, profile, ctx),
    metierPoints(offer, profile, ctx),
    distanceLigne(offer, profile, ctx),
    contratSalairePoints(offer, profile),
    experiencePoints(offer, profile),
    malusHorsSujet(offer, ctx),
    malusSignaux(offer, profile, maintenant),
  ];

  const brut = breakdown.reduce((t, l) => t + l.points, 0);
  const score = Math.max(0, Math.min(100, brut));

  return { score, grade: gradeOf(score, profile.gradeThresholds), breakdown };
}

/**
 * Point de passage unique de la décision « on enregistre ou pas ».
 *
 * Aujourd'hui : on garde TOUT. Le classement étant gratuit, plus rien ne
 * justifie de jeter une offre — c'est ce qui privait l'utilisateur de la
 * visibilité sur le volume réel de ses sources.
 *
 * Cette fonction existe pour qu'un futur seuil de rejet réglable s'y branche
 * sans réécriture (spec §3.5). Ne PAS y ajouter de logique tant que ce seuil
 * n'est pas demandé.
 */
export function shouldPersist(_result: RankResult, _profile: JobSearchProfile): boolean {
  return true;
}
```

- [ ] **Step 4 : Vérifier que le test échoue encore, pour la bonne raison**

```bash
cd web && npx vitest run src/lib/jobs/rank/index.test.ts
```

Attendu : ÉCHEC de compilation — `Property 'gradeThresholds' does not exist on
type 'JobSearchProfile'`. Le champ arrive à la tâche 9 ; c'est normal.

Pour débloquer immédiatement cette tâche, ajouter dès maintenant le champ au
profil (le schéma zod et l'UI suivront en tâche 9). Dans
`web/src/lib/jobs/profile.ts`, ajouter à l'interface `JobSearchProfile`, juste
après `minScore` :

```ts
  /** Seuils de conversion score → lettre. Réglables (décision §3.1). */
  gradeThresholds: GradeThresholds;
```

et l'import en tête du fichier — **depuis `./grade`, jamais depuis `./rank`** :

```ts
import { DEFAULT_THRESHOLDS, type GradeThresholds } from "./grade";
```

puis dans `EMPTY_PROFILE`, juste après `minScore: 70,` :

```ts
  gradeThresholds: DEFAULT_THRESHOLDS,
```

⚠️ `grade.ts` n'importe rien : aucun cycle possible, et le référentiel ROME
n'entre pas dans le bundle par ce chemin. Importer depuis `./rank` compilerait
mais tirerait les 835 Ko de `rome-competences.json` dans tout ce qui touche au
profil.

- [ ] **Step 5 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/rank/
```

Attendu : les 3 fichiers de `rank/` verts (text, criteria, index).

- [ ] **Step 6 : Vérifier que rien d'autre n'a cassé**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

Attendu : compilation propre, toute la suite verte. `EMPTY_PROFILE` ayant un
champ de plus, un test qui construirait un profil littéral sans `gradeThresholds`
échouerait — dans ce cas, c'est le test qui doit passer par
`{ ...EMPTY_PROFILE, ... }`. Le plan autorise cette adaptation précise, et elle
seule.

- [ ] **Step 7 : Commit**

```bash
git add web/src/lib/jobs/grade.ts web/src/lib/jobs/rank/index.ts web/src/lib/jobs/rank/index.test.ts web/src/lib/jobs/profile.ts
git commit -m "feat(offres): orchestration du classement et conversion en lettres

Score borné 0-100 puis lettre par seuils absolus réglables (85/70/55/40). Le
classement ne dépend jamais du lot analysé : c'est ce qui rend une lettre
stable dans le temps. shouldPersist isole la décision d'enregistrement pour
qu'un futur seuil de rejet s'y branche sans réécriture."
```

---

## Task 9 : Profil — seuils de lettres et codes ROME

**Files:**
- Modify: `web/src/lib/jobs/profileSchema.ts`
- Modify: `web/src/components/jobs/MetierInput.tsx`
- Test: `web/src/lib/jobs/profileSchema.test.ts` (ajouts)
- Test: `web/src/components/jobs/MetierInput.test.tsx` (ajouts)

**Interfaces:**
- Consumes: `GradeThresholds` (tâche 8).
- Produces : `profile.romeCodes` alimenté automatiquement ; `gradeThresholds`
  validé par le schéma.

**Contexte.** `MetierInput` reçoit `{ label, rome }` de l'autocomplétion et **jette
le code ROME** (`add(shortTerm(s.label))`). Sans lui, `buildRomeTargets` n'a
aucune cible et tout le volet structuré du classement est inerte.

- [ ] **Step 1 : Écrire les tests du schéma**

Ajouter à `web/src/lib/jobs/profileSchema.test.ts` :

```ts
describe("gradeThresholds", () => {
  it("complète un profil ancien avec les seuils par défaut", () => {
    const p = parseProfile({ keywords: ["webmaster"] });
    expect(p.gradeThresholds).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });

  it("conserve des seuils personnalisés valides", () => {
    const p = parseProfile({ gradeThresholds: { S: 90, A: 75, B: 60, C: 45 } });
    expect(p.gradeThresholds).toEqual({ S: 90, A: 75, B: 60, C: 45 });
  });

  it("retombe sur les défauts si les seuils sont invalides", () => {
    const p = parseProfile({ gradeThresholds: { S: "oui", A: 70, B: 55, C: 40 } });
    expect(p.gradeThresholds).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });

  it("retombe sur les défauts si les seuils ne décroissent pas", () => {
    const p = parseProfile({ gradeThresholds: { S: 40, A: 55, B: 70, C: 85 } });
    expect(p.gradeThresholds).toEqual({ S: 85, A: 70, B: 55, C: 40 });
  });
});
```

- [ ] **Step 2 : Écrire les tests de `MetierInput`**

Ajouter à `web/src/components/jobs/MetierInput.test.tsx` :

```ts
describe("MetierInput — code ROME", () => {
  afterEach(() => cleanup());

  it("remonte le code ROME de l'appellation choisie", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ results: [{ label: "Développeur / Développeuse web", rome: "M1855" }] }),
    }) as unknown as typeof fetch;

    const onChange = vi.fn();
    const onRomeAdd = vi.fn();
    render(<MetierInput values={[]} onChange={onChange} onRomeAdd={onRomeAdd} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Poste recherché" }), {
      target: { value: "developpeur" },
    });
    const suggestion = await screen.findByText("Développeur / Développeuse web");
    fireEvent.click(suggestion);

    expect(onRomeAdd).toHaveBeenCalledWith("M1855");
    expect(onChange).toHaveBeenCalled();
  });

  it("n'exige pas le rappel : la saisie libre reste possible sans code", () => {
    const onChange = vi.fn();
    render(<MetierInput values={[]} onChange={onChange} />);
    const champ = screen.getByRole("textbox", { name: "Poste recherché" });
    fireEvent.change(champ, { target: { value: "webmarketing" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["webmarketing"]);
  });
});
```

⚠️ Vérifier que `vi` est importé en tête du fichier de test ; l'ajouter à
l'import existant `{ describe, it, expect, vi, afterEach }` s'il manque.

- [ ] **Step 3 : Vérifier que les tests échouent**

```bash
cd web && npx vitest run src/lib/jobs/profileSchema.test.ts src/components/jobs/MetierInput.test.tsx
```

Attendu : ÉCHEC — `gradeThresholds` absent du schéma, et `onRomeAdd` inconnu.

- [ ] **Step 4 : Étendre le schéma**

Dans `web/src/lib/jobs/profileSchema.ts`, ajouter avant
`jobSearchProfileSchema` :

```ts
/**
 * Seuils score → lettre. Ils doivent décroître strictement, sinon deux lettres
 * deviendraient inatteignables : on retombe alors sur les défauts plutôt que
 * de laisser un classement incohérent.
 */
const gradeThresholdsSchema = z
  .object({
    S: z.number().int().min(0).max(100),
    A: z.number().int().min(0).max(100),
    B: z.number().int().min(0).max(100),
    C: z.number().int().min(0).max(100),
  })
  .refine((t) => t.S > t.A && t.A > t.B && t.B > t.C)
  .catch(EMPTY_PROFILE.gradeThresholds);
```

Puis ajouter dans l'objet `jobSearchProfileSchema`, juste après la ligne
`minScore: …` :

```ts
  gradeThresholds: gradeThresholdsSchema,
```

- [ ] **Step 5 : Conserver le code ROME dans `MetierInput`**

Dans `web/src/components/jobs/MetierInput.tsx`, modifier la signature du
composant :

```ts
export function MetierInput({
  values,
  onChange,
  onRomeAdd,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  /**
   * Remonte le code ROME de l'appellation officielle choisie. Sans lui, tout le
   * volet structuré du classement est inerte : `buildRomeTargets` n'a aucune
   * cible, donc ni bonus métier ni malus anti-bruit. Optionnel — la saisie
   * libre (Entrée) reste possible et n'a pas de code.
   */
  onRomeAdd?: (rome: string) => void;
}) {
```

Puis, dans le bouton de suggestion, remplacer le `onClick` :

```tsx
                <button type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onRomeAdd?.(s.rome); add(shortTerm(s.label)); }}>
```

- [ ] **Step 6 : Brancher le rappel dans `FilterBar`**

Dans `web/src/components/jobs/FilterBar.tsx`, autour de la ligne 63, remplacer :

```tsx
          <MetierInput
            values={profile.keywords}
            onChange={(k) => set("keywords", k)}
          />
```

par :

```tsx
          <MetierInput
            values={profile.keywords}
            onChange={(k) => set("keywords", k)}
            /* Le code ROME de l'appellation officielle alimente `romeCodes`, qui
               porte tout le volet structuré du classement. Sans lui, ni bonus
               métier ni malus anti-bruit. */
            onRomeAdd={(rome) =>
              set("romeCodes", profile.romeCodes.includes(rome)
                ? profile.romeCodes
                : [...profile.romeCodes, rome])
            }
          />
```

⚠️ `set` est le helper local de `FilterBar` (`set(cle, valeur)`), déjà utilisé
par les autres champs. Ne rien changer d'autre dans ce fichier.

- [ ] **Step 7 : Vérifier que les tests passent**

```bash
cd web && npx vitest run src/lib/jobs/profileSchema.test.ts src/components/jobs/MetierInput.test.tsx
```

Attendu : tous verts, y compris les 4 tests de repli déjà présents dans
`MetierInput.test.tsx`.

- [ ] **Step 8 : Commit**

```bash
git add web/src/lib/jobs/profileSchema.ts web/src/lib/jobs/profileSchema.test.ts web/src/components/jobs/MetierInput.tsx web/src/components/jobs/MetierInput.test.tsx web/src/components/jobs/FilterBar.tsx
git commit -m "feat(offres): seuils de lettres et conservation du code ROME

MetierInput jetait le code ROME de l'appellation choisie ; sans lui le volet
structuré du classement reste inerte. Les seuils de lettres sont validés et
retombent sur les défauts s'ils ne décroissent pas strictement."
```

---

## Task 10 : Dexie v10 — lettre, détail et caches

**Files:**
- Modify: `web/src/lib/storage/db.ts`
- Create: `web/src/lib/jobs/homeCoords.ts`
- Test: `web/src/lib/jobs/homeCoords.test.ts`

**Interfaces:**
- Consumes: `Grade`, `Ligne` (tâche 8), `LatLng` (tâche 3).
- Produces :
  ```ts
  // db.ts
  JobEntry.grade?: Grade
  JobEntry.breakdown?: Ligne[]
  export async function getCachedCommute(key: string): Promise<string | null>
  export async function setCachedCommute(key: string, text: string): Promise<void>
  export async function listJobsByGrade(min: Grade): Promise<JobEntry[]>
  // homeCoords.ts
  export function commuteCacheKey(home: string, dest: string, modes: string[]): string
  export async function geocodeHome(address: string): Promise<LatLng | null>
  ```

**Contexte.** Le géocodage passe par l'API Adresse de l'État
(`api-adresse.data.gouv.fr`), gratuite et sans authentification — c'est déjà
l'approche retenue pour l'autocomplétion de lieu, qui utilise `geo.api.gouv.fr`.
**Un seul appel par adresse, mis en cache** : à ne pas confondre avec les
354 appels Google Maps par scan que ce chantier supprime.

- [ ] **Step 1 : Écrire le test du géocodage**

Créer `web/src/lib/jobs/homeCoords.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { commuteCacheKey, geocodeHome } from "./homeCoords";

describe("commuteCacheKey", () => {
  it("est stable pour les mêmes entrées", () => {
    expect(commuteCacheKey("Paris", "48.86,2.35", ["transit", "walking"]))
      .toBe(commuteCacheKey("Paris", "48.86,2.35", ["transit", "walking"]));
  });

  it("ignore l'ordre des modes", () => {
    expect(commuteCacheKey("Paris", "48.86,2.35", ["walking", "transit"]))
      .toBe(commuteCacheKey("Paris", "48.86,2.35", ["transit", "walking"]));
  });

  it("arrondit la destination pour mutualiser les lieux voisins", () => {
    // 150 offres réelles → 107 lieux distincts : l'arrondi mutualise (spec §2.7).
    expect(commuteCacheKey("Paris", "48.8612,2.3501", ["transit"]))
      .toBe(commuteCacheKey("Paris", "48.8614,2.3499", ["transit"]));
  });

  it("distingue deux domiciles différents", () => {
    expect(commuteCacheKey("Paris", "48.86,2.35", ["transit"]))
      .not.toBe(commuteCacheKey("Lyon", "48.86,2.35", ["transit"]));
  });
});

describe("geocodeHome", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("renvoie null sur une adresse vide, sans appeler le réseau", async () => {
    const f = vi.fn();
    global.fetch = f as unknown as typeof fetch;
    expect(await geocodeHome("  ")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("lit les coordonnées de l'API Adresse", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { coordinates: [2.35, 48.86] } }] }),
    }) as unknown as typeof fetch;
    // L'API Adresse renvoie [longitude, latitude] — l'ordre GeoJSON, pas l'inverse.
    expect(await geocodeHome("10 rue de Rivoli, Paris")).toEqual({ lat: 48.86, lng: 2.35 });
  });

  it("renvoie null si aucune adresse ne correspond", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ features: [] }),
    }) as unknown as typeof fetch;
    expect(await geocodeHome("adresse introuvable")).toBeNull();
  });

  it("renvoie null sans faire échouer le scan en cas de panne réseau", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    expect(await geocodeHome("Paris")).toBeNull();
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/lib/jobs/homeCoords.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./homeCoords"`.

- [ ] **Step 3 : Écrire `homeCoords.ts`**

Créer `web/src/lib/jobs/homeCoords.ts` :

```ts
/**
 * Géocodage du domicile et clé de cache des trajets.
 *
 * Le géocodage passe par l'API Adresse de l'État : gratuite, sans clé, et
 * appelée UNE FOIS par adresse (le résultat est mis en cache par l'appelant).
 * À ne pas confondre avec les 354 appels Google Maps par scan que ce chantier
 * supprime (spec §2.7).
 */

import type { LatLng } from "./geo";

const ADRESSE_URL = "https://api-adresse.data.gouv.fr/search/";

/**
 * Clé de cache d'un temps de trajet. La destination est arrondie à ~1 km pour
 * mutualiser les lieux voisins : sur 150 offres réelles, 107 lieux distincts
 * seulement (spec §2.7).
 */
export function commuteCacheKey(home: string, dest: string, modes: string[]): string {
  const arrondi = dest.replace(/-?\d+\.\d+/g, (n) => Number(n).toFixed(2));
  return `${home.trim().toLowerCase()}|${arrondi}|${[...modes].sort().join(",")}`;
}

/** Coordonnées d'une adresse libre ; null si vide, introuvable ou réseau en panne. */
export async function geocodeHome(address: string): Promise<LatLng | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const res = await fetch(`${ADRESSE_URL}?q=${encodeURIComponent(q)}&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (!c || c.length < 2) return null;
    // GeoJSON : [longitude, latitude].
    return { lat: c[1], lng: c[0] };
  } catch {
    // Le géocodage est un confort : son échec ne doit pas faire échouer le scan.
    return null;
  }
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/lib/jobs/homeCoords.test.ts
```

Attendu : 9 tests verts.

- [ ] **Step 5 : Étendre Dexie**

Dans `web/src/lib/storage/db.ts` :

**a.** Ajouter aux imports en tête :

```ts
import { GRADE_ORDER, type Grade } from "@/lib/jobs/grade";
import type { Ligne } from "@/lib/jobs/rank/criteria";
```

⚠️ **Importer depuis `grade.ts` et `rank/criteria`, jamais depuis `rank/`.**
`db.ts` est importé par presque toute l'application ; passer par `rank/index.ts`
entraînerait `rome.ts` et ses 835 Ko de référentiel dans chaque bundle.
`criteria.ts` n'apporte que des types ici, effacés à la compilation.

**b.** Ajouter à l'interface `JobEntry`, avant l'accolade fermante :

```ts
  /** Lettre de classement. Absent = offre notée avant la bascule (score /100 seul). */
  grade?: Grade;
  /** Détail par critère, pour afficher le POURQUOI que l'IA ne fournissait pas. */
  breakdown?: Ligne[];
```

**c.** Déclarer la table de cache dans la classe, après `apiUsage` :

```ts
  commuteCache!: Table<{ key: string; text: string; at: number }, string>;
```

**d.** Ajouter la migration après le bloc `this.version(9)` :

```ts
    // v10 : classement par lettres. `grade` et `breakdown` sont optionnels — les
    // offres existantes gardent leur score /100 et leur lettre est dérivée à la
    // lecture (aucun rescan imposé, spec §6). Nouvelle table : cache des temps
    // de trajet, qui ramène Google Maps de 354 appels par scan à quelques-uns
    // par mois.
    this.version(10).stores({
      commuteCache: "key",
    });
```

**e.** Ajouter les fonctions à la fin de la section « JOBS API » :

```ts
/** Durée de validité du cache : un trajet entre deux points fixes ne bouge pas. */
const COMMUTE_TTL_MS = 30 * 24 * 3600 * 1000;

/** Temps de trajet mémorisé, ou null si absent/périmé. */
export async function getCachedCommute(key: string): Promise<string | null> {
  try {
    const row = await db.commuteCache.get(key);
    if (!row) return null;
    if (Date.now() - row.at > COMMUTE_TTL_MS) return null;
    return row.text;
  } catch (e) {
    console.warn("getCachedCommute error:", e);
    return null;
  }
}

export async function setCachedCommute(key: string, text: string): Promise<void> {
  try {
    await db.commuteCache.put({ key, text, at: Date.now() });
  } catch (e) {
    console.warn("setCachedCommute error:", e);
  }
}

/**
 * Offres retenues d'au moins la lettre `min`, meilleures d'abord.
 *
 * Toutes les offres sont désormais conservées (le classement est gratuit) :
 * c'est le filtre d'affichage, et non plus un rejet définitif, qui décide de ce
 * qu'on montre.
 */
export async function listJobsByGrade(min: Grade): Promise<JobEntry[]> {
  const plafond = GRADE_ORDER.indexOf(min);
  const all = await listJobs("new");
  return all.filter((j) => GRADE_ORDER.indexOf(j.grade ?? "D") <= plafond);
}
```

- [ ] **Step 6 : Vérifier la compilation et la suite complète**

```bash
cd web && npx tsc --noEmit && npx vitest run
```

Attendu : compilation propre, suite verte.

- [ ] **Step 7 : Commit**

```bash
git add web/src/lib/storage/db.ts web/src/lib/jobs/homeCoords.ts web/src/lib/jobs/homeCoords.test.ts
git commit -m "feat(offres): Dexie v10 — lettre, détail et cache des trajets

grade et breakdown sont optionnels : les offres existantes gardent leur score
et n'exigent aucun rescan. Le cache de trajets (clé arrondie à ~1 km, 30 jours)
ramène Google Maps de 354 appels par scan à quelques-uns par mois."
```

---

## Task 11 : Réécriture du scan

**Files:**
- Modify: `web/src/components/jobs/JobsView.tsx:22-33` (doc + type) et `:77-213` (`scan`)
- Test: `web/src/components/jobs/JobsView.scan.test.ts` (créé)

**Interfaces:**
- Consumes: `rankOffer`, `buildRankContext`, `shouldPersist` (tâche 8),
  `geocodeHome` (tâche 10), `listJobsByGrade` (tâche 10).
- Produces: `ScanState` sans le champ `scored`.

- [ ] **Step 1 : Écrire le test de l'enchaînement**

Créer `web/src/components/jobs/JobsView.scan.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { rankOffer, buildRankContext, shouldPersist } from "@/lib/jobs/rank";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import type { JobOffer } from "@/lib/jobs/offer";

/**
 * Vérifie la logique que `scan()` enchaîne, hors React : classer toutes les
 * offres, tout conserver, et trier du meilleur au moins bon.
 */

const T0 = Date.UTC(2026, 6, 28);

const offre = (p: Partial<JobOffer>): JobOffer => ({
  id: "x", source: "francetravail", title: "", company: "", location: "",
  commuteDestination: "", url: "", jobText: "", publishedAt: new Date(T0 - 86400e3).toISOString(),
  logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "", ...p,
});

const profil: JobSearchProfile = {
  ...EMPTY_PROFILE,
  keywords: ["webmaster"],
  romeCodes: ["M1855"],
  prefilterKeywords: ["seo", "wordpress"],
  contractTypes: ["CDI"],
};

describe("logique de scan", () => {
  const ctx = buildRankContext(profil, { lat: 48.85, lng: 2.35 });

  const lot = [
    offre({ id: "bon", title: "Webmaster", jobText: "Profil recherché : SEO, WordPress.",
      romeCode: "M1855", contractLabel: "CDI", salaryLabel: "35 k€", lat: 48.86, lng: 2.35 }),
    offre({ id: "bruit", title: "Conseiller formation webmaster", jobText: "Stagiaires.",
      romeCode: "K2101", contractLabel: "CDI", lat: 48.86, lng: 2.35 }),
    offre({ id: "hors", title: "Comptable", jobText: "Bilans.", romeCode: "M1203" }),
  ];

  it("classe toutes les offres sans en écarter aucune", () => {
    const notees = lot.map((o) => ({ o, r: rankOffer(o, profil, ctx, T0) }));
    expect(notees).toHaveLength(3);
    expect(notees.every(({ r }) => shouldPersist(r, profil))).toBe(true);
  });

  it("place l'offre pertinente devant le bruit et le hors-sujet", () => {
    const tri = lot
      .map((o) => ({ id: o.id, r: rankOffer(o, profil, ctx, T0) }))
      .sort((a, b) => b.r.score - a.r.score);
    expect(tri[0].id).toBe("bon");
    expect(tri[2].id).toBe("hors");
  });

  it("n'accorde jamais mieux que C au bruit de recherche", () => {
    const r = rankOffer(lot[1], profil, ctx, T0);
    expect(["C", "D"]).toContain(r.grade);
  });

  it("attache un détail lisible à chaque offre", () => {
    const r = rankOffer(lot[0], profil, ctx, T0);
    expect(r.breakdown.length).toBeGreaterThanOrEqual(5);
    expect(r.breakdown.every((l) => typeof l.label === "string" && l.label !== "")).toBe(true);
  });
});
```

- [ ] **Step 2 : Vérifier que le test passe déjà**

```bash
cd web && npx vitest run src/components/jobs/JobsView.scan.test.ts
```

Attendu : 4 tests verts — la logique existe depuis la tâche 8. Ce test verrouille
le comportement avant de toucher au composant.

- [ ] **Step 3 : Réécrire `scan()`**

Dans `web/src/components/jobs/JobsView.tsx` :

**a.** Remplacer les imports concernés :

```ts
import { listJobs, saveJob, markJobSeen, jobExists, setJobStatus, type JobEntry } from "@/lib/storage/db";
```

(retirer `saveExplored`, désormais inutile) et ajouter :

```ts
import { rankOffer, buildRankContext, shouldPersist } from "@/lib/jobs/rank";
import { geocodeHome } from "@/lib/jobs/homeCoords";
```

Retirer l'import devenu inutile :

```ts
import { relevance } from "@/lib/jobs/prefilter";
```

**b.** Remplacer le bloc de commentaire lignes 22-33 par :

```ts
/**
 * Orchestrateur du scan d'offres : `POST /api/jobs/search` → écarte les offres
 * déjà connues (Dexie) → **classe toutes les autres en local** → enregistre.
 *
 * Plus aucun appel réseau après la recherche : le classement est instantané et
 * gratuit (spec §2). C'est ce qui permet de lever les deux limites qui
 * n'existaient que pour contenir le coût de l'IA — le plafond d'offres notées et
 * le rejet définitif des offres sous le seuil.
 *
 * Le profil de recherche est chargé depuis Dexie, édité en direct (auto-save) et
 * envoyé dans le corps de la requête de recherche.
 */

export type ScanState = { phase: string; found: number; retained: number };
const ZERO: ScanState = { phase: "", found: 0, retained: 0 };
```

**c.** Remplacer tout le corps de `scan()` (lignes 77 à 213) par :

```ts
  async function scan(p: JobSearchProfile = profile) {
    setScanning(true);
    setConfigMsg(null);
    setProgress({ ...ZERO, phase: "Recherche des offres…" });
    try {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "config") setConfigMsg(data.message);
        else toast(data.error || "Échec de la recherche d'offres.", "error");
        return;
      }

      const offers: JobOffer[] = data.offers ?? [];

      // Compteur de quota : local et indicatif, il mesure ce que CE navigateur
      // a consommé, pas ce que le fournisseur a facturé.
      if (data.calls) {
        await bumpApiUsage(data.calls);
        setUsage(await getApiUsage());
      }

      // Une source en panne ne fait pas échouer la recherche : on le dit sans bloquer.
      const failed: SourceId[] = data.failed ?? [];
      if (failed.length > 0) {
        const names = failed.map((s: SourceId) => SOURCES.find((x) => x.id === s)?.label ?? s).join(", ");
        toast(`Source(s) indisponible(s) : ${names}. Les autres résultats sont affichés.`, "error");
      }

      // Écarter les offres déjà en base (dédoublonnage local).
      const fresh: JobOffer[] = [];
      for (const o of offers) {
        if (o.id && !(await jobExists(o.id))) fresh.push(o);
      }

      setProgress({ phase: "Classement des offres…", found: fresh.length, retained: 0 });

      // Une seule requête de géocodage pour tout le scan, et seulement si une
      // adresse est renseignée. Sans domicile, le critère de distance reste neutre.
      const home = await geocodeHome(p.homeAddress);
      const ctx = buildRankContext(p, home);
      const maintenant = Date.now();

      let retained = 0;
      for (const offer of fresh) {
        const result = rankOffer(offer, p, ctx, maintenant);
        if (!shouldPersist(result, p)) continue;
        await saveJob({
          id: offer.id,
          createdAt: maintenant,
          title: offer.title,
          company: offer.company,
          location: offer.location,
          commute: "", // calculé à la demande à l'ouverture de l'offre
          score: result.score,
          grade: result.grade,
          breakdown: result.breakdown,
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
        retained++;
      }

      setProgress({ phase: "Terminé", found: fresh.length, retained });
      await reload();
    } catch {
      toast("Erreur réseau pendant la recherche.", "error");
    } finally {
      setScanning(false);
    }
  }
```

- [ ] **Step 4 : Adapter `ScanProgress`**

Le champ `scored` a disparu de `ScanState`. Remplacer intégralement
`web/src/components/jobs/ScanProgress.tsx` par :

```tsx
import type { ScanState } from "./JobsView";

/** Barre de progression du scan : phase courante + compteurs (classées / trouvées). */
export default function ScanProgress({ phase, found, retained }: ScanState) {
  // Le classement conserve toutes les offres : `retained` suit donc l'avancement.
  const pct = found > 0 ? Math.round((retained / found) * 100) : 0;
  return (
    <div className="scan-progress" data-testid="scan-progress" role="status" aria-live="polite">
      <div className="scan-progress-bar">
        <div className="scan-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="scan-progress-text">
        {phase}
        {found > 0 ? ` · ${retained}/${found} classées` : ""}
      </div>
    </div>
  );
}
```

Si un test existant référence `scored`, l'adapter — le plan autorise cette
modification précise, et elle seule.

- [ ] **Step 5 : Vérifier**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Attendu : tout vert. Le test de `JobsView.scan.test.ts` reste vert.

- [ ] **Step 6 : Vérification manuelle dans le navigateur**

Lancer le serveur (`npm run dev`), aller sur `/jobs`, renseigner au moins un
poste via l'autocomplétion ROME, lancer une recherche. Contrôler dans l'onglet
**Réseau** :

- une seule requête `POST /api/jobs/search` ;
- **au plus une** requête vers `api-adresse.data.gouv.fr` ;
- **aucune** requête vers `/api/jobs/score` ;
- **aucune** requête vers `maps.googleapis.com`.

C'est le critère de succès n°1 et n°3 de la spec.

- [ ] **Step 7 : Commit**

```bash
git add web/src/components/jobs/JobsView.tsx web/src/components/jobs/JobsView.scan.test.ts web/src/components/jobs/ScanProgress.tsx
git commit -m "feat(offres): classement local de toutes les offres pendant le scan

Plus aucun appel réseau après la recherche. Le plafond d'offres notées et le
rejet définitif sous le seuil disparaissent : ils n'existaient que pour
contenir le coût de l'IA. Un seul géocodage par scan remplace les 354 appels
Google Maps."
```

---

## Task 12 : Suppression de la notation IA

**Files:**
- Delete: `web/src/lib/jobs/score.ts`, `web/src/lib/jobs/score.test.ts`
- Delete: `web/src/app/api/jobs/score/route.ts`, `web/src/app/api/jobs/score/route.test.ts`
- Modify: `web/src/lib/jobs/prefilter.ts` (conservé ou supprimé selon usage réel)

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Step 1 : Vérifier qu'aucun code vivant n'en dépend**

```bash
cd web && grep -rn "jobs/score\|scoreOffer\|from \"./score\"" src/ --include=*.ts --include=*.tsx
```

Attendu : uniquement les fichiers à supprimer. **Si un autre fichier apparaît,
s'arrêter et demander** — le plan ne prévoit pas ce cas.

- [ ] **Step 2 : Vérifier l'usage de `prefilter`**

```bash
cd web && grep -rn "prefilter\|relevance" src/ --include=*.ts --include=*.tsx
```

Le pré-tri servait à limiter le nombre d'appels IA. Sans IA, il n'a plus d'objet
— le classement note tout. **Si seul `prefilter.test.ts` le référence encore**,
supprimer les deux fichiers. Sinon, les laisser en place et le signaler dans le
rapport.

- [ ] **Step 3 : Supprimer**

```bash
cd web && git rm src/lib/jobs/score.ts src/lib/jobs/score.test.ts \
  src/app/api/jobs/score/route.ts src/app/api/jobs/score/route.test.ts
```

Puis, seulement si l'étape 2 l'a confirmé :

```bash
cd web && git rm src/lib/jobs/prefilter.ts src/lib/jobs/prefilter.test.ts
```

Retirer ensuite le dossier vide `src/app/api/jobs/score/` s'il subsiste.

- [ ] **Step 4 : Vérifier**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

Attendu : tout vert. Le nombre de tests diminue — c'est normal.

- [ ] **Step 5 : Commit**

```bash
git commit -m "refactor(offres): supprimer la notation IA

score.ts et la route /api/jobs/score ne sont plus appelés depuis que le
classement est local. Le pré-tri par mots-clés disparaît avec eux : il
n'existait que pour limiter le nombre d'appels IA."
```

---

## Task 13 : Affichage de la lettre et du détail

**Files:**
- Modify: `web/src/components/jobs/JobCard.tsx:48` et `:72-82`
- Modify: `web/src/components/jobs/ScoringInfo.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/components/jobs/JobCard.test.tsx` (créé ou complété)

**Interfaces:**
- Consumes: `JobEntry.grade`, `JobEntry.breakdown` (tâche 10), `gradeOf` (tâche 8).
- Produces: rien.

- [ ] **Step 1 : Écrire le test**

Créer (ou compléter) `web/src/components/jobs/JobCard.test.tsx` :

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import JobCard from "./JobCard";
import type { JobEntry } from "@/lib/storage/db";

const noop = () => {};
const entry = (p: Partial<JobEntry> = {}): JobEntry => ({
  id: "1", createdAt: 0, title: "Webmaster", company: "ACME", location: "Paris",
  commute: "", score: 78, url: "https://ex.fr", jobText: "", status: "new", ...p,
});

const carte = (e: JobEntry) => (
  <JobCard job={e} onAdapt={noop} onApply={noop} onTrack={noop} onDismiss={noop} onSeen={noop} />
);

describe("JobCard — lettre", () => {
  afterEach(() => cleanup());

  it("affiche la lettre plutôt que le score sur 100", () => {
    render(carte(entry({ grade: "A", score: 78 })));
    expect(screen.getByTestId("job-grade")).toHaveTextContent("A");
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });

  // Migration : les offres notées avant la bascule n'ont pas de lettre stockée.
  it("dérive la lettre du score pour les offres antérieures", () => {
    render(carte(entry({ score: 90, grade: undefined })));
    expect(screen.getByTestId("job-grade")).toHaveTextContent("S");
  });

  it("affiche le détail par critère quand il existe", () => {
    render(carte(entry({
      grade: "A",
      breakdown: [
        { key: "metier", label: "Métier", points: 20, max: 20, reason: "Développeur web (métier cible)" },
        { key: "distance", label: "Distance", points: 15, max: 15, reason: "8 km à vol d'oiseau" },
      ],
    })));
    expect(screen.getByTestId("job-why")).toHaveTextContent("Développeur web (métier cible)");
    expect(screen.getByTestId("job-why")).toHaveTextContent("8 km");
  });

  it("n'affiche aucun détail pour une offre antérieure", () => {
    render(carte(entry({ score: 78 })));
    expect(screen.queryByTestId("job-why")).not.toBeInTheDocument();
  });

  it("masque les lignes de malus sans motif", () => {
    render(carte(entry({
      grade: "A",
      breakdown: [
        { key: "metier", label: "Métier", points: 20, max: 20, reason: "cible" },
        { key: "signaux", label: "Signaux négatifs", points: 0, max: 0, reason: "" },
      ],
    })));
    expect(screen.getByTestId("job-why")).not.toHaveTextContent("Signaux négatifs");
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/components/jobs/JobCard.test.tsx
```

Attendu : ÉCHEC — `Unable to find an element by: [data-testid="job-grade"]`.

- [ ] **Step 3 : Modifier `JobCard`**

Dans `web/src/components/jobs/JobCard.tsx` :

**a.** Ajouter l'import — **depuis `grade.ts`**, pour ne pas tirer le référentiel
ROME dans le bundle de la carte :

```ts
import { gradeOf } from "@/lib/jobs/grade";
```

**b.** Remplacer la ligne 48 :

```ts
  // Les offres notées avant la bascule n'ont pas de lettre : on la dérive de
  // leur score, avec les mêmes seuils. Aucun rescan imposé (spec §6).
  const grade = job.grade ?? gradeOf(job.score);
  const lignes = (job.breakdown ?? []).filter((l) => l.reason !== "");
```

**c.** Remplacer le bloc `job-score` (lignes 72-82) par :

```tsx
        <div className="job-card__aside">
          <span className={`job-grade job-grade--${grade}`} title="Classement de l'offre"
            data-testid="job-grade">
            {grade}
          </span>
          {job.seen === false ? (
            <span className="job-new" data-testid="job-new">Nouveau</span>
          ) : date ? (
            <span className="job-date">{date}</span>
          ) : null}
        </div>
```

**d.** Juste après le bloc `job-facts` (après sa balise fermante `</div>`),
ajouter :

```tsx
      {lignes.length > 0 ? (
        <ul className="job-why" data-testid="job-why">
          {lignes.map((l) => (
            <li key={l.key} className={l.points < 0 ? "job-why__item job-why__item--malus" : "job-why__item"}>
              <span className="job-why__label">{l.label}</span>
              <span className="job-why__reason">{l.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
```

- [ ] **Step 4 : Ajouter les styles**

Dans `web/src/app/globals.css`, à la suite des règles `.job-score*` existantes
(qu'on **supprime**, plus aucun code ne les utilise) :

```css
/* Classement en lettres. Remplace le score /100, qui affichait une précision
   que la notation IA n'a jamais eue. */
.job-grade {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border-radius: 9px;
  font-family: var(--font-ui);
  font-weight: 800;
  font-size: 15px;
  line-height: 1;
  color: var(--bg);
  background: var(--text);
}
.job-grade--S { background: var(--orange-text); }
.job-grade--A { background: var(--text); }
.job-grade--B { background: var(--muted); }
.job-grade--C,
.job-grade--D { color: var(--text); background: var(--line); }

.job-why {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.job-why__item {
  display: inline-flex;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}
.job-why__label { font-weight: 600; }
.job-why__label::after { content: " :"; }
.job-why__item--malus .job-why__reason { color: var(--orange-text); }
```

⚠️ Vérifier que `--orange-text`, `--muted` et `--line` existent bien dans le
fichier ; sinon, utiliser les variables réellement définies. Aucune couleur en
dur.

- [ ] **Step 5 : Mettre à jour `ScoringInfo`**

Dans `web/src/components/jobs/ScoringInfo.tsx`, remplacer le paragraphe
d'introduction et le pied :

```tsx
        <p>
          Les offres sont classées par un algorithme local, sans IA : instantané,
          gratuit, et surtout reproductible — une même offre obtient toujours la
          même lettre. Chaque carte indique le détail qui a produit sa note.
        </p>
```

et remplacer le bloc `scoring-info__threshold` par :

```tsx
        <p className="scoring-info__threshold">
          Lettres : <strong>S</strong> à partir de {thresholds.S}, <strong>A</strong> à
          partir de {thresholds.A}, <strong>B</strong> à partir de {thresholds.B},{" "}
          <strong>C</strong> à partir de {thresholds.C}, <strong>D</strong> en dessous.
        </p>
```

Adapter la signature du composant :

```tsx
import type { GradeThresholds } from "@/lib/jobs/grade";

type Criterion = { label: string; max: number; description: string };

export default function ScoringInfo({
  criteria,
  thresholds,
}: {
  criteria: Criterion[];
  thresholds: GradeThresholds;
}) {
```

Puis, dans `JobsView.tsx`, remplacer la propriété passée au composant :
`minScore={profile.minScore}` devient `thresholds={profile.gradeThresholds}`.

- [ ] **Step 6 : Aligner la grille affichée**

Toujours dans `JobsView.tsx`, la grille vient de `profile.scoringCriteria`, qui
décrit encore l'ancien barème IA. La remplacer par le barème réel :

```tsx
          criteria={[
            { label: "Compétences & missions", max: 45, description: "Ce que la description dit vraiment des missions et des compétences attendues." },
            { label: "Métier", max: 20, description: "Code métier officiel de l'offre et intitulé du poste." },
            { label: "Distance", max: 15, description: "Distance à vol d'oiseau depuis ton adresse." },
            { label: "Contrat & salaire", max: 10, description: "Type de contrat voulu et salaire annoncé." },
            { label: "Expérience", max: 10, description: "Expérience exigée face à ton niveau." },
            { label: "Malus", max: 0, description: "Métier hors-sujet (−20) et signaux négatifs (−15)." },
          ]}
```

- [ ] **Step 7 : Vérifier**

```bash
cd web && npx vitest run src/components/jobs/JobCard.test.tsx && npx tsc --noEmit && npm run lint && npm run build && npx playwright test
```

Attendu : tout vert. Si un e2e échoue bizarrement, appliquer le remède Turbopack
du cadrage (supprimer `web/.next`, vérifier qu'aucun serveur ne traîne sur le
port 3000, relancer).

- [ ] **Step 8 : Commit**

```bash
git add web/src/components/jobs/JobCard.tsx web/src/components/jobs/JobCard.test.tsx web/src/components/jobs/ScoringInfo.tsx web/src/components/jobs/JobsView.tsx web/src/app/globals.css
git commit -m "feat(offres): afficher la lettre et le détail du classement

La carte montre le POURQUOI que la notation IA ne fournissait pas. Les offres
antérieures voient leur lettre dérivée de leur score, sans rescan. Les règles
CSS .job-score, devenues mortes, sont supprimées."
```

---

## Task 14 : Temps de trajet à la demande

**Files:**
- Modify: `web/src/components/jobs/JobCard.tsx`
- Modify: `web/src/components/jobs/JobsView.tsx`
- Create: `web/src/app/api/jobs/commute/route.ts`
- Test: `web/src/app/api/jobs/commute/route.test.ts`

**Interfaces:**
- Consumes: `getCommuteTimes`/`commuteSummary` (`lib/jobs/maps.ts`, inchangé),
  `getCachedCommute`/`setCachedCommute`/`commuteCacheKey` (tâche 10).
- Produces: `POST /api/jobs/commute` → `{ commuteText: string }`.

**Contexte.** `maps.ts` reste en place. Ce qui change, c'est **quand** on
l'appelle : à l'ouverture d'une offre, pas pendant le scan. Avec le cache, on
passe de 354 appels facturés par scan (jusqu'à 162 $/mois) à quelques dizaines
par mois, sous le palier gratuit de 5 000 (spec §2.7).

- [ ] **Step 1 : Écrire le test de la route**

Créer `web/src/app/api/jobs/commute/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const req = (body: unknown) =>
  new Request("http://localhost/api/jobs/commute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/jobs/commute", () => {
  const OLD = process.env.GOOGLE_MAPS_API_KEY;
  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = "cle-test"; });
  afterEach(() => { process.env.GOOGLE_MAPS_API_KEY = OLD; vi.restoreAllMocks(); });

  it("refuse un corps JSON invalide", async () => {
    const r = await POST(new Request("http://localhost/api/jobs/commute", { method: "POST", body: "{" }));
    expect(r.status).toBe(400);
  });

  it("refuse une destination manquante", async () => {
    const r = await POST(req({ profile: {} }));
    expect(r.status).toBe(400);
  });

  it("signale l'absence de clé Maps sans planter", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const r = await POST(req({ destination: "48.86,2.35", profile: {} }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe("config");
  });

  it("renvoie le résumé de trajet", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [{ elements: [{ status: "OK", duration: { text: "22 min" } }] }] }),
    }) as unknown as typeof fetch;

    const r = await POST(req({
      destination: "48.86,2.35",
      profile: { homeAddress: "Paris", commuteModes: ["transit"] },
    }));
    expect(r.status).toBe(200);
    expect((await r.json()).commuteText).toContain("22 min");
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
cd web && npx vitest run src/app/api/jobs/commute/route.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./route"`.

- [ ] **Step 3 : Écrire la route**

Créer `web/src/app/api/jobs/commute/route.ts` :

```ts
import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/jobs/resolveProfile";
import { getCommuteTimes, commuteSummary } from "@/lib/jobs/maps";

// Google Maps (fetch) : runtime Node.js.
export const runtime = "nodejs";

/**
 * Temps de trajet d'UNE offre, à la demande.
 *
 * Appelée à l'ouverture d'une offre, jamais pendant le scan : le scan en
 * émettait 354 par passage, soit jusqu'à 162 $/mois et 30 à 45 s de latence
 * (spec §2.7). Le client met le résultat en cache 30 jours.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { destination?: string; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    return NextResponse.json({ error: "Destination manquante." }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "config", message: "Configurez GOOGLE_MAPS_API_KEY pour calculer les trajets." },
      { status: 400 },
    );
  }

  const profile = resolveProfile(body);
  const commute = await getCommuteTimes(destination, profile, key);
  return NextResponse.json({ commuteText: commuteSummary(commute) });
}
```

- [ ] **Step 4 : Vérifier que le test passe**

```bash
cd web && npx vitest run src/app/api/jobs/commute/route.test.ts
```

Attendu : 4 tests verts.

- [ ] **Step 5 : Brancher le calcul dans `JobsView`**

Dans `web/src/components/jobs/JobsView.tsx`, ajouter les imports :

```ts
import { getCachedCommute, setCachedCommute } from "@/lib/storage/db";
import { commuteCacheKey } from "@/lib/jobs/homeCoords";
```

Puis ajouter la fonction, à côté de `reload()` :

```ts
  /**
   * Temps de trajet d'une offre, calculé au premier affichage puis mémorisé.
   * Le cache est la raison pour laquelle on peut se permettre l'appel : sans
   * lui, ce serait 354 appels facturés par scan (spec §2.7).
   */
  async function loadCommute(job: JobEntry): Promise<string> {
    const dest = job.location;
    if (!dest) return "";
    const key = commuteCacheKey(profile.homeAddress, dest, profile.commuteModes);
    const cached = await getCachedCommute(key);
    if (cached !== null) return cached;
    try {
      const res = await fetch("/api/jobs/commute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: dest, profile }),
      });
      if (!res.ok) return "";
      const { commuteText } = (await res.json()) as { commuteText?: string };
      const text = commuteText ?? "";
      if (text) await setCachedCommute(key, text);
      return text;
    } catch {
      return "";
    }
  }
```

⚠️ `job.location` est le libellé lisible. Pour les offres France Travail, la
destination précise vit dans `commuteDestination`, qui **n'est pas stocké** dans
`JobEntry`. Utiliser `job.location` est donc correct ici et suffisant pour
Google Maps, qui accepte un libellé.

Passer enfin `onCommute={loadCommute}` à `<JobCard>`.

- [ ] **Step 6 : Afficher le trajet dans `JobCard`**

Dans `web/src/components/jobs/JobCard.tsx`, ajouter la propriété :

```ts
  /** Calcule le trajet à la demande (premier dépliage de l'offre). */
  onCommute?: (job: JobEntry) => Promise<string>;
```

Ajouter l'état et le déclencheur :

```ts
  const [commute, setCommute] = useState(job.commute);

  // Le trajet réel n'est calculé qu'au dépliage : un appel Google Maps est
  // facturé, on ne le dépense que si l'offre intéresse vraiment.
  useEffect(() => {
    if (!open || commute || !onCommute) return;
    let vivant = true;
    void onCommute(job).then((t) => { if (vivant) setCommute(t); });
    return () => { vivant = false; };
  }, [open, commute, onCommute, job]);
```

(ajouter `useEffect` à l'import `react`).

Puis, dans le bloc `job-facts`, remplacer la condition sur `job.commute` par :

```tsx
        {commute ? (
          <span className="job-fact job-fact--commute"><Icon path={TRAIN} />{commute}</span>
        ) : null}
```

- [ ] **Step 7 : Vérifier**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

Attendu : tout vert.

- [ ] **Step 8 : Vérification manuelle**

Sur `/jobs`, déplier une offre : le trajet apparaît après un court instant.
Replier puis déplier à nouveau, et déplier une offre au même endroit : **aucune
nouvelle requête** vers `/api/jobs/commute` dans l'onglet Réseau (cache).

- [ ] **Step 9 : Commit**

```bash
git add web/src/app/api/jobs/commute/ web/src/components/jobs/JobCard.tsx web/src/components/jobs/JobsView.tsx
git commit -m "feat(offres): temps de trajet calculé à la demande, avec cache

Google Maps n'est plus appelé pendant le scan mais au dépliage d'une offre, et
le résultat est mémorisé 30 jours avec une clé arrondie à ~1 km. On passe de
354 appels facturés par scan à quelques dizaines par mois."
```

---

## Task 15 : Vérification finale et documentation

**Files:**
- Modify: `PROJECT_INDEX.md`
- Modify: `WORK_HISTORY.md`

- [ ] **Step 1 : Suite complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

Coller la sortie intégrale dans le rapport. Tout doit être vert.

- [ ] **Step 2 : Vérifier les critères de succès de la spec**

Sur `/jobs`, avec un profil réel (au moins un poste choisi via l'autocomplétion
ROME), lancer une recherche et contrôler :

| # | Critère | Comment le vérifier |
|---|---|---|
| 1 | Aucun appel réseau après la recherche | Onglet Réseau : seulement `POST /api/jobs/search` et au plus un `api-adresse.data.gouv.fr` |
| 2 | Classement < 1 s | La phase « Classement des offres… » ne doit pas être perceptible |
| 3 | Zéro appel Google Maps pendant le scan | Aucune requête `maps.googleapis.com` |
| 4 | Le bruit ne remonte pas | Avec un profil web : aucune offre « conseiller en formation » au-dessus de C |
| 5 | Le hors-sujet reste en bas | Chercher « comptable » avec un profil web : rien au-dessus de D |

Consigner le résultat de chaque ligne dans le rapport. **Si le critère 4 ou 5
échoue**, ne pas ajuster les pondérations sans le signaler : c'est une décision
produit, pas un correctif technique. S'arrêter et demander.

- [ ] **Step 3 : Mettre à jour `PROJECT_INDEX.md`**

Dans la section « Fonctionnalité Offres », remplacer la description du scoring
IA par :

```markdown
Les offres sont classées **en local, sans IA** : `lib/jobs/rank/` note chaque
offre sur 100 (compétences & missions 45, métier 20, distance 15, contrat &
salaire 10, expérience 10, malus hors-sujet −20 et signaux négatifs −15), puis
traduit le score en lettre S/A/B/C/D par des seuils absolus réglables. Le
classement ne dépend jamais du lot analysé : une lettre reste stable dans le
temps.

Deux voies par critère : les champs structurés de France Travail (`romeCode`,
`competences` codifiées) et l'analyse du texte pour toutes les sources, pour le
même nombre de points — sans quoi les offres France Travail seraient
systématiquement avantagées.

Le référentiel ROME 4.0 est embarqué (`lib/jobs/data/`, régénérable par
`scripts/build-rome.mjs`). Le code ROME sert surtout de filtre anti-bruit.

Google Maps n'est plus appelé pendant le scan (c'était 354 appels facturés par
passage) mais au dépliage d'une offre, avec un cache de 30 jours.

Conception détaillée et mesures :
`docs/superpowers/specs/2026-07-28-notation-lettres-design.md`.
```

Mettre également à jour la liste des fichiers de `lib/jobs/` pour y faire
figurer `rank/`, `rome.ts`, `geo.ts`, `homeCoords.ts`, et retirer `score.ts` et
`prefilter.ts` s'il a été supprimé.

- [ ] **Step 4 : Journal**

Ajouter l'entrée de fin de chantier en tête de la section `## Journal` de
`WORK_HISTORY.md`, et mettre à jour « Prochaine étape suggérée » avec :
« Phase 2 du classement : embeddings pour les sources hors France Travail
(spec à écrire après usage réel de la phase 1). »

- [ ] **Step 5 : Commit**

```bash
git add PROJECT_INDEX.md WORK_HISTORY.md
git commit -m "docs: classement des offres en lettres, sans IA"
```

- [ ] **Step 6 : Rapport final**

Produire le rapport au format imposé par `web/CADRAGE_EXECUTION.md` §5, une
section par tâche, suivi de « Points sur lesquels je me suis arrêté pour
demander » (même vide).

**Rappel : ne pas pousser.** Le push est fait par l'humain.

---

## Ce que ce plan ne fait pas

- **Les embeddings** (phase 2). Les sources hors France Travail restent notées
  au texte seul, soit ~52 % du volume. Spec distinct à écrire après usage réel.
- **Le seuil de rejet réglable.** La couture `shouldPersist` existe ; la
  fonctionnalité n'est pas construite (décision §3.5).
- **L'analyse IA à la demande sur une offre.** Non retenue à ce stade.
- **Le filtre d'affichage par lettre.** `listJobsByGrade` est en place mais
  `JobsView` continue d'afficher toutes les offres retenues. Ajouter le
  sélecteur d'UI est un chantier distinct, volontairement laissé de côté pour ne
  pas mélanger le moteur de classement et l'ergonomie de la liste.

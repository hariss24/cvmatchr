# Optimisation de profil LinkedIn — Plan d'implémentation

> **Pour les agents d'exécution :** ce plan se lit avec `web/CADRAGE_EXECUTION.md`
> (le contrat, qui prime en cas de conflit), `.agents/rules/cadrage.md` et
> `docs/superpowers/specs/2026-08-02-linkedin-optimisation-design.md` (la spec, qui
> justifie chaque choix — notamment pourquoi ce chantier réutilise `lib/ats/engine.ts`
> au lieu d'un moteur neuf, et pourquoi il ne couvre que l'analyse d'un texte collé,
> jamais un import automatique du profil). Les étapes utilisent des cases à cocher
> (`- [ ]`) pour le suivi.

**But :** ajouter une page `/linkedin` où coller le titre et le corps (à-propos +
expériences) de son profil LinkedIn, avec en option une offre visée, pour obtenir un
score local instantané (4 axes pondérés, réutilisant le moteur ATS existant) et des
suggestions IA optionnelles (accroches réécrites, corrections prioritaires).

**Architecture :** deux petites extractions préparatoires côté `src/lib/ats/` et
`src/components/modals/AtsPanel.tsx` (rendre réutilisable ce qui existe déjà), puis un
nouveau domaine `src/lib/linkedin/`, une nouvelle route IA `/api/linkedin-score`, et
une nouvelle page `app/linkedin/`.

**Stack :** TypeScript strict, aucune dépendance npm ajoutée.

## Contraintes globales

Ces règles s'appliquent à **toutes** les tâches, sans être répétées à chaque fois.

- **Aucune dépendance npm ajoutée ou mise à jour.**
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.** TypeScript
  strict doit compiler.
- **Jamais `alert`/`confirm`/`prompt` natifs** → `toast`/`uiConfirm` de
  `@/state/uiStore`.
- **Jamais de couleur en dur** dans le CSS ajouté → variables de thème. En pratique,
  ce chantier ne devrait ajouter **aucun** CSS neuf : toutes les classes nécessaires
  (`.ats-*`, `.form-input`, `.form-textarea`, `.pane`, `.pack-page`, `.pack-hint`,
  `.topbar--secondary`, `.hist-h1`, `.btn-nav`, `.wrap`) existent déjà dans
  `web/src/app/globals.css`, utilisées par `AtsPanel.tsx`/`ProfileView.tsx`/
  `ImportTextModal.tsx`.
- **PUSH STRICTEMENT INTERDIT sur `main`.** Travaille sur une branche `claude/…`.
  Commit local par tâche.
- **Vérification après CHAQUE tâche**, depuis `web/`, dans cet ordre, sortie collée
  dans le rapport :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  ```
- **Une vérification rouge = tâche NON LIVRÉE.** On corrige avant de continuer.
- **Régression surveillée** : `src/lib/ats/engine.test.ts` et
  `src/app/api/ats-score/route.test.ts` doivent rester verts après les Tasks 1
  (extraction) — ils vérifient que rien n'a changé de comportement, seulement de
  fichier.
- **Journal obligatoire** après chaque tâche : entrée datée en tête de la section
  `## Journal` de `WORK_HISTORY.md` (racine) + mise à jour de la ligne
  « Prochaine étape suggérée ».

---

## Vue d'ensemble des fichiers

| Fichier | Sort |
|---|---|
| `web/src/lib/ats/engine.ts` | Modifié — export `contains`/`normalize`, `AtsAxisKey` élargi |
| `web/src/lib/ai/coerceAi.ts` | **Créé** — coercions partagées |
| `web/src/app/api/ats-score/route.ts` | Modifié — importe depuis `coerceAi.ts` |
| `web/src/components/shared/ScoreReportParts.tsx` | **Créé** — composants d'affichage partagés |
| `web/src/components/modals/AtsPanel.tsx` | Modifié — utilise `ScoreReportParts.tsx` |
| `web/src/lib/linkedin/engine.ts` | **Créé** — moteur local LinkedIn |
| `web/src/lib/linkedin/engine.test.ts` | **Créé** |
| `web/src/lib/ai/prompts.ts` | Modifié — `SYSTEM_LINKEDIN_SCORE` |
| `web/src/app/api/linkedin-score/route.ts` | **Créé** |
| `web/src/app/api/linkedin-score/route.test.ts` | **Créé** |
| `web/src/app/linkedin/page.tsx` | **Créé** |
| `web/src/components/linkedin/LinkedInView.tsx` | **Créé** |
| `web/src/components/layout/UserMenu.tsx` | Modifié — lien vers `/linkedin` |
| `PROJECT_INDEX.md` | Modifié — nouvelle section courte |

---

## Task 1 : rendre réutilisable ce qui existe déjà (aucun changement de comportement)

**Files:**
- Modify: `web/src/lib/ats/engine.ts`
- Create: `web/src/lib/ai/coerceAi.ts`
- Modify: `web/src/app/api/ats-score/route.ts`
- Create: `web/src/components/shared/ScoreReportParts.tsx`
- Modify: `web/src/components/modals/AtsPanel.tsx`

**Contexte.** Cette tâche ne change AUCUN comportement observable : elle déplace et
exporte du code déjà écrit et déjà testé, pour que Task 2-4 puissent le réutiliser
sans dupliquer ~300 lignes (lexique de compétences, stop-words, coercition JSON,
affichage du rapport). Spec §4.4, §4.6, §4.7.

- [ ] **Step 1 : `web/src/lib/ats/engine.ts` — exporter `contains`/`normalize`, élargir `AtsAxisKey`**

Changer :
```ts
function normalize(text: string): string {
```
en :
```ts
export function normalize(text: string): string {
```

Changer :
```ts
function contains(haystack: string, term: string): boolean {
```
en :
```ts
export function contains(haystack: string, term: string): boolean {
```

Changer :
```ts
export type AtsAxisKey = "keywords" | "structure" | "impact" | "fit";
```
en :
```ts
export type AtsAxisKey = "keywords" | "structure" | "impact" | "fit" | "title" | "completeness";
```

Aucun autre changement dans ce fichier — les deux fonctions gardent exactement leur
implémentation actuelle, seule leur visibilité change.

- [ ] **Step 2 : `web/src/lib/ai/coerceAi.ts` (nouveau)**

Contenu = `coerceRequirements`/`coercePriorities`, copiées **sans modification**
depuis `web/src/app/api/ats-score/route.ts` (voir Step 3 pour leur suppression de ce
fichier), plus une nouvelle fonction `coerceTitleSuggestions` :

```ts
import type { Requirement, Priority } from "@/lib/ats/engine";

const str = (v: unknown, max = 400): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Ne garde que les exigences exploitables : un libellé court, un type connu. */
export function coerceRequirements(value: unknown): Requirement[] {
  if (!Array.isArray(value)) return [];
  const out: Requirement[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const term = str(r.term, 80);
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push({
      term,
      kind: r.kind === "nice" ? "nice" : "hard",
      present: r.present === true,
      evidence: str(r.evidence, 300),
    });
    if (out.length >= 25) break;
  }
  return out;
}

export function coercePriorities(value: unknown): Priority[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      title: str(p.title, 120),
      problem: str(p.problem),
      fix: str(p.fix),
      example: str(p.example, 600),
      zone: str(p.zone, 40),
    }))
    .filter((p) => p.title)
    .slice(0, 3);
}

/** Accroches suggérées (LinkedIn) : chaînes non vides, tronquées, dédupliquées. */
export function coerceTitleSuggestions(value: unknown, max = 3): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const s = item.trim().slice(0, 220);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
    if (out.length >= max) break;
  }
  return out;
}
```

- [ ] **Step 3 : `web/src/app/api/ats-score/route.ts` — importer depuis `coerceAi.ts`**

Retirer les définitions locales de `str`, `coerceRequirements`, `coercePriorities` et
ajouter :
```ts
import { coerceRequirements, coercePriorities } from "@/lib/ai/coerceAi";
```

Le reste du fichier (la fonction `POST`) reste **identique**.

- [ ] **Step 4 : `web/src/components/shared/ScoreReportParts.tsx` (nouveau)**

Extrait de `AtsPanel.tsx` : `Pills`, `Axes`, `Priorities`, la fonction `scoreClass`,
et un nouveau composant `SectionBadges` qui reprend le bloc JSX « Sections détectées »
actuellement inline dans `AtsPanel.tsx`.

```tsx
"use client";

import type { AtsReport, Priority } from "@/lib/ats/engine";

/** Couleur selon le score — partagée par tous les rapports de score (ATS, LinkedIn). */
export const scoreClass = (s: number): string => (s >= 70 ? "ats-ok" : s >= 45 ? "ats-mid" : "ats-low");

export function Pills({ items, kind }: { items: string[]; kind: string }) {
  if (!items.length) return null;
  return (
    <div className="ats-pills">
      {items.map((k, i) => (
        <span key={i} className={`ats-pill ${kind}`}>
          {k}
        </span>
      ))}
    </div>
  );
}

export function Axes({ axes }: { axes: AtsReport["axes"] }) {
  return (
    <div className="ats-axes">
      {axes.map((a) => (
        <div key={a.key} className="ats-axis">
          <div className="ats-axis-head">
            <span className="ats-axis-label">{a.label}</span>
            <span className="ats-axis-weight">Poids {a.weight} %</span>
            <span className={`ats-axis-score ${scoreClass(a.score)}`}>{a.score}</span>
          </div>
          <div className="ats-axis-bar">
            <div className={`ats-axis-fill ${scoreClass(a.score)}`} style={{ width: `${a.score}%` }} />
          </div>
          <p className="ats-axis-hint">{a.hint}</p>
        </div>
      ))}
    </div>
  );
}

export function Priorities({ items }: { items: Priority[] }) {
  if (!items.length) return null;
  return (
    <>
      <div className="ats-keywords-title">Corrections prioritaires</div>
      <ol className="ats-priorities">
        {items.map((p, i) => (
          <li key={i} className="ats-priority">
            <div className="ats-priority-head">
              <span className="ats-priority-title">{p.title}</span>
              {p.zone ? <span className="ats-priority-zone">{p.zone}</span> : null}
            </div>
            {p.problem ? <p className="ats-priority-text">{p.problem}</p> : null}
            {p.fix ? <p className="ats-priority-text">{p.fix}</p> : null}
            {p.example ? <p className="ats-priority-example">{p.example}</p> : null}
          </li>
        ))}
      </ol>
    </>
  );
}

export function SectionBadges({ sections }: { sections: Record<string, boolean> }) {
  return (
    <>
      <div className="ats-keywords-title">Sections détectées</div>
      <div className="ats-sections">
        {Object.entries(sections).map(([name, ok]) => (
          <span key={name} className={`ats-section-badge ${ok ? "found" : "missing"}`}>
            {ok ? "✓" : "✗"} {name}
          </span>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 5 : `web/src/components/modals/AtsPanel.tsx` — utiliser les composants partagés**

Retirer les définitions locales de `scoreClass`, `Pills`, `Axes`, `Priorities`.
Ajouter :
```ts
import { scoreClass, Pills, Axes, Priorities, SectionBadges } from "@/components/shared/ScoreReportParts";
```

Remplacer le bloc JSX actuel :
```tsx
          <div className="ats-keywords-title">Sections détectées</div>
          <div className="ats-sections">
            {Object.entries(report.sections).map(([name, ok]) => (
              <span key={name} className={`ats-section-badge ${ok ? "found" : "missing"}`}>
                {ok ? "✓" : "✗"} {name}
              </span>
            ))}
          </div>
```
par :
```tsx
          <SectionBadges sections={report.sections} />
```

Tout le reste de `AtsPanel.tsx` (logique de `runAi`, `derniere`, `inputs`, le JSX
englobant) reste **identique** — seul l'affichage est désormais importé.

- [ ] **Step 6 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Attendu : tout vert, y compris `src/lib/ats/engine.test.ts` et
`src/app/api/ats-score/route.test.ts` (comportement inchangé — c'est le test de
régression de cette tâche). Vérifier aussi manuellement (`npm run dev`) que le
panneau ATS (`/pack` → modale d'adaptation → onglet ATS) s'affiche et fonctionne
comme avant.

- [ ] **Step 7 : Commit**

```bash
git add web/src/lib/ats/engine.ts web/src/lib/ai/coerceAi.ts web/src/app/api/ats-score/route.ts web/src/components/shared/ScoreReportParts.tsx web/src/components/modals/AtsPanel.tsx
git commit -m "refactor(ats): extraire coercition IA et affichage du rapport pour réutilisation

Aucun changement de comportement : contains/normalize exportées, AtsAxisKey élargi
(title/completeness), coerceRequirements/coercePriorities déplacées dans
lib/ai/coerceAi.ts, et les sous-composants d'affichage du rapport ATS (Axes, Pills,
Priorities, SectionBadges) extraits dans components/shared/ScoreReportParts.tsx.
Prépare le chantier d'optimisation LinkedIn (spec 2026-08-02) qui réutilise ces
briques au lieu de les dupliquer."
```

---

## Task 2 : `src/lib/linkedin/engine.ts` — moteur local

**Files:**
- Create: `web/src/lib/linkedin/engine.ts`
- Create: `web/src/lib/linkedin/engine.test.ts`

**Interfaces:**
```ts
// web/src/lib/linkedin/engine.ts
export function analyzeLinkedInProfile(titleText: string, bodyText: string, jobDesc?: string): AtsReport;
export function analyzeLinkedInWithRequirements(
  titleText: string,
  bodyText: string,
  requirements: Requirement[],
  jobDescProvided?: boolean,
): AtsReport;
```
(`AtsReport`, `Requirement`, `ScoredKeyword`, `AtsAxis` importés depuis
`@/lib/ats/engine`, réutilisés tels quels — spec §4.4.)

- [ ] **Step 1 : `web/src/lib/linkedin/engine.ts`**

```ts
/**
 * Moteur d'optimisation de profil LinkedIn — score local, sans IA.
 *
 * Réutilise le moteur ATS (`lib/ats/engine.ts`) : extraction de mots-clés pondérés
 * (`extractJobKeywords`), présence dans un texte (`contains`/`normalize`), et la
 * forme du rapport (`AtsReport`/`AtsAxis`). Un profil LinkedIn n'a pas de structure
 * de données propre (contrairement au CV) : l'utilisateur colle un titre et un
 * corps de texte (à-propos + expériences), voir spec 2026-08-02-linkedin-
 * optimisation-design.md §4.
 */

import {
  extractJobKeywords,
  contains,
  normalize,
  type AtsReport,
  type AtsAxis,
  type Requirement,
  type ScoredKeyword,
} from "@/lib/ats/engine";

/** Un intitulé LinkedIn par défaut ("Développeur chez Acme") fait ~30 caractères ;
 *  une accroche travaillée (valeur ajoutée, spécialité) va plus loin. Score plein à
 *  80 caractères — LinkedIn en autorise jusqu'à 220, mais l'essentiel du gain de
 *  lisibilité est déjà acquis avant. */
function scoreTitle(titleText: string): number {
  const t = titleText.trim();
  if (!t) return 0;
  return Math.min(100, Math.round((t.length / 80) * 100));
}

/** Même technique que l'axe Impact de l'ATS (`ats/engine.ts`) : proportion de
 *  lignes qui contiennent un chiffre (durée, volume, budget…), preuve d'une
 *  réalisation plutôt qu'une liste de tâches. */
function scoreImpactText(bodyText: string): number {
  const lines = bodyText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return 0;
  const quantified = lines.filter((l) => /\d/.test(l)).length;
  return Math.round(30 + 70 * (quantified / lines.length));
}

/** Longueur du corps (jusqu'à 400 caractères = plein score) + nombre de paragraphes
 *  distincts (jusqu'à 3 = plein score) : un profil à une seule phrase n'est pas un
 *  profil rempli, même s'il contient un mot-clé recherché. */
function scoreCompleteness(bodyText: string): number {
  const trimmed = bodyText.trim();
  const lengthScore = Math.min(60, Math.round((trimmed.length / 400) * 60));
  const paragraphs = trimmed.split(/\n+/).filter(Boolean).length;
  const structureScore = Math.min(40, Math.round((Math.min(paragraphs, 3) / 3) * 40));
  return lengthScore + structureScore;
}

function scoreKeywordsLocal(
  bodyText: string,
  jobDesc: string,
): { score: number; matched: ScoredKeyword[]; missing: ScoredKeyword[] } {
  const keywords = extractJobKeywords(jobDesc);
  const norm = normalize(bodyText);
  const matched = keywords.filter((k) => contains(norm, k.term));
  const missing = keywords.filter((k) => !contains(norm, k.term));
  const totalWeight = keywords.reduce((s, k) => s + k.weight, 0);
  const matchedWeight = matched.reduce((s, k) => s + k.weight, 0);
  const score = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return { score, matched, missing };
}

function verdictFor(score: number): string {
  return score >= 85
    ? "Profil très abouti"
    : score >= 70
      ? "Bon profil, quelques ajustements"
      : score >= 50
        ? "À retravailler"
        : "Profil incomplet";
}

function buildLinkedInReport(
  titleText: string,
  bodyText: string,
  hasJobDesc: boolean,
  keywordScore: number,
  matched: ScoredKeyword[],
  missing: ScoredKeyword[],
): AtsReport {
  const title = scoreTitle(titleText);
  const impact = scoreImpactText(bodyText);
  const completeness = scoreCompleteness(bodyText);

  const axes: AtsAxis[] = [];
  if (hasJobDesc) {
    axes.push({
      key: "keywords",
      label: "Mots-clés",
      weight: 35,
      score: keywordScore,
      hint: missing.length
        ? `Ajoute ${missing.slice(0, 3).map((k) => k.term).join(", ")} dans ton profil.`
        : "Toutes les exigences de l'offre sont couvertes.",
    });
  }
  axes.push(
    {
      key: "title",
      label: "Titre",
      weight: hasJobDesc ? 20 : 30,
      score: title,
      hint:
        title < 100
          ? "Développe ton titre au-delà d'un simple intitulé de poste (valeur ajoutée, spécialité)."
          : "Titre suffisamment développé.",
    },
    {
      key: "impact",
      label: "Impact",
      weight: hasJobDesc ? 25 : 40,
      score: impact,
      hint: impact < 80 ? "Chiffre tes réalisations dans le résumé et les expériences." : "Réalisations bien chiffrées.",
    },
    {
      key: "completeness",
      label: "Complétude",
      weight: hasJobDesc ? 20 : 30,
      score: completeness,
      hint:
        completeness < 80
          ? "Étoffe le résumé (« À propos ») et détaille plusieurs expériences."
          : "Profil suffisamment détaillé.",
    },
  );

  const score = Math.round(axes.reduce((sum, a) => sum + (a.score * a.weight) / 100, 0));

  return {
    score,
    verdict: verdictFor(score),
    axes,
    matched,
    missing: missing.slice(0, 20),
    sections: {
      Titre: !!titleText.trim(),
      "Corps du profil": !!bodyText.trim(),
      "Offre visée": hasJobDesc,
    },
    boostKeywords: [],
  };
}

/** Analyse locale, sans IA. `jobDesc` vide → axe Mots-clés exclu, les trois autres
 *  passent à 30/40/30. */
export function analyzeLinkedInProfile(titleText: string, bodyText: string, jobDesc = ""): AtsReport {
  const hasJobDesc = !!jobDesc.trim();
  if (!hasJobDesc) return buildLinkedInReport(titleText, bodyText, false, 0, [], []);
  const { score, matched, missing } = scoreKeywordsLocal(bodyText, jobDesc);
  return buildLinkedInReport(titleText, bodyText, true, score, matched, missing);
}

/** Analyse assistée par IA : les exigences viennent de `/api/linkedin-score`
 *  (mêmes règles hard=3/nice=1 que `analyzeWithRequirements` de l'ATS), le reste du
 *  rapport (titre, impact, complétude) reste calculé localement. */
export function analyzeLinkedInWithRequirements(
  titleText: string,
  bodyText: string,
  requirements: Requirement[],
  jobDescProvided = true,
): AtsReport {
  const weigh = (r: Requirement): ScoredKeyword => ({ term: r.term, weight: r.kind === "hard" ? 3 : 1 });
  const matched = requirements.filter((r) => r.present).map(weigh).sort((a, b) => b.weight - a.weight);
  const missing = requirements.filter((r) => !r.present).map(weigh).sort((a, b) => b.weight - a.weight);
  const totalWeight = [...matched, ...missing].reduce((s, k) => s + k.weight, 0);
  const matchedWeight = matched.reduce((s, k) => s + k.weight, 0);
  const keywordScore = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return buildLinkedInReport(titleText, bodyText, jobDescProvided, keywordScore, matched, missing);
}
```

- [ ] **Step 2 : `web/src/lib/linkedin/engine.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { analyzeLinkedInProfile, analyzeLinkedInWithRequirements } from "./engine";
import type { Requirement } from "@/lib/ats/engine";

describe("analyzeLinkedInProfile", () => {
  it("sans titre, sans corps, sans offre : tout à zéro, poids 30/40/30", () => {
    const r = analyzeLinkedInProfile("", "", "");
    expect(r.score).toBe(0);
    expect(r.verdict).toBe("Profil incomplet");
    expect(r.axes.map((a) => a.key)).toEqual(["title", "impact", "completeness"]);
    expect(r.axes.map((a) => a.weight)).toEqual([30, 40, 30]);
    expect(r.sections).toEqual({ Titre: false, "Corps du profil": false, "Offre visée": false });
  });

  it("sans offre : titre développé (80 caractères) → axe Titre à 100", () => {
    const r = analyzeLinkedInProfile("x".repeat(80), "un peu de contenu", "");
    const title = r.axes.find((a) => a.key === "title");
    expect(title?.score).toBe(100);
  });

  it("avec offre : ajoute l'axe Mots-clés (poids 35), les autres passent à 20/25/20", () => {
    const r = analyzeLinkedInProfile("Titre", "Corps", "une offre quelconque avec du texte");
    expect(r.axes.map((a) => a.key)).toEqual(["keywords", "title", "impact", "completeness"]);
    expect(r.axes.map((a) => a.weight)).toEqual([35, 20, 25, 20]);
    expect(r.sections["Offre visée"]).toBe(true);
  });

  it("le corps du profil contient un mot-clé martelé par l'offre → il ressort en matched", () => {
    const jobDesc = "python python python développeur";
    const r = analyzeLinkedInProfile("Titre", "J'utilise python au quotidien.", jobDesc);
    expect(r.matched.some((k) => k.term === "python")).toBe(true);
  });
});

describe("analyzeLinkedInWithRequirements", () => {
  const requirements: Requirement[] = [
    { term: "react", kind: "hard", present: true, evidence: "" },
    { term: "docker", kind: "hard", present: false, evidence: "" },
    { term: "figma", kind: "nice", present: true, evidence: "" },
  ];
  const titleText = "x".repeat(80); // axe Titre → 100
  const bodyText = "Ligne un\nLigne deux 2021\nLigne trois\nLigne quatre 5"; // impact 65, complétude 48

  it("calcule le score pondéré à partir des exigences extraites par l'IA", () => {
    const r = analyzeLinkedInWithRequirements(titleText, bodyText, requirements);

    const keywords = r.axes.find((a) => a.key === "keywords");
    const title = r.axes.find((a) => a.key === "title");
    const impact = r.axes.find((a) => a.key === "impact");
    const completeness = r.axes.find((a) => a.key === "completeness");

    expect(keywords?.score).toBe(57); // (react:3 + figma:1) / (react:3 + docker:3 + figma:1) = 4/7
    expect(title?.score).toBe(100);
    expect(impact?.score).toBe(65);
    expect(completeness?.score).toBe(48);

    // 35*57/100 + 20*100/100 + 25*65/100 + 20*48/100 = 19.95 + 20 + 16.25 + 9.6 = 65.8 → 66
    expect(r.score).toBe(66);
    expect(r.verdict).toBe("À retravailler");
    expect(r.matched.map((k) => k.term)).toEqual(["react", "figma"]);
    expect(r.missing.map((k) => k.term)).toEqual(["docker"]);
  });

  it("jobDescProvided=false exclut l'axe Mots-clés même avec des requirements non vides", () => {
    const r = analyzeLinkedInWithRequirements(titleText, bodyText, requirements, false);
    expect(r.axes.map((a) => a.key)).toEqual(["title", "impact", "completeness"]);
  });
});
```

- [ ] **Step 3 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Attendu : tout vert, avec les nouveaux tests de `linkedin/engine.test.ts` en plus.
Si un des calculs manuels ci-dessus (65, 48, 57, 66) ne correspond pas exactement à
ce que Vitest calcule, corriger la valeur attendue dans le test après avoir vérifié
que la formule elle-même (recopiée depuis ce plan) est correcte — ne pas modifier la
formule pour faire coller un chiffre.

- [ ] **Step 4 : Commit**

```bash
git add web/src/lib/linkedin/
git commit -m "feat(linkedin): moteur de score local (réutilise lib/ats/engine.ts)

analyzeLinkedInProfile (100% local) et analyzeLinkedInWithRequirements (score
recalculé à partir des exigences extraites par l'IA) — 4 axes pondérés (Mots-clés
si une offre est fournie, Titre, Impact, Complétude), réutilisant extractJobKeywords/
contains/normalize et le type AtsReport du moteur ATS existant plutôt que de
dupliquer cette logique (spec 2026-08-02-linkedin-optimisation-design.md §4.4)."
```

---

## Task 3 : `/api/linkedin-score` — suggestions par IA

**Files:**
- Modify: `web/src/lib/ai/prompts.ts`
- Create: `web/src/app/api/linkedin-score/route.ts`
- Create: `web/src/app/api/linkedin-score/route.test.ts`

**Contexte.** Miroir de `/api/ats-score`, avec deux différences : `requirements` est
optionnel (vide si aucune offre visée n'est fournie) et la réponse ajoute
`titleSuggestions` (accroches réécrites). Le prompt inclut `HUMAN_TONE_RULE` — spec
§4.5.

- [ ] **Step 1 : `web/src/lib/ai/prompts.ts` — ajouter `SYSTEM_LINKEDIN_SCORE`**

Ajouter, juste après `SYSTEM_ATS_SCORE` (après la ligne qui se termine par
`"- JSON PUR : aucune balise markdown, aucun \`\`\`json, aucun texte avant ou après le JSON.";`) :

```ts

// ---- optimisation de profil LinkedIn -----------------------------------------

export const SYSTEM_LINKEDIN_SCORE =
  "Tu es un coach LinkedIn expert en recrutement.\n" +
  "Tu reçois le TITRE (headline) et le CORPS (à-propos + expériences) d'un profil " +
  "LinkedIn, et éventuellement le texte d'une offre d'emploi visée.\n\n" +
  "TÂCHE :\n" +
  "1. Si une offre est fournie : extrais ses exigences réelles, comme pour un CV " +
  "(kind='hard' indispensable, kind='nice' souhaité ; ignore le bruit — culture, " +
  "avantages, localisation, soft skills génériques). Pour chacune, dis si le PROFIL " +
  "la prouve (present=true/false, accepte synonymes/variantes), 'evidence' = extrait " +
  "exact du profil. Si AUCUNE offre n'est fournie, renvoie requirements: [].\n" +
  "2. Rédige 1 à 3 corrections PRIORITAIRES sur le profil (zone='Titre' ou " +
  "zone='Corps'), les plus rentables d'abord.\n" +
  "3. Propose jusqu'à 3 accroches de titre réécrites (titleSuggestions), chacune " +
  "≤ 220 caractères, qui restent fidèles aux faits du profil (n'invente aucune " +
  "compétence ou expérience absente du texte fourni).\n\n" +
  HUMAN_TONE_RULE +
  "\n\nFORMAT DE RÉPONSE OBLIGATOIRE — JSON PUR, RIEN D'AUTRE :\n" +
  '{"requirements": [{"term": "...", "kind": "hard|nice", "present": true|false, "evidence": "..."}],\n' +
  ' "priorities": [{"title": "...", "problem": "...", "fix": "...", "example": "...", "zone": "Titre|Corps"}],\n' +
  ' "titleSuggestions": ["...", "..."]}\n\n' +
  "CONTRAINTES :\n" +
  "- 'term' : libellé court (1-4 mots). 15 à 25 exigences maximum, pas de doublon.\n" +
  "- 'title' (priorité) : l'action à faire, à l'impératif.\n" +
  "- 'example' : une ligne de profil prête à adapter, jamais une expérience inventée.\n" +
  "- JSON PUR : aucune balise markdown, aucun ```json, aucun texte avant ou après le JSON.";
```

Vérifier que `HUMAN_TONE_RULE` est bien importable dans ce fichier (elle y est déjà
définie plus haut, `prompts.ts` ligne ~26 — pas de nouvel import nécessaire).

- [ ] **Step 2 : `web/src/app/api/linkedin-score/route.ts`**

```ts
import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_LINKEDIN_SCORE } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse, readAiHeaders } from "@/lib/ai/http";
import { coerceRequirements, coercePriorities, coerceTitleSuggestions } from "@/lib/ai/coerceAi";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { title_text?: string; body_text?: string; job_desc?: string };

/**
 * Suggestions IA pour un profil LinkedIn (titre + corps collés). Le score reste
 * calculé côté client par `lib/linkedin/engine.ts`, à partir des `requirements`
 * retournées ici — reproductible, comme `/api/ats-score`.
 */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const titleText = (body.title_text ?? "").trim();
  const bodyText = (body.body_text ?? "").trim();
  const jobDesc = (body.job_desc ?? "").trim();
  if (!bodyText) {
    return NextResponse.json(
      { error: "Le corps du profil (à-propos + expériences) est requis." },
      { status: 400 },
    );
  }

  const { key: userKey, model: userModel } = readAiHeaders(req);
  const content =
    `Titre (headline) :\n${titleText || "(non renseigné)"}\n\n` +
    `Corps du profil (à-propos + expériences) :\n${bodyText}` +
    (jobDesc ? `\n\nOffre visée :\n${jobDesc}` : "\n\nAucune offre visée fournie.");

  try {
    const raw = await complete([{ role: "user", content }], SYSTEM_LINKEDIN_SCORE, userKey, userModel);
    const result = parseAiJson(raw);
    if (typeof result !== "object" || result === null) {
      throw new Error("Réponse IA invalide : objet JSON attendu.");
    }
    const r = result as Record<string, unknown>;
    const priorities = coercePriorities(r.priorities);
    if (!priorities.length) {
      throw new Error("Réponse IA invalide : aucune suggestion exploitable.");
    }
    return NextResponse.json({
      requirements: jobDesc ? coerceRequirements(r.requirements) : [],
      priorities,
      titleSuggestions: coerceTitleSuggestions(r.titleSuggestions),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
```

- [ ] **Step 3 : `web/src/app/api/linkedin-score/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/linkedin-score", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ok = { title_text: "Développeur", body_text: "À propos : ...", job_desc: "" };

beforeEach(() => mockComplete.mockReset());

describe("POST /api/linkedin-score", () => {
  it("exige le corps du profil", async () => {
    const res = await POST(req({ title_text: "x", body_text: "", job_desc: "" }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("force requirements à [] si aucune offre n'est fournie, même si l'IA en renvoie", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        requirements: [{ term: "React", kind: "hard", present: true, evidence: "" }],
        priorities: [{ title: "Développe ton accroche", problem: "trop courte", fix: "…", example: "…", zone: "Titre" }],
        titleSuggestions: ["Développeur full-stack — React & Node"],
      }),
    );
    const res = await POST(req(ok));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.requirements).toEqual([]);
    expect(data.priorities).toHaveLength(1);
    expect(data.titleSuggestions).toEqual(["Développeur full-stack — React & Node"]);
  });

  it("renvoie les requirements coercées quand une offre est fournie", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        requirements: [
          { term: "React", kind: "hard", present: true, evidence: "" },
          { term: "react", kind: "hard", present: false, evidence: "" }, // doublon
        ],
        priorities: [{ title: "…", problem: "…", fix: "…", example: "…", zone: "Corps" }],
        titleSuggestions: [],
      }),
    );
    const res = await POST(req({ ...ok, job_desc: "une offre" }));
    const data = await res.json();
    expect(data.requirements).toHaveLength(1); // doublon écarté
  });

  it("renvoie 502 si l'IA ne fournit aucune priorité exploitable", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ requirements: [], priorities: [], titleSuggestions: [] }));
    const res = await POST(req(ok));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 4 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/ai/prompts.ts web/src/app/api/linkedin-score/
git commit -m "feat(api): route /api/linkedin-score (suggestions IA profil LinkedIn)

Miroir de /api/ats-score : l'IA extrait les exigences de l'offre visée si elle est
fournie (requirements: [] sinon), rédige des corrections prioritaires et jusqu'à
3 accroches réécrites (titleSuggestions), avec HUMAN_TONE_RULE pour que ces
réécritures ne sonnent pas IA. Le score reste calculé par lib/linkedin/engine.ts,
reproductible."
```

---

## Task 4 : page `/linkedin`

**Files:**
- Create: `web/src/app/linkedin/page.tsx`
- Create: `web/src/components/linkedin/LinkedInView.tsx`
- Modify: `web/src/components/layout/UserMenu.tsx`

**Contexte.** Sur le modèle de `/profil` (`ProfileView.tsx`) pour la coquille de
page, et de `AtsPanel.tsx` pour le bloc résultat (désormais partagé via
`ScoreReportParts.tsx`, Task 1).

- [ ] **Step 1 : `web/src/app/linkedin/page.tsx`**

```tsx
import LinkedInView from "@/components/linkedin/LinkedInView";

export const metadata = {
  title: "Optimisation LinkedIn — CVMatchr",
};

export default function LinkedInPage() {
  return <LinkedInView />;
}
```

- [ ] **Step 2 : `web/src/components/linkedin/LinkedInView.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/ai/client";
import { analyzeLinkedInProfile, analyzeLinkedInWithRequirements } from "@/lib/linkedin/engine";
import type { AtsReport, Requirement, Priority } from "@/lib/ats/engine";
import { toast } from "@/state/uiStore";
import { scoreClass, Axes, Pills, Priorities, SectionBadges } from "@/components/shared/ScoreReportParts";

/**
 * Page « Optimisation LinkedIn » (/linkedin) : coller le titre et le corps de son
 * profil LinkedIn, avec en option une offre visée, pour un score local instantané
 * (lib/linkedin/engine.ts) et des suggestions IA optionnelles (/api/linkedin-score).
 * Écran autonome, sans lien avec l'éditeur (spec 2026-08-02-linkedin-optimisation-
 * design.md §4.3, §4.8).
 */

type AiResponse = { requirements: Requirement[]; priorities: Priority[]; titleSuggestions: string[] };

export default function LinkedInView() {
  const router = useRouter();
  const [titleText, setTitleText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [report, setReport] = useState<AtsReport | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [byAi, setByAi] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!bodyText.trim()) {
      toast("Colle d'abord le corps de ton profil (à-propos + expériences).", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson<AiResponse>("/api/linkedin-score", {
        title_text: titleText,
        body_text: bodyText,
        job_desc: jobDesc,
      });
      const rapport = jobDesc.trim()
        ? analyzeLinkedInWithRequirements(titleText, bodyText, res.requirements)
        : analyzeLinkedInProfile(titleText, bodyText, "");
      setReport(rapport);
      setPriorities(res.priorities);
      setTitleSuggestions(res.titleSuggestions);
      setByAi(true);
    } catch {
      setReport(analyzeLinkedInProfile(titleText, bodyText, jobDesc));
      setPriorities([]);
      setTitleSuggestions([]);
      setByAi(false);
      toast("Analyse IA indisponible — score algorithmique local affiché.", "info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Optimisation LinkedIn</h1>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn-nav"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Retour
          </button>
        </div>
      </header>

      <div className="pane pack-page" style={{ overflowY: "auto" }}>
        <p className="pack-hint">
          Colle le titre (headline) et le corps (à-propos + expériences) de ton profil
          LinkedIn pour un score local instantané. Ajoute une offre visée en option
          pour évaluer l&apos;alignement des mots-clés.
        </p>

        <textarea
          className="form-textarea"
          rows={2}
          placeholder="Titre (headline) de ton profil LinkedIn…"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          disabled={busy}
        />
        <textarea
          className="form-textarea"
          rows={12}
          placeholder="Corps du profil : à-propos + expériences…"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          disabled={busy}
        />
        <textarea
          className="form-textarea"
          rows={6}
          placeholder="Offre visée (optionnel)…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          disabled={busy}
        />

        <div className="ats-panel">
          <div className="ats-actions">
            <button type="button" className="ats-action-btn" onClick={run} disabled={busy}>
              {busy ? "Analyse…" : "Analyser mon profil"}
            </button>
          </div>

          {report ? (
            <div className="ats-result">
              {byAi ? <div className="ats-ai-badge">✨ Analyse IA</div> : null}

              <div className="ats-score-row">
                <div className={`ats-score-circle ${scoreClass(report.score)}`}>{report.score}</div>
                <div className="ats-score-label">{report.verdict}</div>
              </div>

              <Axes axes={report.axes} />

              {titleSuggestions.length ? (
                <>
                  <div className="ats-keywords-title">Accroches suggérées</div>
                  <ul className="ats-priorities">
                    {titleSuggestions.map((t, i) => (
                      <li key={i} className="ats-priority">
                        <p className="ats-priority-text">{t}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <Priorities items={priorities} />

              {report.missing.length ? <div className="ats-keywords-title">Mots-clés à ajouter</div> : null}
              <Pills items={report.missing.map((k) => k.term)} kind="missing" />

              {report.matched.length ? <div className="ats-keywords-title">Mots-clés couverts</div> : null}
              <Pills items={report.matched.map((k) => k.term)} kind="match" />

              <SectionBadges sections={report.sections} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : `web/src/components/layout/UserMenu.tsx` — ajouter le lien**

Ajouter, juste après le bloc `<Link href="/profil" ...>Mes infos</Link>` (avant la
balise fermante `</div>` du dropdown) :

```tsx
          <Link href="/linkedin" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /><path d="M8 9h4v2a4 4 0 0 1 8 0v10h-4v-9a2 2 0 0 0-4 0v9H8z" /></svg>
            Optimisation LinkedIn
          </Link>
```

(Icône générique « LinkedIn-like » cohérente avec le style trait des autres icônes du
menu — pas le logo LinkedIn officiel, pour rester libre de droits comme le reste des
icônes de ce dépôt.)

- [ ] **Step 4 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Step 5 : Vérification manuelle (protocole, spec §7 point 4)**

```
1. npm run dev, ouvrir http://localhost:3000
2. Menu utilisateur (icône silhouette, topbar) → « Optimisation LinkedIn » → /linkedin s'affiche
3. Coller un titre court (ex. "Développeur") + un corps vide → clic « Analyser mon
   profil » → toast d'erreur, pas d'appel réseau.
4. Coller un titre + un extrait du CV de test (web/tests/fixtures/base_resume.json,
   reformulé en profil : expériences + résumé) dans le corps, sans offre visée →
   clic « Analyser mon profil ».
   Attendu : si une clé IA est configurée, badge « Analyse IA », accroches
   suggérées et corrections prioritaires affichées ; sinon (pas de clé dans cet
   environnement), toast « Analyse IA indisponible — score algorithmique local
   affiché. » et un rapport à 3 axes (Titre/Impact/Complétude, poids 30/40/30)
   s'affiche quand même.
5. Coller en plus le contenu de web/tests/fixtures/job_sharkninja.txt dans « Offre
   visée » → relancer l'analyse.
   Attendu : un quatrième axe Mots-clés apparaît (poids 35, les trois autres
   passant à 20/25/20), avec des pastilles de mots-clés couverts/manquants.
6. Consigner dans WORK_HISTORY.md si une clé IA était disponible dans cet
   environnement ou si seul le repli local a pu être vérifié.
```

- [ ] **Step 6 : Commit**

```bash
git add web/src/app/linkedin/ web/src/components/linkedin/ web/src/components/layout/UserMenu.tsx
git commit -m "feat(linkedin): page /linkedin — optimisation de profil LinkedIn

Colle le titre et le corps de son profil LinkedIn (+ une offre visée en option)
pour un score local instantané (lib/linkedin/engine.ts) et des suggestions IA
optionnelles (accroches réécrites, corrections prioritaires) via
/api/linkedin-score. Accessible depuis le menu utilisateur, à côté de « Mes
infos »/« Paramètres »."
```

---

## Task 5 : Documentation et clôture

**Files:**
- Modify: `PROJECT_INDEX.md`
- Modify: `WORK_HISTORY.md`

**But :** rendre le nouveau domaine `lib/linkedin/` et la route `/api/linkedin-score`
découvrables par la prochaine lecture de `PROJECT_INDEX.md`.

- [ ] **Step 1 : `PROJECT_INDEX.md` §7 — nouvelle ligne dans le tableau des routes IA**

Ajouter une ligne au tableau des routes `/api/*` (section 7), après la ligne
`ats-score` :

```
| `linkedin-score` | Suggestions pour un profil LinkedIn collé (titre + corps) : exigences vs offre visée (optionnelle), corrections prioritaires, accroches réécrites — le score reste calculé par `lib/linkedin/engine.ts` |
```

- [ ] **Step 2 : `PROJECT_INDEX.md` — nouvelle section courte**

Ajouter, après la section « 8 ter. Extension navigateur » (avant la section 9
Authentification) :

```md
## 8 quater. Optimisation de profil LinkedIn

Page `/linkedin` (`components/linkedin/LinkedInView.tsx`), accessible depuis le menu
utilisateur. Coller le titre (headline) et le corps (à-propos + expériences) de son
profil LinkedIn, avec une offre visée en option, produit un score local instantané
(`lib/linkedin/engine.ts`, 4 axes pondérés) et des suggestions IA optionnelles
(`/api/linkedin-score` : corrections prioritaires, accroches réécrites) — même
principe « score local reproductible + IA optionnelle » que le panneau ATS
(§7), dont ce chantier réutilise directement l'extraction de mots-clés
(`extractJobKeywords`/`contains`/`normalize`) et la forme du rapport (`AtsReport`).

Écran autonome, sans lien avec l'éditeur ni l'offre en cours (`docStore`) : le texte
est collé indépendamment de tout document ouvert. Aucune donnée persistée (analyse
éphémère, comme un score ATS non sauvegardé).

Hors périmètre à ce stade : import automatique du profil (scraping/connexion
LinkedIn — faisabilité à valider séparément), réplique des sections non
représentables depuis un texte collé (photo, recommandations…).
```

- [ ] **Step 3 : Commit**

```bash
git add PROJECT_INDEX.md WORK_HISTORY.md
git commit -m "docs: référencer l'optimisation LinkedIn dans PROJECT_INDEX.md

Nouveau domaine lib/linkedin/ et route /api/linkedin-score (Task 2-4) documentés
dans la carte du dépôt, pour qu'un futur agent ne le redécouvre pas à l'aveugle."
```

---

## Récapitulatif des critères de succès (spec §9)

- [ ] `npx tsc --noEmit` / `npm run lint` / `npx vitest run` verts après chaque tâche.
- [ ] Aucune dépendance npm ajoutée.
- [ ] Sans offre visée : score local à 3 axes (Titre/Impact/Complétude, 30/40/30).
- [ ] Avec offre visée : 4 axes (Mots-clés 35, Titre 20, Impact 25, Complétude 20),
      mots-clés couverts/manquants affichés.
- [ ] Le bouton « Analyser mon profil » tente l'IA puis retombe sur le score local
      avec un toast explicite en cas d'échec (Task 4 Step 5).
- [ ] `/linkedin` accessible depuis `UserMenu.tsx`.
- [ ] `AtsPanel.tsx` fonctionne à l'identique après l'extraction (Task 1 Step 6).
- [ ] `src/lib/ats/engine.test.ts` et `src/app/api/ats-score/route.test.ts` restent
      verts après Task 1 (aucune régression).

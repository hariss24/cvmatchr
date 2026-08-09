# Refonte de la barre de filtres — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le bouton « Mes critères » et son formulaire de 22 champs empilés par une barre de filtres compacte, toujours visible, où l'on voit en permanence ce qui contraint les résultats.

**Architecture:** Un module pur `lib/jobs/filters.ts` décrit chaque pastille (libellé, état actif, valeur affichée) à partir du profil — toute la logique testable vit là, sans DOM. Trois composants l'habillent : `FilterPill` (pastille + menu), `MoreFilters` (panneau des réglages rares), `FilterBar` (assemblage). `ProfileForm` disparaît. Le profil (`JobSearchProfile`), son schéma Zod, Dexie et le pipeline de recherche **ne changent pas** : c'est une refonte d'affichage.

**Tech Stack:** Next.js (voir `web/AGENTS.md`), React 19, TypeScript, Vitest, `@testing-library/react` + jsdom.

**Maquettes :** `docs/design/jobs/filters.html`, `filters-dark.html` (interactions), `page-light.html`, `page-dark.html` (barre en contexte)

---

## Hypothèses posées (à lire avant de commencer)

Trois décisions ne se déduisent ni de la demande ni du code. Elles sont tranchées ici ; si l'une est fausse, c'est le moment de le dire, pas après implémentation.

1. **« Filtres » remplace « Mes critères » comme nom de la zone, pas comme libellé d'un bouton.** La refonte supprime le bouton qui ouvrait le panneau — il n'y a donc plus rien à renommer littéralement. Le mot vit dans le nom accessible de la barre (`aria-label="Filtres"`) et dans la pastille « Plus de filtres ». Le terme « critères » disparaît de toute l'interface (y compris `ScoringInfo` et l'écran de config manquante).

2. **Aucun réglage n'est perdu.** La maquette n'affiche qu'un sous-ensemble des champs pour rester lisible. Le panneau « Plus de filtres » accueille **tous** les réglages qui ne sont pas dans la barre — voir le tableau de répartition ci-dessous. Un champ oublié serait une régression silencieuse.

3. **`summarizeProfile` devient mort et est supprimé.** Ce résumé d'une ligne (livré il y a trois jours, spec §5.1) existait pour rendre le panneau replié lisible. Une barre toujours visible le rend redondant : garder les deux, c'est afficher deux fois la même chose. `summary.ts` et `summary.test.ts` sont supprimés.

### Répartition des 22 champs du profil

| Emplacement | Champs |
|---|---|
| Étage 1 — barre de recherche | `keywords`, `location` (+ `location.radiusKm` en ligne) |
| Pastille « Contrat » | `contractTypes` |
| Pastille « Publiée depuis » | `maxAgeDays` |
| Pastille « Expérience » | `experienceLevel`, `debutantAccepte` |
| Pastille « Temps de travail » | `tempsPlein` |
| Pastille « Sources » | `sources` |
| Panneau « Plus de filtres » | `prefilterKeywords`, `excludedWords`, `includeKeywords`, `romeCodes`, `salaireMin`, `periodeSalaire`, `qualification`, `minScore`, `aiShortlist`, `homeAddress`, `candidateSummary` |
| Non éditable (inchangé) | `maxDescriptionChars`, `scoringCriteria`, `commuteModes` |

`maxDescriptionChars`, `scoringCriteria` et `commuteModes` ne sont **déjà pas** éditables dans `ProfileForm` aujourd'hui : ne pas les ajouter, ce n'est pas une régression.

## Global Constraints

- Toutes les commandes s'exécutent depuis `web/` : `npm test`, `npm run lint`, `npm run build`.
- **`npm run build` est obligatoire** avant de déclarer une tâche finie : Vitest ne fait pas de typecheck.
- Ce Next.js n'est pas celui des données d'entraînement — lire `node_modules/next/dist/docs/` avant d'écrire du code de framework (cf. `web/AGENTS.md`).
- Jamais `alert`/`confirm`/`prompt` natifs : utiliser `uiAlert`/`uiConfirm`/`uiPrompt` de `src/state/uiStore.ts`.
- Commentaires et libellés d'interface en français.
- **Aucune modification de `profile.ts`, `profileSchema.ts`, `db.ts` ni des routes API.** Si une tâche semble en exiger une, c'est le signe d'une erreur de conception : s'arrêter et le signaler.
- **Piège CSS connu (déjà payé une fois) :** ajouter des règles après les anciennes ne suffit pas. La cascade ne « gagne » que sur les propriétés effectivement redéclarées ; une ancienne règle qui pose `width`/`flex-direction` continue de s'appliquer. Les règles mortes doivent être **supprimées**, pas recouvertes.

---

### Task 1: Module pur `filters.ts` — descripteurs de pastilles

Toute la logique « cette pastille est-elle active, et qu'affiche-t-elle » est décidée ici, sans React. C'est ce qui rend la barre testable sans DOM et évite d'éparpiller des ternaires dans le JSX.

**Files:**
- Create: `web/src/lib/jobs/filters.ts`
- Create: `web/src/lib/jobs/filters.test.ts`

**Interfaces:**
- Produces: `contractLabel`, `ageLabel`, `experienceLabel`, `workTimeLabel`, `sourcesLabel`, `moreFiltersCount`, `resetFilters`, `hasActiveFilters`

- [ ] **Step 1: Écrire le test**

Créer `web/src/lib/jobs/filters.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { EMPTY_PROFILE } from "./profile";
import {
  contractLabel, ageLabel, experienceLabel, workTimeLabel,
  sourcesLabel, moreFiltersCount, resetFilters, hasActiveFilters,
} from "./filters";

describe("libellés de pastilles", () => {
  it("contrat : liste les types cochés", () => {
    expect(contractLabel(["CDI", "CDD"])).toBe("CDI, CDD");
    expect(contractLabel(["MIS"])).toBe("Intérim");
  });

  it("contrat : vide quand rien n'est coché (la pastille ne contraint rien)", () => {
    expect(contractLabel([])).toBe("");
  });

  it("ancienneté : vide au défaut (30 jours), sinon libellé court", () => {
    expect(ageLabel(30)).toBe("");
    expect(ageLabel(1)).toBe("Aujourd'hui");
    expect(ageLabel(7)).toBe("7 jours");
  });

  it("expérience : combine niveau et « débutant accepté »", () => {
    expect(experienceLabel("", false)).toBe("");
    expect(experienceLabel("2", false)).toBe("1 à 3 ans");
    expect(experienceLabel("", true)).toBe("Débutant accepté");
    expect(experienceLabel("1", true)).toBe("Moins d'un an, débutant accepté");
  });

  it("temps de travail", () => {
    expect(workTimeLabel("")).toBe("");
    expect(workTimeLabel("true")).toBe("Temps plein");
    expect(workTimeLabel("false")).toBe("Temps partiel");
  });

  it("sources : compte les sources interrogées", () => {
    expect(sourcesLabel({ francetravail: true, adzuna: false, jsearch: false })).toBe("1 source");
    expect(sourcesLabel({ francetravail: true, adzuna: true, jsearch: true })).toBe("3 sources");
    expect(sourcesLabel({ francetravail: false, adzuna: false, jsearch: false })).toBe("aucune source");
  });
});

describe("moreFiltersCount", () => {
  it("ne compte rien sur un profil neutre", () => {
    expect(moreFiltersCount(EMPTY_PROFILE)).toBe(0);
  });

  it("compte chaque réglage qui s'écarte du défaut", () => {
    const p = { ...EMPTY_PROFILE, salaireMin: 32000, prefilterKeywords: ["seo"], minScore: 80 };
    expect(moreFiltersCount(p)).toBe(3);
  });

  it("ignore les mots exclus par défaut, compte une liste modifiée", () => {
    expect(moreFiltersCount({ ...EMPTY_PROFILE, excludedWords: [...EMPTY_PROFILE.excludedWords] })).toBe(0);
    expect(moreFiltersCount({ ...EMPTY_PROFILE, excludedWords: ["stagiaire"] })).toBe(1);
  });
});

describe("resetFilters", () => {
  const p = {
    ...EMPTY_PROFILE,
    keywords: ["Webmaster"],
    location: { kind: "commune" as const, code: "75056", label: "Paris", radiusKm: 20 },
    sources: { francetravail: true, adzuna: true, jsearch: true },
    homeAddress: "10 rue de Paris",
    candidateSummary: "Webmaster, 5 ans",
    contractTypes: ["MIS"],
    maxAgeDays: 3,
    salaireMin: 32000,
  };

  it("remet les filtres à leur défaut", () => {
    const r = resetFilters(p);
    expect(r.contractTypes).toEqual(EMPTY_PROFILE.contractTypes);
    expect(r.maxAgeDays).toBe(EMPTY_PROFILE.maxAgeDays);
    expect(r.salaireMin).toBeNull();
  });

  it("préserve ce qui n'est pas un filtre : recherche, sources, données du candidat", () => {
    const r = resetFilters(p);
    expect(r.keywords).toEqual(["Webmaster"]);
    expect(r.location.code).toBe("75056");
    expect(r.sources.adzuna).toBe(true);
    expect(r.homeAddress).toBe("10 rue de Paris");
    expect(r.candidateSummary).toBe("Webmaster, 5 ans");
  });
});

describe("hasActiveFilters", () => {
  it("faux sur un profil neutre, vrai dès qu'un filtre contraint", () => {
    expect(hasActiveFilters(EMPTY_PROFILE)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_PROFILE, maxAgeDays: 7 })).toBe(true);
  });

  it("ignore poste et lieu : ce sont la recherche, pas des filtres", () => {
    expect(hasActiveFilters({ ...EMPTY_PROFILE, keywords: ["Webmaster"] })).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/lib/jobs/filters.test.ts`
Expected: FAIL — `Failed to resolve import "./filters"`.

- [ ] **Step 3: Écrire `filters.ts`**

Créer `web/src/lib/jobs/filters.ts` :

```ts
import { EMPTY_PROFILE, type JobSearchProfile } from "./profile";
import type { SourceToggles } from "./sources";

/**
 * Ce que chaque pastille de la barre affiche, et si elle contraint réellement
 * la recherche. Une pastille au réglage par défaut n'affiche que son nom et
 * reste grise ; dès qu'elle filtre, elle passe en actif avec sa valeur — l'œil
 * repère ce qui contraint sans lire.
 *
 * Volontairement pur (aucun React) : c'est la seule logique de la barre qui
 * mérite des tests, et elle se teste sans DOM.
 */

export const CONTRACT_OPTIONS = [
  { code: "CDI", label: "CDI" },
  { code: "CDD", label: "CDD" },
  { code: "MIS", label: "Intérim" },
  { code: "SAI", label: "Saisonnier" },
];

export const AGE_OPTIONS = [
  { days: 1, label: "Aujourd'hui" },
  { days: 3, label: "3 jours" },
  { days: 7, label: "7 jours" },
  { days: 14, label: "14 jours" },
  { days: 30, label: "30 jours" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "", label: "Indifférent" },
  { value: "1", label: "Moins d'un an" },
  { value: "2", label: "1 à 3 ans" },
  { value: "3", label: "Plus de 3 ans" },
];

export const WORK_TIME_OPTIONS = [
  { value: "", label: "Indifférent" },
  { value: "true", label: "Temps plein" },
  { value: "false", label: "Temps partiel" },
];

export const QUALIFICATION_OPTIONS = [
  { value: "", label: "Indifférent" },
  { value: "0", label: "Non-cadre" },
  { value: "9", label: "Cadre" },
];

/** "" = ne contraint pas ⇒ pastille grise, sans valeur affichée. */
export function contractLabel(codes: string[]): string {
  if (codes.length === 0) return "";
  return codes
    .map((c) => CONTRACT_OPTIONS.find((o) => o.code === c)?.label ?? c)
    .join(", ");
}

export function ageLabel(days: number): string {
  if (days === EMPTY_PROFILE.maxAgeDays) return "";
  return AGE_OPTIONS.find((o) => o.days === days)?.label ?? `${days} jours`;
}

export function experienceLabel(level: JobSearchProfile["experienceLevel"], debutant: boolean): string {
  const niveau = EXPERIENCE_OPTIONS.find((o) => o.value === level && o.value !== "")?.label ?? "";
  if (niveau && debutant) return `${niveau}, débutant accepté`;
  if (debutant) return "Débutant accepté";
  return niveau;
}

export function workTimeLabel(value: JobSearchProfile["tempsPlein"]): string {
  return WORK_TIME_OPTIONS.find((o) => o.value === value && o.value !== "")?.label ?? "";
}

/** Toujours renseigné : le nombre de sources interrogées se lit en permanence. */
export function sourcesLabel(sources: SourceToggles): string {
  const n = Object.values(sources).filter(Boolean).length;
  if (n === 0) return "aucune source";
  return n === 1 ? "1 source" : `${n} sources`;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Nombre de réglages du panneau qui s'écartent du défaut (pastille « Plus de filtres »). */
export function moreFiltersCount(p: JobSearchProfile): number {
  let n = 0;
  if (p.prefilterKeywords.length > 0) n++;
  if (!sameList(p.excludedWords, EMPTY_PROFILE.excludedWords)) n++;
  if (p.includeKeywords.length > 0) n++;
  if (p.romeCodes.length > 0) n++;
  if (p.salaireMin != null) n++;
  if (p.qualification !== EMPTY_PROFILE.qualification) n++;
  if (p.minScore !== EMPTY_PROFILE.minScore) n++;
  if (p.aiShortlist !== EMPTY_PROFILE.aiShortlist) n++;
  if (p.homeAddress !== "") n++;
  if (p.candidateSummary !== "") n++;
  return n;
}

export function hasActiveFilters(p: JobSearchProfile): boolean {
  return (
    contractLabel(p.contractTypes) !== "" ||
    ageLabel(p.maxAgeDays) !== "" ||
    experienceLabel(p.experienceLevel, p.debutantAccepte) !== "" ||
    workTimeLabel(p.tempsPlein) !== "" ||
    moreFiltersCount(p) > 0
  );
}

/**
 * « Réinitialiser » remet les FILTRES au défaut, pas la recherche. On ne touche
 * ni au poste, ni au lieu, ni aux sources, ni aux données du candidat (adresse,
 * résumé) : les effacer par un bouton discret serait une perte de travail
 * disproportionnée par rapport à ce que le mot promet.
 */
export function resetFilters(p: JobSearchProfile): JobSearchProfile {
  return {
    ...p,
    contractTypes: EMPTY_PROFILE.contractTypes,
    maxAgeDays: EMPTY_PROFILE.maxAgeDays,
    experienceLevel: EMPTY_PROFILE.experienceLevel,
    debutantAccepte: EMPTY_PROFILE.debutantAccepte,
    tempsPlein: EMPTY_PROFILE.tempsPlein,
    qualification: EMPTY_PROFILE.qualification,
    salaireMin: EMPTY_PROFILE.salaireMin,
    periodeSalaire: EMPTY_PROFILE.periodeSalaire,
    includeKeywords: EMPTY_PROFILE.includeKeywords,
    excludedWords: EMPTY_PROFILE.excludedWords,
    prefilterKeywords: EMPTY_PROFILE.prefilterKeywords,
    romeCodes: EMPTY_PROFILE.romeCodes,
    minScore: EMPTY_PROFILE.minScore,
    aiShortlist: EMPTY_PROFILE.aiShortlist,
  };
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/lib/jobs/filters.test.ts`
Expected: PASS — tous les tests verts.

- [ ] **Step 5: Vérifier la tâche**

Run: `cd web && npm run lint && npm run build`
Expected: aucune erreur.

---

### Task 2: CSS de la barre

Portage de `docs/design/jobs/filters.html` (feuille `_filters.css`) dans `globals.css`, et **suppression** des règles `.jf-*` du formulaire disparu.

**Files:**
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Ajouter les règles `.flt-*`**

Insérer le bloc suivant dans la section « Onglet Offres », juste après `.jobs-hint` (ligne ~1328). Il est repris **tel quel** de `_filters.css` dans la maquette — ne pas le réécrire de mémoire, comparer avec le fichier :

```css
/* ===== Barre de filtres =====
   Les filtres ne se cachent plus derrière un bouton qui ouvre un formulaire de
   onze champs empilés : ils vivent dans une barre compacte toujours visible,
   comme chez LinkedIn, Indeed et France Travail — on voit en permanence ce qui
   contraint les résultats.

   Deux étages, deux rôles pour l'œil :
     1. CE QUE JE CHERCHE — poste + lieu, en grand, c'est le sujet.
     2. COMMENT JE RESTREINS — pastilles secondaires, plus petites. */
```

…suivi de l'intégralité de `_filters.css` (règles `.flt`, `.flt-search`, `.flt-box`, `.flt-tag`, `.flt-input`, `.flt-radius`, `.flt-go`, `.flt-row`, `.flt-pill`, `.flt-count`, `.flt-spacer`, `.flt-reset`, `.flt-results`, `.flt-menu`, `.flt-opt`, `.flt-more`, `.flt-field`, `.flt-text`, `.flt-tags`, et la media query `max-width: 900px`).

- [ ] **Step 2: Ajouter les surcharges pour les deux composants réutilisés**

`MetierInput` et `LocationInput` ne sont pas réécrits — ils sont **restylés en place** pour vivre dans la barre. Leurs classes (`.jf-tags-field`, `.jf-tag`, `.loc-field`, `.ui-input`) sont surchargées par scoping, ce qui donne une spécificité supérieure sans toucher au TSX :

```css
/* MetierInput et LocationInput sont réutilisés tels quels dans la barre : on
   les aplatit ici plutôt que de dupliquer deux composants. Le scoping suffit
   (spécificité supérieure), mais toute propriété non redéclarée ci-dessous
   continue de venir des règles .jf-*/.loc-* d'origine — les vérifier à l'œil. */
.flt-box .jf-tags-field,
.flt-box .loc-field { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 0; }
.flt-box .jf-tags { gap: 5px; }
.flt-box .loc-input-wrap { flex: 1; min-width: 120px; }
.flt-box .ui-input { background: none; box-shadow: none; padding: 6px 0; font-size: 13.5px; }
.flt-box .ui-input:focus { box-shadow: none; }
.flt-box .loc-radius { padding-left: 10px; border-left: 1px solid var(--border); }
.flt-box .loc-radius input { width: 54px; }
```

- [ ] **Step 3: Supprimer les règles devenues mortes**

Supprimer (ne pas commenter, ne pas recouvrir) : `.jobs-form-bar`, `.jobs-form-toggle`, `.jobs-form`, `.jf-head`, `.jf-title`, `.jf-hint`, `.jf-primary`, `.jf-filters`, `.jf-filters-row`, `.jf-grid`, `.jf-chips`, `.jf-chip*`, `.jf-switch*`, `.jf-adv-toggle*`, `.jf-advanced`, `.jf-sources*`, `.jf-source*`, `.jobs-summary*`, ainsi que la media query `@media (max-width: 640px)` qui ne cible plus que `.jf-primary` et `.jf-filters-row`.

**Conserver** : `.jf-field`, `.jf-label`, `.jf-note`, `.jf-tags-field`, `.jf-tags`, `.jf-tag*`, `.jf-select`, `.jf-textarea`, `.loc-*` — encore utilisés par `MetierInput`, `LocationInput` et le panneau.

- [ ] **Step 4: Vérifier qu'aucune classe supprimée n'est encore référencée**

Run: `cd web && grep -rn "jobs-form\|jf-chip\|jf-switch\|jf-adv\|jf-advanced\|jf-primary\|jf-filters\|jf-sources\|jf-source\|jobs-summary\|jf-head\|jf-title\|jf-grid" src/`
Expected: uniquement des occurrences dans `ProfileForm.tsx` et `SourcePicker.tsx`, qui seront traités aux tâches 4 et 7. Zéro occurrence ailleurs. Si une autre page en utilise une, **s'arrêter et le signaler** — la règle doit alors être conservée.

- [ ] **Step 5: Vérifier la tâche**

Run: `cd web && npm run lint && npm run build`
Expected: aucune erreur (la barre n'est pas encore montée, seul le CSS a bougé).

---

### Task 3: `FilterPill` — pastille générique et son menu

Une pastille = un bouton qui ouvre un menu. Ouverture/fermeture, clic extérieur et Échap sont écrits **une fois** ici, pas cinq fois dans `FilterBar`.

**Files:**
- Create: `web/src/components/jobs/FilterPill.tsx`
- Create: `web/src/components/jobs/FilterPill.test.tsx`

**Interfaces:**
- Produces: `FilterPill({ label, value, icon?, children })`

- [ ] **Step 1: Écrire le test**

Créer `web/src/components/jobs/FilterPill.test.tsx` :

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FilterPill } from "./FilterPill";

describe("FilterPill", () => {
  afterEach(() => cleanup());

  it("affiche son nom seul quand elle ne contraint rien", () => {
    render(<FilterPill label="Contrat" value=""><p>menu</p></FilterPill>);
    const pill = screen.getByRole("button", { name: /Contrat/ });
    expect(pill).not.toHaveClass("is-set");
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("affiche sa valeur et passe en actif quand elle contraint", () => {
    render(<FilterPill label="Contrat" value="CDI, CDD"><p>menu</p></FilterPill>);
    expect(screen.getByText("CDI, CDD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contrat/ })).toHaveClass("is-set");
  });

  it("ouvre et referme le menu au clic", () => {
    render(<FilterPill label="Contrat" value=""><p>menu</p></FilterPill>);
    const pill = screen.getByRole("button", { name: /Contrat/ });
    expect(pill).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("menu")).toBeInTheDocument();
    fireEvent.click(pill);
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("referme sur Échap", () => {
    render(<FilterPill label="Contrat" value=""><p>menu</p></FilterPill>);
    fireEvent.click(screen.getByRole("button", { name: /Contrat/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("referme au clic à l'extérieur", () => {
    render(<div><FilterPill label="Contrat" value=""><p>menu</p></FilterPill><button>ailleurs</button></div>);
    fireEvent.click(screen.getByRole("button", { name: /Contrat/ }));
    fireEvent.mouseDown(screen.getByText("ailleurs"));
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("garde le menu ouvert quand on clique dedans", () => {
    render(<FilterPill label="Contrat" value=""><button>option</button></FilterPill>);
    fireEvent.click(screen.getByRole("button", { name: /Contrat/ }));
    fireEvent.mouseDown(screen.getByText("option"));
    expect(screen.getByText("option")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/components/jobs/FilterPill.test.tsx`
Expected: FAIL — `Failed to resolve import "./FilterPill"`.

- [ ] **Step 3: Écrire le composant**

Créer `web/src/components/jobs/FilterPill.tsx` :

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Pastille de filtre : un bouton, un menu. Trois états visuels seulement —
 * par défaut (grise, nom seul), active (anneau orange + valeur), ouverte
 * (enfoncée). Le menu se ferme sur Échap et au clic extérieur : sans ça, sur
 * une barre à six pastilles, on en laisse trois ouvertes derrière soi.
 */
export function FilterPill({
  label, value, icon, children,
}: {
  label: string;
  /** Valeur affichée à droite du nom. "" ⇒ la pastille ne contraint rien. */
  value: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flt-pill-wrap" ref={root}>
      <button
        type="button"
        className={`flt-pill ${value ? "is-set" : ""} ${open ? "is-open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        {label}
        {value && <span className="flt-pill__val">{value}</span>}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
        </svg>
      </button>
      {open && <div className="flt-menu">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Ajouter le conteneur positionné en CSS**

`.flt-menu` est `position: absolute` : il lui faut un parent positionné. Ajouter dans `globals.css`, à côté de `.flt-pill` :

```css
.flt-pill-wrap { position: relative; display: inline-flex; }
```

- [ ] **Step 5: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/components/jobs/FilterPill.test.tsx`
Expected: PASS.

- [ ] **Step 6: Vérifier la tâche**

Run: `cd web && npm run lint && npm run build`
Expected: aucune erreur.

---

### Task 4: `SourcePicker` réécrit en options de menu

Le composant existe et fonctionne, mais son markup (`.jf-sources` avec titre et note en dessous) était fait pour vivre dans un formulaire. Dans un menu de pastille, il rend des `.flt-opt`.

**Files:**
- Modify: `web/src/components/jobs/SourcePicker.tsx`
- Modify: `web/src/components/jobs/SourcePicker.test.tsx`

- [ ] **Step 1: Adapter le test existant**

Les quatre tests actuels restent valides sur le fond (trois sources affichées, quotas, bascule, état coché). Ne changer que ce qui dépend du markup :

- `"183/200 ce mois"` → `"183/200"` (la mention « ce mois » passe dans la note de bas de menu, la place manque dans une ligne d'option).
- Ajouter un test : le menu porte un titre « Où chercher ».

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/components/jobs/SourcePicker.test.tsx`
Expected: FAIL sur les libellés de quota et le titre absent.

- [ ] **Step 3: Réécrire le corps du composant**

Remplacer le `return` de `SourcePicker.tsx` par le markup de menu (cf. maquette `body-filters.html`, bloc « Où chercher ») :

```tsx
  return (
    <>
      <div className="flt-menu__title">Où chercher</div>
      {SOURCES.map((s) => (
        <label key={s.id} className="flt-opt">
          <input
            type="checkbox"
            checked={value[s.id]}
            aria-label={s.label}
            onChange={() => onChange({ ...value, [s.id]: !value[s.id] })}
          />
          <BoardIcon domain={SOURCE_DOMAIN[s.id]} name={s.label} />
          {s.label}
          <span className="flt-opt__sub">
            {s.monthlyQuota == null ? "illimité" : `${usage[s.id]}/${s.monthlyQuota}`}
          </span>
        </label>
      ))}
      <div className="flt-menu__sep" />
      <p className="flt-menu__note">
        Décocher une source, c&apos;est ne pas l&apos;interroger : son quota mensuel est
        préservé. Compteur local et indicatif, remis à zéro chaque mois.
      </p>
    </>
  );
```

Mettre à jour le commentaire de tête du composant : il dit aujourd'hui « Vit dans le panneau "Mes critères", replié par défaut » — c'est devenu faux. Le quota vit désormais **à l'endroit où l'on décide d'interroger une source**, c'est-à-dire là où il éclaire la décision.

Adapter le CSS de `BoardIcon` dans un menu : `.flt-opt .job-src { width: 19px; height: 19px; }`.

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/components/jobs/SourcePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Vérifier la tâche**

Run: `cd web && npm run lint && npm run build`
Expected: aucune erreur.

---

### Task 5: `MoreFilters` — le panneau des réglages rares

Onze champs qu'on règle une fois puis qu'on oublie. Rangés, pas cachés : le panneau s'ouvre sous la barre et la pastille porte un compteur de ce qui y est actif.

**Files:**
- Create: `web/src/components/jobs/MoreFilters.tsx`
- Create: `web/src/components/jobs/MoreFilters.test.tsx`

**Interfaces:**
- Produces: `MoreFilters({ profile, onChange })`
- Requires: `TagInput` — **déplacer** la fonction `TagInput` de `ProfileForm.tsx` (lignes 18-63) vers son propre fichier `web/src/components/jobs/TagInput.tsx` et l'exporter, puisque `ProfileForm` est supprimé à la tâche 7.

- [ ] **Step 1: Extraire `TagInput`**

Créer `web/src/components/jobs/TagInput.tsx` avec la fonction déplacée telle quelle (ajouter `"use client";` et `export`). Ne pas la modifier : elle marche.

- [ ] **Step 2: Écrire le test**

Créer `web/src/components/jobs/MoreFilters.test.tsx`. Il doit couvrir le point qui compte — **aucun champ perdu** :

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EMPTY_PROFILE } from "@/lib/jobs/profile";
import { MoreFilters } from "./MoreFilters";

describe("MoreFilters", () => {
  afterEach(() => cleanup());

  // Ce test est le garde-fou de la refonte : chaque réglage de l'ancien
  // formulaire doit rester atteignable, sinon on perd des fonctionnalités
  // en silence en croyant ne changer que l'affichage.
  it("expose les onze réglages du panneau", () => {
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={() => {}} />);
    for (const label of [
      /Compétences/, /Mots à exclure/, /Mots-clés à inclure/, /Codes ROME/,
      /Salaire minimum/, /Période/, /Qualification/, /Score minimum/,
      /Offres notées/, /Adresse de départ/, /Résumé candidat/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("remonte une modification", () => {
    const onChange = vi.fn();
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Score minimum/), { target: { value: "85" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minScore: 85 }));
  });
});
```

- [ ] **Step 3: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/components/jobs/MoreFilters.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Écrire le composant**

Créer `web/src/components/jobs/MoreFilters.tsx` : une grille `.flt-more` de `.flt-field`, reprenant les champs de l'ancienne section `jf-advanced` **plus** `includeKeywords`, `qualification` et `periodeSalaire`. Structure de chaque champ, d'après la maquette :

```tsx
<div className="flt-field">
  <label className="flt-field__label" htmlFor="flt-score">Score minimum pour retenir une offre</label>
  <input id="flt-score" className="flt-text" type="number" min={0} max={100}
    value={profile.minScore}
    onChange={(e) => set("minScore", Number(e.target.value))} />
  <span className="flt-field__note">Sous ce score, l&apos;offre n&apos;est pas enregistrée.</span>
</div>
```

Points d'attention :
- **Chaque champ doit avoir un `htmlFor`/`id` appariés** — les `getByLabelText` du test en dépendent, et l'ancien formulaire s'appuyait sur l'imbrication `<label>`, qui ne marche pas pour les `TagInput` (le label ne contient pas l'input).
- `homeAddress` et `candidateSummary` en `.flt-field--wide` (pleine largeur).
- Ordre des champs : les plus utiles d'abord — compétences, mots à exclure, mots-clés à inclure, salaire + période, score minimum, offres notées, qualification, codes ROME, puis adresse et résumé en pleine largeur.
- Conserver les notes explicatives existantes (« Écarte sans IA les offres sans aucun recoupement. »).

- [ ] **Step 5: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/components/jobs/MoreFilters.test.tsx`
Expected: PASS.

- [ ] **Step 6: Vérifier la tâche**

Run: `cd web && npm run lint && npm run build`
Expected: aucune erreur.

---

### Task 6: `FilterBar` — assemblage

**Files:**
- Create: `web/src/components/jobs/FilterBar.tsx`
- Create: `web/src/components/jobs/FilterBar.test.tsx`

**Interfaces:**
- Produces: `FilterBar({ profile, onChange, usage, resultCount, canScan, scanning, onScan })`

- [ ] **Step 1: Écrire le test**

Créer `web/src/components/jobs/FilterBar.test.tsx` :

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EMPTY_PROFILE } from "@/lib/jobs/profile";
import { FilterBar } from "./FilterBar";

const usage = { francetravail: 0, adzuna: 0, jsearch: 0 };
const base = {
  profile: EMPTY_PROFILE, onChange: () => {}, usage,
  resultCount: 0, canScan: false, scanning: false, onScan: () => {},
};

describe("FilterBar", () => {
  afterEach(() => cleanup());

  it("s'annonce comme « Filtres »", () => {
    render(<FilterBar {...base} />);
    expect(screen.getByLabelText("Filtres")).toBeInTheDocument();
  });

  it("affiche les cinq pastilles et « Plus de filtres »", () => {
    render(<FilterBar {...base} />);
    for (const n of [/Contrat/, /Publiée depuis/, /Expérience/, /Temps de travail/, /source/, /Plus de filtres/]) {
      expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    }
  });

  it("désarme « Rechercher » sans poste renseigné", () => {
    render(<FilterBar {...base} />);
    expect(screen.getByRole("button", { name: /Rechercher/ })).toBeDisabled();
  });

  it("lance la recherche quand un poste est renseigné", () => {
    const onScan = vi.fn();
    render(<FilterBar {...base} canScan onScan={onScan} />);
    fireEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    expect(onScan).toHaveBeenCalled();
  });

  it("affiche le nombre d'offres retenues", () => {
    render(<FilterBar {...base} resultCount={28} />);
    expect(screen.getByText(/28/)).toBeInTheDocument();
  });

  it("montre « Réinitialiser » seulement quand un filtre contraint", () => {
    render(<FilterBar {...base} />);
    expect(screen.queryByRole("button", { name: /Réinitialiser/ })).not.toBeInTheDocument();
    cleanup();
    render(<FilterBar {...base} profile={{ ...EMPTY_PROFILE, maxAgeDays: 7 }} />);
    expect(screen.getByRole("button", { name: /Réinitialiser/ })).toBeInTheDocument();
  });

  it("réinitialise les filtres sans toucher au poste", () => {
    const onChange = vi.fn();
    const p = { ...EMPTY_PROFILE, keywords: ["Webmaster"], maxAgeDays: 7 };
    render(<FilterBar {...base} profile={p} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Réinitialiser/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxAgeDays: 30, keywords: ["Webmaster"] }));
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd web && npx vitest run src/components/jobs/FilterBar.test.tsx`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le composant**

Créer `web/src/components/jobs/FilterBar.tsx`, en suivant le markup de `docs/design/jobs/_bar.html` :

- `<section className="flt" aria-label="Filtres">`
- **Étage 1** `.flt-search` : `.flt-box--role` contenant `<MetierInput>`, `.flt-box--place` contenant `<LocationInput>`, puis `<button className="flt-go" disabled={!canScan || scanning}>` avec le libellé `scanning ? "Recherche en cours…" : "Rechercher"`.
- **Étage 2** `.flt-row` : cinq `<FilterPill>` puis la pastille « Plus de filtres », un `.flt-spacer`, `.flt-results` (`{resultCount} offres retenues`), et `.flt-reset` conditionné par `hasActiveFilters(profile)`.
- **Panneau** : `{showMore && <MoreFilters …/>}` sous la `.flt-row`. « Plus de filtres » est un simple bouton à état local (pas un `FilterPill` : son contenu s'ouvre en pleine largeur sous la barre, pas en menu flottant), avec `<span className="flt-count">{moreFiltersCount(profile)}</span>` quand le compte est > 0.

Contenu des menus, tous tirés de `filters.ts` :
- **Contrat** : cases à cocher sur `CONTRACT_OPTIONS`.
- **Publiée depuis** : boutons radio-like sur `AGE_OPTIONS`, avec une première option « Peu importe » qui remet `maxAgeDays` à 30 ; coche `.flt-opt__tick` sur l'option retenue.
- **Expérience** : `EXPERIENCE_OPTIONS` + une case « Débutant accepté » séparée par un `.flt-menu__sep`.
- **Temps de travail** : `WORK_TIME_OPTIONS`.
- **Sources** : `<SourcePicker>`. Sa pastille porte les trois favicons superposés en guise d'icône (cf. `_bar.html`) et `sourcesLabel(profile.sources)` en valeur — cette pastille est **toujours** en état actif, puisqu'elle indique en permanence combien de sources sont interrogées.

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `cd web && npx vitest run src/components/jobs/FilterBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Vérifier la tâche**

Run: `cd web && npm run lint && npm run build`
Expected: aucune erreur.

---

### Task 7: Brancher la barre dans `JobsView`, supprimer l'ancien formulaire

**Files:**
- Modify: `web/src/components/jobs/JobsView.tsx`
- Delete: `web/src/components/jobs/ProfileForm.tsx`
- Delete: `web/src/lib/jobs/summary.ts`
- Delete: `web/src/lib/jobs/summary.test.ts`

- [ ] **Step 1: Remplacer le bloc « Mes critères » par la barre**

Dans `JobsView.tsx` :

- Supprimer les imports `ProfileForm` et `summarizeProfile`, ajouter `FilterBar`.
- Supprimer l'état `showForm` **et son usage à l'ouverture** : `getJobProfile().then(...)` faisait `setShowForm(true)` quand aucun profil n'existait. La barre étant toujours visible, ce cas n'a plus d'objet — garder uniquement `if (p) setProfile(parseProfile(p));`.
- Supprimer le bloc `<div className="jobs-form-bar">…</div>` et le `{showForm && <ProfileForm …/>}`.
- Insérer `<FilterBar>` à leur place, entre `<ScoringInfo>` et `<div className="jobs-toolbar">` :

```tsx
<FilterBar
  profile={profile}
  onChange={updateProfile}
  usage={usage}
  resultCount={jobs.length}
  canScan={canScan}
  scanning={scanning}
  onScan={() => scan()}
/>
```

- **Déplacer le bouton de recherche** : il vit désormais dans la barre. Vider `.jobs-toolbar` de son `<button className="tailor-btn">` et du `<span className="jobs-hint">` (la barre désarme déjà son bouton) ; n'y laisser que `{scanning ? <ScanProgress {...progress} /> : null}`.

⚠️ Le test `data-testid="jobs-scan"` disparaît avec ce bouton. Vérifier qu'aucun test ne l'utilise (`grep -rn "jobs-scan" src/`) et adapter si besoin.

- [ ] **Step 2: Supprimer les fichiers morts**

```bash
cd web && rm src/components/jobs/ProfileForm.tsx src/lib/jobs/summary.ts src/lib/jobs/summary.test.ts
```

- [ ] **Step 3: Vérifier qu'aucune référence ne subsiste**

Run: `cd web && grep -rn "ProfileForm\|summarizeProfile\|jobs-summary\|showForm" src/`
Expected: aucune sortie.

- [ ] **Step 4: Vérifier la tâche**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: toute la suite verte, aucune erreur.

---

### Task 8: Libellés résiduels

Deux textes désignent encore le panneau disparu. Les laisser, c'est renvoyer l'utilisateur vers un bouton qui n'existe plus.

**Files:**
- Modify: `web/src/components/jobs/ScoringInfo.tsx:20`
- Modify: `web/src/components/jobs/JobsView.tsx` (écran `configMsg`)

- [ ] **Step 1: Corriger `ScoringInfo`**

`Offres issues des sources cochées dans « Mes critères »` → `Offres issues des sources cochées dans «&nbsp;Où chercher&nbsp;»`.

- [ ] **Step 2: Corriger l'écran de configuration manquante**

`Renseigne les variables d'environnement des sources que tu as cochées dans « Mes critères de recherche ».` → `… dans «&nbsp;Où chercher&nbsp;».`

- [ ] **Step 3: Vérifier qu'aucun « critère » ne traîne**

Run: `cd web && grep -rni "mes critères\|critères de recherche" src/`
Expected: aucune sortie.

- [ ] **Step 4: Vérifier la tâche**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout vert.

---

### Task 9: Vérification finale et documentation

- [ ] **Step 1: Suite complète**

Run: `cd web && npm test && npm run lint && npm run build`
Expected: tout vert. **Lire la sortie**, ne pas se contenter du code de retour.

- [ ] **Step 2: Vérification navigateur — la partie qui attrape ce que les tests ratent**

Lancer le serveur de dev (`preview_start`, config `web`), aller sur `/offres` avec **un profil déjà enregistré** (pas un profil vierge — c'est exactement le cas qu'aucun test ne couvre, et celui qui a cassé la livraison précédente).

Vérifier une par une :
1. La barre s'affiche sans clic préalable ; le poste et le lieu enregistrés y sont visibles.
2. Chaque pastille ouvre son menu ; Échap et un clic à côté le referment.
3. Cocher un contrat fait passer la pastille en orange avec sa valeur ; la décocher la remet grise.
4. L'autocomplétion du poste et du lieu s'affiche **par-dessus** la barre et n'est pas rognée (`.flt-box` ne doit pas avoir d'`overflow: hidden`).
5. Le rayon apparaît en ligne dans le champ de lieu dès qu'une commune est sélectionnée.
6. « Plus de filtres » ouvre le panneau, affiche son compteur, et les onze champs sont éditables.
7. « Rechercher » est désarmé sans poste, actif avec, et lance bien un scan.
8. Console navigateur : aucune erreur.
9. Thème sombre (`resize_window` avec `colorScheme: "dark"`) : contraste correct sur les pastilles et les menus.
10. Largeur mobile (375 px) : les deux champs passent en colonne, les pastilles restent atteignables, rien ne déborde horizontalement.

- [ ] **Step 3: Mettre à jour la documentation**

- `PROJECT_INDEX.md` : la section décrivant l'onglet Offres mentionne le formulaire de critères — la remplacer par la barre de filtres. Retirer `ProfileForm` et `summary.ts` de toute liste de fichiers.
- `WORK_HISTORY.md` : entrée de journal datée, disant ce qui a changé **et pourquoi** (le panneau cachait ce qui contraignait les résultats), plus les trois hypothèses posées en tête de ce plan.

- [ ] **Step 4: Mettre les maquettes en cohérence**

`docs/design/jobs/page-light.html` et `page-dark.html` affichent déjà la barre proposée : elles redeviennent conformes au code livré. Le commit `52b72ea` les annonçait comme « PROPOSITION — non implémentée » ; le message de commit de cette implémentation doit dire explicitement que ce n'est plus le cas.

- [ ] **Step 5: Commit**

Un commit par tâche pendant l'implémentation ; message final décrivant la refonte, pas la liste des fichiers.

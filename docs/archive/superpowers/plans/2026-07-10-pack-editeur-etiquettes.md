# Refonte Pack candidature — page /pack + éditeur à étiquettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la modale « Pack candidature » en une page `/pack` pleine largeur dont le corps de la lettre et de l'email s'éditent via un éditeur à étiquettes (variables inline), sans dépendance ajoutée.

**Architecture:** On procède par couches sûres. D'abord on sort le Pack de la modale-dans-la-modale en une page `/pack` à parité fonctionnelle (port de la logique existante). Puis on réduit les modèles par défaut à un seul. Puis on ajoute la brique pure `parseTokens`, le composant `VariableEditor` (custom `contentEditable`, pastilles atomiques), et enfin la disposition finale (dépliant « Personnaliser », sélecteur discret, CSS, mobile).

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Zustand, CSS global unique (`src/app/globals.css`), Vitest, Playwright. **Aucune** bibliothèque d'édition ajoutée.

**Spec de référence:** `docs/archive/superpowers/specs/2026-07-10-pack-editeur-etiquettes-design.md`

## Global Constraints

Depuis `web/CADRAGE_EXECUTION.md`, valables pour **toutes** les tasks :

- Branche `feature/refonte-ui-nextjs`. **Aucun `git push`** (déploie la prod Vercel). Aucune création de branche, aucun merge.
- Toutes les commandes depuis `web/`.
- **Aucune dépendance npm ajoutée** (l'éditeur à étiquettes est fait maison — décision actée).
- **Aucune couleur en dur** : variables de thème de `src/app/globals.css` (`var(--bg)`, `var(--orange-text)`…).
- Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté. TypeScript strict compile.
- Jamais `alert`/`confirm`/`prompt` natifs → `uiConfirm`/`toast` de `@/state/uiStore`.
- **La photo (base64) n'est jamais envoyée à l'IA** : `{ ...cv, photo: "" }` conservé dans `adaptWithAi`.
- Un test existant ne se modifie que si la task l'ordonne explicitement (ici `tests/e2e/pack.spec.ts` est explicitement mis à jour — c'est une migration de point d'entrée et de layout).
- Vérification après **chaque** task, sortie lue et collée :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  npm run build
  npx playwright test
  ```
- Après chaque task : entrée datée en tête de `## Journal` de `WORK_HISTORY.md` (racine) + mise à jour de « Prochaine étape suggérée ». Un commit local par task, message en français.
- **Piège Turbopack/CSS périmé (Windows)** : si un changement CSS ne s'affiche pas ou qu'un e2e échoue bizarrement → tuer le process sur le port 3000, supprimer `web/.next`, relancer. Vérifié cette session : `playwright.config.ts` a `reuseExistingServer: true` sur `npm run dev`, donc un serveur périmé sert un CSS obsolète.

## Structure des fichiers

| Fichier | Rôle | Tasks |
|---|---|---|
| `src/app/pack/page.tsx` | **Créer** — page serveur `/pack` (métadonnées + `<PackView/>`) | 1 |
| `src/components/pack/PackView.tsx` | **Créer** — logique du Pack (port de PackModal, sans châssis modale) | 1, 4, 5 |
| `src/components/modals/PackModal.tsx` | **Supprimer** — remplacé par PackView | 1 |
| `src/components/modals/TailorModal.tsx` | **Modifier** — bouton « Créer le Pack » navigue vers `/pack` | 1 |
| `src/components/jobs/JobsView.tsx` | **Modifier** — « Candidater » navigue vers `/pack` | 1 |
| `src/state/docStore.ts` | **Modifier** — retrait de `pendingPackOpen` | 1 |
| `src/lib/templates/defaults.ts` | **Modifier** — un seul modèle par défaut | 2 |
| `src/lib/templates/tokens.ts` | **Créer** — `parseTokens` (pur) | 3 |
| `src/lib/templates/tokens.test.ts` | **Créer** — tests Vitest de `parseTokens` | 3 |
| `src/components/pack/VariableEditor.tsx` | **Créer** — éditeur à étiquettes | 4 |
| `src/components/pack/TemplateEditorPanel.tsx` | **Modifier** — champs longs via VariableEditor | 4 |
| `src/app/globals.css` | **Modifier** — `.pack-page`, `.var-editor`, `.var-pill`, layout, mobile | 1, 5 |
| `tests/e2e/pack.spec.ts` | **Modifier** — nouveau point d'entrée `/pack`, seed=1, éditeur à étiquettes | 1, 2, 4, 5 |

---

### Task 1: Page /pack à parité fonctionnelle (sortie de la modale-dans-la-modale)

Sort le Pack en page dédiée `/pack` en portant la logique de `PackModal`, sans rien changer aux fonctions. Rewire les points d'entrée et supprime `pendingPackOpen`.

**Files:**
- Create: `src/app/pack/page.tsx`
- Create: `src/components/pack/PackView.tsx`
- Delete: `src/components/modals/PackModal.tsx`
- Modify: `src/components/modals/TailorModal.tsx`
- Modify: `src/components/jobs/JobsView.tsx:148-155`
- Modify: `src/state/docStore.ts` (l.47, 73, 92, 106)
- Modify: `src/app/globals.css` (ajout `.pack-page`)
- Test: `tests/e2e/pack.spec.ts`

**Interfaces:**
- Consomme : `useDocStore` (`pendingJobDesc`, `company`, `role`, `json`, setters) ; `buildLetterFromTemplate`, `renderEmail` ; `generateLetterPdfBlob(letter, [])` ; `PdfPreview({ blob })` ; `ensureDefaultTemplates`, `listTemplates`, `saveTemplate`, `deleteTemplate`, `saveDraft` ; `postJson`, `fetchJobMeta`, `JobExtractor`, `TemplateEditorPanel`.
- Produit : la route `/pack` rendant `<PackView/>`. `PackView` lit `pendingJobDesc` à l'init puis le remet à `null`.

- [ ] **Step 1: Mettre le test au nouveau point d'entrée (échoue d'abord)**

Dans `tests/e2e/pack.spec.ts`, remplacer les 3 endroits qui font :
```ts
  await page.goto("/");
  await page.getByRole("button", { name: "Adapter à une offre" }).click();
  await page.getByRole("button", { name: "Créer le Pack candidature" }).click();
  const modal = page.locator(".pack-modal");
```
par une navigation directe vers la page et un conteneur page :
```ts
  await page.goto("/pack");
  const modal = page.locator(".pack-page");
```
(Le test 2 déclare `const modal = page.locator(".pack-modal")` en l.80 ; le test 3 utilise aussi `.pack-modal` implicitement via `.pack-tpl-bar`. Remplacer chaque `page.locator(".pack-modal")` par `page.locator(".pack-page")` et supprimer les deux lignes de clic « Adapter » / « Créer le Pack ».)

- [ ] **Step 2: Lancer le test — il échoue**

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: FAIL — `/pack` renvoie 404 (page inexistante).

- [ ] **Step 3: Créer la page serveur `/pack`**

Créer `src/app/pack/page.tsx` :
```tsx
import PackView from "@/components/pack/PackView";

export const metadata = {
  title: "Pack candidature — CV Tailor",
};

export default function PackPage() {
  return <PackView />;
}
```

- [ ] **Step 4: Créer `PackView` en portant `PackModal`**

Créer `src/components/pack/PackView.tsx` en **copiant intégralement le contenu de `src/components/modals/PackModal.tsx`**, puis en appliquant EXACTEMENT ces changements :

1. Remplacer l'en-tête d'imports et la signature. Ancien début (l.1-33 de PackModal) → nouveau :
```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import { generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import PdfPreview from "../editor/PdfPreview";
import TemplateEditorPanel from "../pack/TemplateEditorPanel";
import type { Resume } from "@/lib/resume/schema";
import type { MailTemplate } from "@/lib/templates/defaults";
import { buildLetterFromTemplate, renderEmail } from "@/lib/templates/build";
import type { TemplateVars } from "@/lib/templates/render";
import { ensureDefaultTemplates, listTemplates, saveTemplate, deleteTemplate, saveDraft } from "@/lib/storage/db";
import { toast, uiConfirm } from "@/state/uiStore";
import JobExtractor from "./JobExtractor";

/**
 * Page « Pack candidature » (/pack) : lettre + email construits depuis un modèle à
 * variables (bibliothèque locale, zéro IA par défaut). IA optionnelle : « Adapter à
 * l'offre » ajuste le corps de la lettre au texte de l'offre (photo jamais envoyée).
 */
export default function PackView() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [tpl, setTpl] = useState<MailTemplate | null>(null);
  const [company, setCompanyLocal] = useState(() => useDocStore.getState().company);
  const [role, setRoleLocal] = useState(() => useDocStore.getState().role);
  const [contact, setContact] = useState("");
  const [jobDesc, setJobDesc] = useState(() =>
    typeof window !== "undefined" ? useDocStore.getState().pendingJobDesc ?? "" : "",
  );
  const [busy, setBusy] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Consomme l'offre en attente (depuis TailorModal ou « Candidater ») une fois lue.
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
  }, []);
```

2. **Supprimer** le bloc `open`/`prevOpen` de PackModal (l.24-49) : la page est toujours « ouverte », il n'y a plus de prop `open`, ni `initialJobDesc`, ni le `useState(prevOpen)`.

3. Dans l'effet de chargement des modèles (PackModal l.52-60), **retirer le garde `if (!open) return;`** et la dépendance `[open]` → effet à dépendance vide `[]` :
```tsx
  useEffect(() => {
    (async () => {
      await ensureDefaultTemplates();
      const all = await listTemplates();
      setTemplates(all);
      setTpl((cur) => cur ?? all[0] ?? null);
    })();
  }, []);
```

4. **Supprimer** la ligne `useEscapeClose(open && !busy, onClose);` (PackModal l.94) et **supprimer** `if (!open) return null;` (l.96) et l'import `useEscapeClose` (déjà retiré au point 1).

5. Dans `loadLetter`, remplacer `onClose();` (dernière ligne) par `router.push("/");` (charger la lettre puis revenir à l'éditeur).

6. Remplacer tout le `return (...)` (PackModal l.204-298) par la nouvelle structure de page (parité de contenu, sans châssis modale) :
```tsx
  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Pack candidature</h1>
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
        <div className="pack-tpl-bar">
          <select
            className="form-input"
            value={tpl?.id ?? ""}
            onChange={(e) => selectTpl(e.target.value)}
            disabled={busy}
            aria-label="Choisir un modèle"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>Enregistrer</button>
          <button type="button" className="form-btn-mini" onClick={onDuplicateTpl} disabled={busy || !tpl}>Dupliquer</button>
          <button type="button" className="form-btn-mini" onClick={onDeleteTpl} disabled={busy || !tpl}>Supprimer</button>
        </div>

        <div className="pack-vars">
          <input className="form-input" placeholder="Entreprise" value={company}
            onChange={(e) => setCompanyLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Poste visé" value={role}
            onChange={(e) => setRoleLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Contact — ex. Madame Dupont (optionnel)" value={contact}
            onChange={(e) => setContact(e.target.value)} disabled={busy} />
        </div>

        <JobExtractor onExtracted={(text) => { setJobDesc(text); void prefillFromJob(text); }} disabled={busy} />
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Offre d'emploi (optionnel) — sert au bouton « Adapter à l'offre » et au préremplissage des champs…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          onBlur={() => void prefillFromJob(jobDesc)}
          disabled={busy}
        />

        <div className="pack-result">
          <div className="pack-col">
            {tpl ? <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} /> : null}
            <button type="button" className="go" onClick={adaptWithAi} disabled={busy || !tpl}>
              {busy ? "Adaptation…" : "✨ Adapter à l'offre (IA)"}
            </button>
          </div>

          <div className="pack-col">
            <div className="pack-letter-title">Lettre de motivation</div>
            {pdfBlob ? (
              <PdfPreview blob={pdfBlob} />
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isCv ? "Génération de l'aperçu…" : "Charge d'abord un CV dans l'éditeur."}
              </div>
            )}
            <button type="button" className="go" onClick={loadLetter} disabled={busy || !letter}>
              {"Insérer dans l'éditeur (Lettre)"}
            </button>

            <div className="pack-letter-title">{"Email d'accompagnement"}</div>
            <textarea
              className="form-textarea pack-email"
              readOnly
              value={email ? `Objet : ${email.subject}\n\n${email.body}` : ""}
            />
            <button type="button" className="go" onClick={copyEmail} disabled={busy || !email}>
              {"📋 Copier l'email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Tout le reste de PackModal (les handlers `patchTpl`, `selectTpl`, `prefillFromJob`, `onSaveTpl`, `onDuplicateTpl`, `onDeleteTpl`, `adaptWithAi`, `loadLetter`, `copyEmail`, les `useMemo` `vars`/`letter`/`email`, l'effet PDF debouncé, `cv`/`isCv`/`today`) est **copié tel quel**, à l'unique exception du `router.push("/")` dans `loadLetter` (point 5).

- [ ] **Step 5: Supprimer `PackModal.tsx`**

```bash
git rm src/components/modals/PackModal.tsx
```

- [ ] **Step 6: Rewire TailorModal**

Dans `src/components/modals/TailorModal.tsx` :

- Supprimer l'import `import PackModal from "./PackModal";` (l.10) et ajouter `import { useRouter } from "next/navigation";`.
- Ajouter `const router = useRouter();` en tête du composant (après `export default function TailorModal(...) {`).
- Supprimer l'état `packOpen` (l.51-54) :
```tsx
  // « Candidater » depuis l'onglet Offres : le Pack s'ouvre directement par-dessus.
  const [packOpen, setPackOpen] = useState(
    () => typeof window !== "undefined" && useDocStore.getState().pendingPackOpen,
  );
```
- Dans l'effet (l.59-62), supprimer la ligne `useDocStore.getState().setPendingPackOpen(false);` (garder le reste).
- l.65 : `useEscapeClose(open && !busy && !packOpen && !diffOpen, onClose);` → `useEscapeClose(open && !busy && !diffOpen, onClose);`
- Le bouton « Créer le Pack candidature » (l.208-215) : remplacer `onClick={() => setPackOpen(true)}` par :
```tsx
                  onClick={() => {
                    useDocStore.getState().setPendingJobDesc(jobDesc);
                    onClose();
                    router.push("/pack");
                  }}
```
- Supprimer la ligne `<PackModal open={packOpen} onClose={() => setPackOpen(false)} initialJobDesc={jobDesc} />` (l.223).

- [ ] **Step 7: Rewire JobsView « Candidater »**

Dans `src/components/jobs/JobsView.tsx`, remplacer `apply` (l.148-155) :
```tsx
  async function apply(job: JobEntry) {
    await markJobSeen(job.id);
    setPendingJobDesc(job.jobText);
    if (job.company) setCompany(job.company);
    if (job.title) setRole(job.title);
    router.push("/pack");
  }
```
(retrait de la ligne `useDocStore.getState().setPendingPackOpen(true);` et changement de `"/"` en `"/pack"`).

- [ ] **Step 8: Retirer `pendingPackOpen` de docStore**

Dans `src/state/docStore.ts`, supprimer les 4 lignes :
- l.47 `  pendingPackOpen: boolean;`
- l.73 `  setPendingPackOpen: (v: boolean) => void;`
- l.92 `  pendingPackOpen: false,`
- l.106 `  setPendingPackOpen: (pendingPackOpen) => set({ pendingPackOpen }),`

- [ ] **Step 9: Ajouter le CSS `.pack-page`**

Dans `src/app/globals.css`, juste après la règle `.pack-modal--result { max-width: 1060px; }` (l.343), ajouter :
```css
/* Page /pack (remplace la modale) : contenu en colonne, marge interne confortable. */
.pack-page { padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
@media (max-width: 768px) { .pack-page { padding: 14px; } }
```

- [ ] **Step 10: Lancer les tests — ils passent**

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: PASS (3 tests). Si un e2e échoue bizarrement → piège Turbopack (tuer :3000, purger `.next`, relancer).

- [ ] **Step 11: Vérification complète**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: 0 erreur tsc, 0 erreur lint, Vitest 194/194, build OK, e2e tous verts.

- [ ] **Step 12: Journal + commit**

Entrée `### 2026-07-10 : Pack candidature devient la page /pack (sortie de la modale-dans-la-modale)` en tête du `## Journal` de `WORK_HISTORY.md`.

```bash
git add src/app/pack/ src/components/pack/PackView.tsx src/components/modals/TailorModal.tsx src/components/jobs/JobsView.tsx src/state/docStore.ts src/app/globals.css tests/e2e/pack.spec.ts ../WORK_HISTORY.md
git rm src/components/modals/PackModal.tsx
git commit -m "refactor(pack): la modale Pack devient la page /pack (parite fonctionnelle)"
```

---

### Task 2: Un seul modèle par défaut

**Files:**
- Modify: `src/lib/templates/defaults.ts`
- Test: `tests/e2e/pack.spec.ts` (assertion de seed)

**Interfaces:**
- Consomme : rien.
- Produit : `DEFAULT_TEMPLATES` de longueur 1.

- [ ] **Step 1: Mettre l'assertion de seed à 1 (échoue d'abord)**

Dans `tests/e2e/pack.spec.ts` (test 1), la ligne :
```ts
  await expect(modal.getByRole("combobox", { name: "Choisir un modèle" }).locator("option")).toHaveCount(3);
```
→
```ts
  await expect(modal.getByRole("combobox", { name: "Choisir un modèle" }).locator("option")).toHaveCount(1);
```

- [ ] **Step 2: Lancer — il échoue**

Run: `npx playwright test tests/e2e/pack.spec.ts -g "sans IA"`
Expected: FAIL — 3 options seedées, attendu 1.

⚠️ Note d'environnement : `ensureDefaultTemplates` ne seede que si la base est vide. Playwright utilise un contexte neuf par test (IndexedDB vierge), donc le seed s'applique. En dev réel, une base déjà seedée à 3 n'est pas modifiée (non destructif) — conforme à la spec.

- [ ] **Step 3: Réduire `DEFAULT_TEMPLATES` à un modèle**

Dans `src/lib/templates/defaults.ts`, remplacer le tableau `DEFAULT_TEMPLATES` (l.23-94) par un seul élément « Candidature » (passe-partout offre / spontanée) :
```ts
export const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    id: "default-candidature",
    name: "Candidature",
    letterSubject: "Candidature au poste de {Poste}",
    letterGreeting: "{M/Mme Nom|Madame, Monsieur},",
    letterBody:
      "Je me permets de vous adresser ma candidature pour le poste de {Poste} au sein de {Entreprise}.\n\n" +
      "[Présentez-vous en 2-3 phrases : votre formation, votre expérience, ce qui vous caractérise. " +
      "Exemple : Diplômé d'un Master en gestion de projet, je combine rigueur d'organisation et goût du terrain.]\n\n" +
      "Ce qui m'attire chez {Entreprise}, c'est [dites pourquoi cette entreprise : son secteur, ses valeurs, " +
      "un projet récent]. Je suis convaincu que [votre atout principal] me permettrait de contribuer rapidement " +
      "à vos équipes.",
    letterSignoff: SIGNOFF,
    emailSubject: "Candidature – {Poste} – {Prénom} {Nom}",
    emailBody:
      "Bonjour {M/Mme Nom},\n\n" +
      "Je me permets de vous adresser ma candidature pour le poste de {Poste} au sein de {Entreprise}.\n\n" +
      "Vous trouverez en pièce jointe mon CV ainsi que ma lettre de motivation.\n\n" +
      "Je reste à votre disposition pour tout échange, par téléphone ou en entretien.\n\n" +
      "Cordialement,\n{Prénom} {Nom}",
    updatedAt: 0,
  },
];
```
(La constante `SIGNOFF` au-dessus reste inchangée.)

- [ ] **Step 4: Lancer — il passe**

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: PASS (3 tests ; le test 1 voit 1 option). Le test 1 vérifie ensuite le repli « Bonjour, » (contact vide) et « Madame, Monsieur, » sur le greeting : le nouveau modèle conserve ces tokens, donc ces assertions restent vertes.

- [ ] **Step 5: Vérification complète**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert.

- [ ] **Step 6: Journal + commit**

Entrée `### 2026-07-10 : Un seul modèle de Pack par défaut (infra multi-modèles conservée)`.

```bash
git add src/lib/templates/defaults.ts tests/e2e/pack.spec.ts ../WORK_HISTORY.md
git commit -m "feat(pack): reduire les modeles par defaut a un seul modele Candidature"
```

---

### Task 3: `parseTokens` — le modèle de tokens (fonctions pures)

Brique pure réutilisée par `VariableEditor` (Task 4). Testable en isolation (Vitest).

**Files:**
- Create: `src/lib/templates/tokens.ts`
- Test: `src/lib/templates/tokens.test.ts`

**Interfaces:**
- Consomme : rien.
- Produit :
  ```ts
  export type TokenSegment =
    | { type: "text"; text: string }
    | { type: "var"; name: string; raw: string };
  export function parseTokens(value: string): TokenSegment[];
  ```
  `name` = nom de la variable (partie avant `|`, trim). `raw` = token brut complet (`{Poste}` ou `{M/Mme Nom|Madame, Monsieur}`), réémis verbatim à la sérialisation → le repli est préservé.

- [ ] **Step 1: Écrire les tests (échouent d'abord)**

Créer `src/lib/templates/tokens.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { parseTokens } from "./tokens";

describe("parseTokens", () => {
  it("texte nu → un seul segment texte", () => {
    expect(parseTokens("Bonjour")).toEqual([{ type: "text", text: "Bonjour" }]);
  });

  it("chaîne vide → aucun segment", () => {
    expect(parseTokens("")).toEqual([]);
  });

  it("token simple entouré de texte", () => {
    expect(parseTokens("a {Poste} b")).toEqual([
      { type: "text", text: "a " },
      { type: "var", name: "Poste", raw: "{Poste}" },
      { type: "text", text: " b" },
    ]);
  });

  it("préserve le token brut avec repli", () => {
    expect(parseTokens("{M/Mme Nom|Madame, Monsieur},")).toEqual([
      { type: "var", name: "M/Mme Nom", raw: "{M/Mme Nom|Madame, Monsieur}" },
      { type: "text", text: "," },
    ]);
  });

  it("tokens consécutifs", () => {
    expect(parseTokens("{Prénom} {Nom}")).toEqual([
      { type: "var", name: "Prénom", raw: "{Prénom}" },
      { type: "text", text: " " },
      { type: "var", name: "Nom", raw: "{Nom}" },
    ]);
  });
});
```

- [ ] **Step 2: Lancer — ils échouent**

Run: `npx vitest run src/lib/templates/tokens.test.ts`
Expected: FAIL — module `./tokens` introuvable.

- [ ] **Step 3: Implémenter `parseTokens`**

Créer `src/lib/templates/tokens.ts` :
```ts
/**
 * Découpe une chaîne tokenisée (`"Bonjour {M/Mme Nom}, … {Poste}"`) en segments
 * texte / variable, pour l'affichage à étiquettes de `VariableEditor`.
 * Même syntaxe que `render.ts` : `{Variable}` ou `{Variable|repli}`.
 * `raw` conserve le token brut (repli inclus) pour une sérialisation fidèle.
 */
export type TokenSegment =
  | { type: "text"; text: string }
  | { type: "var"; name: string; raw: string };

const TOKEN_RE = /\{([^{}|]+)(?:\|[^{}]*)?\}/g;

export function parseTokens(value: string): TokenSegment[] {
  const segments: TokenSegment[] = [];
  let last = 0;
  for (const m of value.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ type: "text", text: value.slice(last, idx) });
    segments.push({ type: "var", name: m[1].trim(), raw: m[0] });
    last = idx + m[0].length;
  }
  if (last < value.length) segments.push({ type: "text", text: value.slice(last) });
  return segments;
}
```

- [ ] **Step 4: Lancer — ils passent**

Run: `npx vitest run src/lib/templates/tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Vérification complète**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert (Vitest 199/199 : 194 + 5).

- [ ] **Step 6: Journal + commit**

Entrée `### 2026-07-10 : parseTokens — modèle de tokens pour l'éditeur à étiquettes`.

```bash
git add src/lib/templates/tokens.ts src/lib/templates/tokens.test.ts ../WORK_HISTORY.md
git commit -m "feat(pack): parseTokens, decoupage tokenise pour l'editeur a etiquettes"
```

---

### Task 4: `VariableEditor` — l'éditeur à étiquettes

Composant `contentEditable` fait maison : pastilles inline atomiques, insertion par chips, suppression au Backspace, sérialisation vers la chaîne tokenisée. Intégré aux corps longs (lettre, email) de `TemplateEditorPanel`.

**Files:**
- Create: `src/components/pack/VariableEditor.tsx`
- Modify: `src/components/pack/TemplateEditorPanel.tsx`
- Modify: `src/app/globals.css` (`.var-editor`, `.var-pill`)
- Test: `tests/e2e/pack.spec.ts`

**Interfaces:**
- Consomme : `parseTokens`, `TokenSegment` (Task 3) ; `TEMPLATE_VARIABLES` (`@/lib/templates/render`).
- Produit :
  ```ts
  function VariableEditor(props: {
    value: string;
    onChange: (next: string) => void;
    variables: readonly string[];
    disabled?: boolean;
    ariaLabel: string;
    minHeightPx?: number;
  }): JSX.Element
  ```
  Rend une zone `.var-editor` (`contentEditable`) précédée d'une rangée de chips `.var-btn`. Expose `data-value={value}` sur la zone éditable (crochet de test déterministe).

- [ ] **Step 1: Écrire le test e2e (échoue d'abord)**

Ajouter à la fin de `tests/e2e/pack.spec.ts` :
```ts
test("l'éditeur à étiquettes insère et supprime une variable dans le corps de la lettre", async ({ page }) => {
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );
  await page.goto("/pack");

  // La zone d'édition du corps de la lettre est un éditeur à étiquettes.
  const group = page.locator(".var-editor-group", {
    has: page.locator('[aria-label="Corps de la lettre"]'),
  });
  const body = group.locator('.var-editor[aria-label="Corps de la lettre"]');
  await expect(body).toBeVisible();

  // Vider puis insérer la variable Poste via la chip du même groupe.
  await body.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await group.locator(".var-btn", { hasText: "Poste" }).click();

  // Une pastille « Poste » apparaît, et la valeur tokenisée contient {Poste}.
  await expect(body.locator(".var-pill")).toHaveText("Poste");
  await expect(body).toHaveAttribute("data-value", /\{Poste\}/);

  // Supprimer la pastille (curseur après elle → Backspace) la retire.
  await body.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await expect(body.locator(".var-pill")).toHaveCount(0);
  await expect(body).not.toHaveAttribute("data-value", /\{Poste\}/);
});
```

- [ ] **Step 2: Lancer — il échoue**

Run: `npx playwright test tests/e2e/pack.spec.ts -g "éditeur à étiquettes"`
Expected: FAIL — `.var-editor` inexistant (les corps sont encore des `<textarea>`).

- [ ] **Step 3: Implémenter `VariableEditor`**

Créer `src/components/pack/VariableEditor.tsx` :
```tsx
"use client";

import { useEffect, useRef } from "react";
import { parseTokens, type TokenSegment } from "@/lib/templates/tokens";

/**
 * Éditeur à étiquettes (variables inline), fait maison, sans dépendance.
 * La chaîne tokenisée `value` est la source de vérité ; les tokens `{Var}` sont
 * affichés comme pastilles atomiques (`contentEditable={false}`). La saisie est
 * resérialisée vers la même syntaxe et remontée via `onChange`. Le token brut
 * (repli inclus) est conservé dans `data-token`, donc réémis fidèlement.
 */
export default function VariableEditor({
  value,
  onChange,
  variables,
  disabled,
  ariaLabel,
  minHeightPx = 120,
}: {
  value: string;
  onChange: (next: string) => void;
  variables: readonly string[];
  disabled?: boolean;
  ariaLabel: string;
  minHeightPx?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Dernière valeur émise par CE composant : sert à ignorer les re-render dus à
  // notre propre onChange (sinon le curseur saute pendant la frappe).
  const lastEmitted = useRef<string | null>(null);

  const buildDom = (root: HTMLElement, segments: TokenSegment[]) => {
    root.textContent = "";
    for (const seg of segments) {
      if (seg.type === "text") {
        root.appendChild(document.createTextNode(seg.text));
      } else {
        const pill = document.createElement("span");
        pill.className = "var-pill";
        pill.contentEditable = "false";
        pill.dataset.token = seg.raw;
        pill.textContent = seg.name;
        root.appendChild(pill);
      }
    }
    // Nœud texte final pour que le curseur puisse se poser après une pastille terminale.
    const lastNode = root.lastChild;
    if (!lastNode || (lastNode as HTMLElement).dataset?.token) {
      root.appendChild(document.createTextNode(""));
    }
  };

  const serialize = (root: HTMLElement): string => {
    let out = "";
    root.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue ?? "";
      } else if (node instanceof HTMLElement) {
        out += node.dataset.token ?? node.textContent ?? "";
      }
    });
    return out;
  };

  // Synchronisation externe : ne reconstruit le DOM que si `value` vient d'ailleurs
  // (changement de modèle, adaptation IA), pas de notre propre saisie.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (value === lastEmitted.current) return;
    buildDom(root, parseTokens(value));
    lastEmitted.current = value;
  }, [value]);

  const emit = () => {
    const root = ref.current;
    if (!root) return;
    const next = serialize(root);
    lastEmitted.current = next;
    onChange(next);
  };

  const insertVariable = (name: string) => {
    const root = ref.current;
    if (!root || disabled) return;
    root.focus();
    const sel = window.getSelection();
    const pill = document.createElement("span");
    pill.className = "var-pill";
    pill.contentEditable = "false";
    pill.dataset.token = `{${name}}`;
    pill.textContent = name;

    let range: Range;
    if (sel && sel.rangeCount > 0 && root.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
      range.deleteContents();
    } else {
      range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }
    const after = document.createTextNode("");
    range.insertNode(after);
    range.insertNode(pill);
    // Curseur juste après la pastille insérée.
    const caret = document.createRange();
    caret.setStartAfter(pill);
    caret.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(caret);
    emit();
  };

  return (
    <div className="var-editor-group">
      <div className="var-btns" aria-label={`Insérer une variable dans ${ariaLabel}`}>
        {variables.map((v) => (
          <button key={v} type="button" className="var-btn" disabled={disabled} onClick={() => insertVariable(v)}>
            + {v}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="var-editor"
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-value={value}
        contentEditable={!disabled}
        suppressContentEditableWarning
        style={{ minHeight: minHeightPx }}
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
    </div>
  );
}
```

Note : `document.execCommand("insertText", …)` est déprécié mais reste le moyen le plus simple et universellement supporté d'insérer du texte brut dans un `contentEditable` sans dépendance ; il ne casse pas la sérialisation (le nœud texte est ensuite relu par `serialize`).

- [ ] **Step 4: Rendre les deux corps via `VariableEditor` dans `PackView` ; réduire `TemplateEditorPanel` aux champs courts**

Séparation des responsabilités : les corps (lettre, email) — ce qu'on édite le plus — sont rendus **directement dans `PackView`** via `VariableEditor`, toujours visibles. `TemplateEditorPanel` ne garde plus que les **champs courts** (objet lettre, formule d'appel, formule de politesse, objet email), qui passeront sous le dépliant « Personnaliser » en Task 5.

**4a. Réduire `TemplateEditorPanel.tsx` aux champs courts.** Réécrire `src/components/pack/TemplateEditorPanel.tsx` ainsi (suppression des deux corps, de la rangée de chips `.tpl-vars`, et de toute la logique `activeRef`/`insertVariable`/`TEMPLATE_VARIABLES` — désormais portée par `VariableEditor`) :
```tsx
"use client";

import type { MailTemplate } from "@/lib/templates/defaults";

/**
 * Champs courts d'un modèle lettre/email (objet, formule d'appel, politesse, objet
 * email). Les corps longs sont édités par `VariableEditor` dans `PackView`.
 */
export default function TemplateEditorPanel({
  tpl,
  onChange,
  disabled,
}: {
  tpl: MailTemplate;
  onChange: (patch: Partial<MailTemplate>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tpl-editor">
      <label className="form-label">Objet de la lettre</label>
      <input className="form-input" value={tpl.letterSubject} disabled={disabled}
        onChange={(e) => onChange({ letterSubject: e.target.value })} />

      <label className="form-label">Formule d&apos;appel</label>
      <input className="form-input" value={tpl.letterGreeting} disabled={disabled}
        onChange={(e) => onChange({ letterGreeting: e.target.value })} />

      <label className="form-label">Formule de politesse</label>
      <textarea className="form-textarea" rows={2} value={tpl.letterSignoff} disabled={disabled}
        onChange={(e) => onChange({ letterSignoff: e.target.value })} />

      <label className="form-label">Objet de l&apos;email</label>
      <input className="form-input" value={tpl.emailSubject} disabled={disabled}
        onChange={(e) => onChange({ emailSubject: e.target.value })} />
    </div>
  );
}
```

**4b. Rendre les deux corps dans `PackView.tsx`.** En tête, ajouter les imports :
```tsx
import VariableEditor from "./VariableEditor";
import { TEMPLATE_VARIABLES } from "@/lib/templates/render";
```
Dans la première `.pack-col` (Task 1), remplacer la ligne `{tpl ? <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} /> : null}` par les deux éditeurs à étiquettes (les champs courts + `TemplateEditorPanel` reviendront sous le dépliant en Task 5) :
```tsx
            {tpl ? (
              <>
                <label className="form-label">Corps de la lettre</label>
                <VariableEditor
                  value={tpl.letterBody}
                  onChange={(v) => patchTpl({ letterBody: v })}
                  variables={TEMPLATE_VARIABLES}
                  disabled={busy}
                  ariaLabel="Corps de la lettre"
                  minHeightPx={160}
                />
                <label className="form-label">Corps de l&apos;email</label>
                <VariableEditor
                  value={tpl.emailBody}
                  onChange={(v) => patchTpl({ emailBody: v })}
                  variables={TEMPLATE_VARIABLES}
                  disabled={busy}
                  ariaLabel="Corps de l'email"
                  minHeightPx={120}
                />
                <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} />
              </>
            ) : null}
```
(`TemplateEditorPanel` — désormais les 4 champs courts — reste visible pour l'instant ; Task 5 le déplace sous « Personnaliser ». L'import `TemplateEditorPanel` de PackView est conservé.)

⚠️ Le test `pack.spec.ts` #2 (« Adapter à l'offre (IA) ») asserte aujourd'hui `modal.locator(".tpl-editor textarea").first()` pour le corps de la lettre adapté. Le corps devient un `.var-editor` (plus un `textarea`). Mettre à jour cette assertion :
```ts
  await expect(page.locator('.var-editor[aria-label="Corps de la lettre"]')).toHaveAttribute(
    "data-value",
    "Corps adapté par l'IA pour {Entreprise}.",
  );
```
(La réponse IA mockée renvoie `body: "Corps adapté par l'IA pour {Entreprise}."` ; `VariableEditor` la reçoit comme `value` externe → `data-value` la reflète, la pastille `{Entreprise}` étant affichée.)

- [ ] **Step 5: Ajouter le CSS `.var-editor` / `.var-pill` / `.var-btns`**

Dans `src/app/globals.css`, après le bloc `.var-btn` existant (l.974-983) — qui sert déjà aux chips — ajouter :
```css
/* Éditeur à étiquettes (VariableEditor) : zone éditable + pastilles inline. */
.var-editor-group { display: flex; flex-direction: column; gap: 6px; }
.var-btns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.var-editor {
  background: var(--bg); color: var(--text); border: none; border-radius: 10px;
  padding: 10px 12px; font-size: 13px; font-family: var(--font-ui); line-height: 1.5;
  box-shadow: var(--neu-inset); outline: none; white-space: pre-wrap; overflow-wrap: anywhere;
}
.var-editor:focus { box-shadow: var(--neu-inset), 0 0 0 2px rgba(232,93,4,0.25); }
.var-pill {
  display: inline-block; padding: 0 8px; margin: 0 1px; border-radius: 999px;
  background: var(--bg); color: var(--orange-text); font-weight: 600; font-size: 12px;
  box-shadow: var(--neu-raised-sm); user-select: none; white-space: nowrap;
}
```

- [ ] **Step 6: Lancer le test ciblé — il passe**

Run: `npx playwright test tests/e2e/pack.spec.ts -g "éditeur à étiquettes"`
Expected: PASS. Si le style des pastilles n'apparaît pas → piège Turbopack (tuer :3000, purger `.next`, relancer).

- [ ] **Step 7: Lancer toute la suite Pack — elle passe**

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: PASS (4 tests, dont #2 mis à jour pour `.var-editor`).

- [ ] **Step 8: Vérification complète**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert.

- [ ] **Step 9: Journal + commit**

Entrée `### 2026-07-10 : Éditeur à étiquettes (VariableEditor) sur les corps lettre/email du Pack`.

```bash
git add src/components/pack/VariableEditor.tsx src/components/pack/TemplateEditorPanel.tsx src/app/globals.css tests/e2e/pack.spec.ts ../WORK_HISTORY.md
git commit -m "feat(pack): editeur a etiquettes (variables inline) sur les corps lettre et email"
```

---

### Task 5: Disposition finale — dépliant « Personnaliser », sélecteur discret, colonnes

Épure la page : les champs secondaires et la gestion de modèles passent sous un dépliant « Personnaliser » ; le sélecteur de modèle n'apparaît que s'il y a plus d'un modèle ; deux colonnes pleine largeur en desktop, empilées en mobile.

**Files:**
- Modify: `src/components/pack/PackView.tsx`
- Modify: `src/app/globals.css` (grille `.pack-page`, mobile)
- Test: `tests/e2e/pack.spec.ts`

**Interfaces:**
- Consomme : tout ce qui précède.
- Produit : layout final ; l'ancien test mobile « barre de modèles » est remplacé (la `.pack-tpl-bar` n'est plus une barre pleine largeur en haut).

- [ ] **Step 1: Réécrire le test mobile obsolète (échoue d'abord)**

Le test 3 `en mobile, la barre de modèles ne déborde pas de la modale` teste `.pack-tpl-bar` (qui déménage sous « Personnaliser » et n'est visible que si >1 modèle). Le remplacer par un test de disposition page :
```ts
test("en mobile, la page /pack ne déborde pas horizontalement", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );
  await page.goto("/pack");

  const pageEl = page.locator(".pack-page");
  await expect(pageEl).toBeVisible();
  // Pas de scroll horizontal : le contenu tient dans la largeur.
  const overflow = await pageEl.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // Avec un seul modèle, le sélecteur de modèle n'est pas affiché.
  await expect(page.getByRole("combobox", { name: "Choisir un modèle" })).toHaveCount(0);
});
```

- [ ] **Step 2: Lancer — il échoue**

Run: `npx playwright test tests/e2e/pack.spec.ts -g "ne déborde pas horizontalement"`
Expected: FAIL — le sélecteur de modèle est encore toujours affiché (count 1, attendu 0).

- [ ] **Step 3: Sélecteur discret + gestion sous « Personnaliser » dans PackView**

Dans `src/components/pack/PackView.tsx` :

1. Ajouter un état de dépliant en tête du composant (près des autres `useState`) :
```tsx
  const [showAdvanced, setShowAdvanced] = useState(false);
```

2. **Retirer** deux choses de la vue par défaut : le bloc `.pack-tpl-bar` du haut du rendu (le `<select>` + Enregistrer/Dupliquer/Supprimer, ajouté en Task 1) **et** la ligne `<TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} />` de la zone des corps (ajoutée en Task 4). Les deux repartent sous le dépliant.

Remplacer le premier `<div className="pack-tpl-bar">…</div>` par **rien** en haut. Puis, à la fin de la première `.pack-col` (après le bouton « Adapter à l'offre (IA) »), ajouter le dépliant qui regroupe : sélecteur (si >1 modèle), champs courts (`TemplateEditorPanel`) et gestion de modèles :
```tsx
            <button
              type="button"
              className="form-btn-mini pack-advanced-toggle"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "▾ Personnaliser (modèle, objets, formules)" : "▸ Personnaliser (modèle, objets, formules)"}
            </button>
            {showAdvanced ? (
              <div className="pack-advanced">
                {templates.length > 1 ? (
                  <select
                    className="form-input"
                    value={tpl?.id ?? ""}
                    onChange={(e) => selectTpl(e.target.value)}
                    disabled={busy}
                    aria-label="Choisir un modèle"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : null}
                {tpl ? <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} /> : null}
                <div className="pack-tpl-bar">
                  <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>Enregistrer</button>
                  <button type="button" className="form-btn-mini" onClick={onDuplicateTpl} disabled={busy || !tpl}>Dupliquer</button>
                  <button type="button" className="form-btn-mini" onClick={onDeleteTpl} disabled={busy || !tpl}>Supprimer</button>
                </div>
              </div>
            ) : null}
```
Résultat de la vue par défaut : variables (Entreprise/Poste/Contact), zone offre, les **deux éditeurs à étiquettes** (corps lettre + email), le bouton « Adapter à l'offre (IA) », puis le seul bouton « ▸ Personnaliser ». Tout le reste (objets, formules, gestion de modèles) est replié.

Note : `TemplateEditorPanel` (déjà dans la `.pack-col`) contient les champs courts (objet lettre, appel, politesse, objet email) + les deux `VariableEditor`. Pour épurer la vue par défaut, déplacer les **champs courts** de `TemplateEditorPanel` sous ce dépliant est optionnel et hors périmètre de cette task ; on s'en tient à masquer sélecteur + gestion de modèles. Les deux corps (VariableEditor) restent visibles par défaut — ce sont eux qu'on édite le plus.

- [ ] **Step 4: Grille deux colonnes pleine largeur + mobile**

Dans `src/app/globals.css`, la `.pack-result` existe déjà en grille 2 colonnes (l.346) avec repli mobile 1 colonne (l.357, l.1075). Ajuster pour la pleine largeur de page : après la règle `.pack-page` (ajoutée en Task 1), ajouter :
```css
.pack-page .pack-result { flex: 1; align-items: start; }
.pack-advanced { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.pack-advanced-toggle { align-self: flex-start; }
```
La `.pack-result` en `grid-template-columns: 1fr 1fr` reste ; sur une page pleine largeur, les deux colonnes s'étalent. Le repli mobile 1 colonne (`@media (max-width: 820px)` l.356-358 et `@media (max-width: 900px)` l.1075) s'applique déjà.

- [ ] **Step 5: Lancer — il passe**

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: PASS (4 tests : le nouveau test mobile + les 3 autres). Le test 1 vérifiait `combobox "Choisir un modèle"` à 1 option ; avec le sélecteur désormais sous « Personnaliser » (masqué car 1 seul modèle), cette assertion doit être retirée du test 1.

⚠️ Mise à jour du test 1 : supprimer la ligne
```ts
  await expect(modal.getByRole("combobox", { name: "Choisir un modèle" }).locator("option")).toHaveCount(1);
```
(le sélecteur n'est plus rendu avec un seul modèle). Le reste du test 1 (variables → email, repli « Bonjour, », aperçu PDF, insertion éditeur) est inchangé.

- [ ] **Step 6: Vérification complète + recette visuelle**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert. Puis **recette visuelle obligatoire** (les correctifs sont visuels) : lancer l'app (`npm run dev`), ouvrir `/pack` en desktop et en 375px, vérifier de visu : deux colonnes pleine largeur en desktop, une colonne en mobile, pastilles inline dans les deux corps, dépliant « Personnaliser » fermé par défaut, « ← Retour » ramène en arrière. Coller le constat (ou une capture) dans le rapport.

- [ ] **Step 7: Journal + commit**

Entrée `### 2026-07-10 : Disposition finale du Pack — dépliant Personnaliser + colonnes pleine largeur`, et mise à jour de « Prochaine étape suggérée » : refonte Pack terminée (page /pack + éditeur à étiquettes).

```bash
git add src/components/pack/PackView.tsx src/app/globals.css tests/e2e/pack.spec.ts ../WORK_HISTORY.md
git commit -m "feat(pack): disposition finale /pack — depliant Personnaliser, colonnes pleine largeur"
```

---

## Rapport final attendu

Au format `web/CADRAGE_EXECUTION.md` §5, pour chacune des 5 tasks :

```
### TASK n — <titre>
- Fichiers modifiés : <liste exacte>
- Résumé du changement : <3 lignes max>
- Critères du plan : [x] / [ ]
- tsc / lint / vitest / build / e2e : OK ou KO (+ extrait si KO)
- Commit : <hash + message>
- Journal WORK_HISTORY.md : fait [x]
```

Puis « Points sur lesquels je me suis arrêté pour demander » (même vide).

## Hors périmètre (rappel)

Refonte de la modale « Adapter à une offre » (TailorModal) ; bibliothèque de modèles à la Candiboost (barre latérale de cartes) ; suppression des modèles déjà seedés dans une base existante. La brique d'édition externe (dépendance) reste l'option de repli si un cas limite du `contentEditable` gêne réellement à l'usage.

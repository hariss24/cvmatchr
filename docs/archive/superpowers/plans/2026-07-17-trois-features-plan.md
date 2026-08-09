# Trois features UI/ATS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Mode d'exécution retenu pour ce plan** : délégation externe. Chaque tâche
> correspond à un fichier de mission autonome (`2026-07-17-mission-*.md`, même
> dossier) que Hariss colle dans Gemini 3.1. Claude vérifie chaque diff au retour.

**Goal:** Livrer trois features indépendantes de `TODO.md` : vider entreprise/poste au « Nouveau CV », analyse ATS en un clic (IA directe avec fallback local), et pan à la souris dans l'aperçu PDF.

**Architecture:** Trois changements chirurgicaux dans des fichiers disjoints (`TopBar.tsx`, `AtsPanel.tsx`, `PdfPreview.tsx` + `globals.css`). Aucun nouveau module, aucune nouvelle dépendance. Spec validée : `docs/archive/superpowers/specs/2026-07-17-trois-features-ui-ats-design.md`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict, Zustand (`docStore`), Vitest.

## Global Constraints

- Jamais `alert`/`confirm`/`prompt` natifs — utiliser `uiAlert`/`uiConfirm`/`uiPrompt` (`src/state/uiStore.ts`).
- Jamais de couleur en dur dans le CSS — variables de thème de `globals.css`.
- Ne jamais lire ni tester `docStore.html` (vestige HTML, vide depuis la migration React PDF).
- Pas de nouveaux tests de composants React (pas d'infra testing-library) : vérification = suite existante + lint + tsc + test manuel.
- Commandes de vérification (depuis `web/`) : `npm run lint`, `npx tsc --noEmit`, `npm test`.
- Un commit par tâche.

---

### Task 1: Vider entreprise/poste au « Nouveau CV »

**Files:**
- Modify: `web/src/components/layout/TopBar.tsx:66-71` (fonction `onNewCv`)

**Interfaces:**
- Consumes: `useDocStore.getState().setCompany` / `.setRole` (existants, `src/state/docStore.ts:99-100`).
- Produces: rien (comportement UI uniquement).

- [ ] **Step 1: Modifier `onNewCv`**

```tsx
const onNewCv = async () => {
  if (!(await uiConfirm("Repartir d'un CV vierge ? Le contenu actuel sera remplacé.", "Nouveau CV"))) return;
  const profile = await loadProfile();
  setJson(applyProfileToResume(structuredClone(DEFAULT_RESUME), profile));
  const { setCompany, setRole } = useDocStore.getState();
  setCompany("");
  setRole("");
  toast("Nouveau CV.", "success");
};
```

(Le menu mobile délègue déjà à ce handler via la prop `onNewCv` — un seul endroit à modifier.)

- [ ] **Step 2: Vérifier**

Run (depuis `web/`): `npm run lint` puis `npx tsc --noEmit` puis `npm test`
Expected: 0 erreur, suite verte (261+ tests).
Manuel : remplir entreprise + poste dans la MetaBar → « Nouveau CV » → confirmer → les deux champs sont vides.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/TopBar.tsx
git commit -m "feat(ui): vide entreprise et poste au Nouveau CV"
```

---

### Task 2: Analyse ATS — un seul bouton, IA directe avec fallback local

**Files:**
- Modify: `web/src/components/modals/AtsPanel.tsx` (boutons ~161-170, `runLocal` ~118-124, `catch` de `runAi` ~139-141)

**Interfaces:**
- Consumes: `analyzeResumeAts` (`src/lib/ats/engine.ts`, déjà importé), `toast` (`uiStore`).
- Produces: rien (le moteur `engine.ts` et la route `/api/ats-score` ne changent pas).

- [ ] **Step 1: Supprimer `runLocal` et le bouton « Score ATS »**

Supprimer la fonction `runLocal` entière. Remplacer le bloc des deux boutons par :

```tsx
<div className="ats-actions">
  <button type="button" className="ats-action-btn" onClick={runAi} disabled={busy}>
    {busy ? "Analyse IA…" : "Analyse ATS"}
  </button>
</div>
```

- [ ] **Step 2: Fallback local dans le `catch` de `runAi`**

```tsx
} catch {
  setReport(analyzeResumeAts(input.resume, input.desc, input.role));
  setPriorities([]);
  setByAi(false);
  toast("Analyse IA indisponible — score algorithmique local affiché.", "info");
} finally {
```

Garder l'import `analyzeResumeAts` (il sert désormais au fallback). Mettre à jour le commentaire d'en-tête du fichier (les « deux chemins » deviennent « IA d'abord, moteur local en secours »).

- [ ] **Step 3: Vérifier**

Run (depuis `web/`): `npm run lint` puis `npx tsc --noEmit` puis `npm test`
Expected: 0 erreur, suite verte (les tests de `engine.ts` passent inchangés).
Manuel : offre collée → « Analyse ATS » → spinner → résultat avec badge « ✨ Analyse IA ». En coupant le réseau (DevTools offline) → résultat sans badge + toast « Analyse IA indisponible… ».

- [ ] **Step 4: Commit**

```bash
git add web/src/components/modals/AtsPanel.tsx
git commit -m "feat(ats): analyse en un clic — IA directe, moteur local en secours"
```

---

### Task 3: Outil « main » (pan) dans l'aperçu PDF

**Files:**
- Modify: `web/src/components/editor/PdfPreview.tsx`
- Modify: `web/src/app/globals.css` (après le bloc `.pdf-preview--zoom`, ~ligne 1303)

**Interfaces:**
- Consumes: `containerRef` existant du composant.
- Produces: classe CSS `is-panning` (consommée uniquement par le CSS ci-dessous).

- [ ] **Step 1: Handlers de pan dans `PdfPreview.tsx`**

Ajouter sous `containerRef` :

```tsx
// Outil « main » : glisser à la souris pour déplacer l'aperçu (scroll du conteneur).
// Souris uniquement — au tactile, le défilement natif fait déjà le travail.
const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  const el = containerRef.current;
  if (!el) return;
  panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
  el.setPointerCapture(e.pointerId);
  el.classList.add("is-panning");
};

const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
  const pan = panRef.current;
  const el = containerRef.current;
  if (!pan || !el) return;
  el.scrollLeft = pan.left - (e.clientX - pan.x);
  el.scrollTop = pan.top - (e.clientY - pan.y);
};

const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
  const el = containerRef.current;
  if (!panRef.current || !el) return;
  panRef.current = null;
  el.classList.remove("is-panning");
  el.releasePointerCapture(e.pointerId);
};
```

Et brancher les handlers sur le `<div>` retourné :

```tsx
return (
  <div
    ref={containerRef}
    className={`pdf-preview${zoom ? " pdf-preview--zoom" : ""}`}
    data-testid="pdf-preview"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={endPan}
    onPointerCancel={endPan}
  />
);
```

- [ ] **Step 2: CSS**

Après `.pdf-preview--zoom .pdf-preview__page { max-width: none; }` dans `globals.css` :

```css
.pdf-preview { cursor: grab; user-select: none; }
.pdf-preview.is-panning { cursor: grabbing; }
```

(Le premier bloc `.pdf-preview` existant, lignes ~1285-1293, ne bouge pas.)

- [ ] **Step 3: Vérifier**

Run (depuis `web/`): `npm run lint` puis `npx tsc --noEmit` puis `npm test`
Expected: 0 erreur, suite verte.
Manuel : zoom activé → cliquer-glisser déplace l'aperçu dans les deux axes, curseur grab → grabbing. DevTools mode tactile → le défilement natif reste inchangé.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/editor/PdfPreview.tsx web/src/app/globals.css
git commit -m "feat(preview): outil main — pan à la souris dans l'aperçu PDF"
```

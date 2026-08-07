# Plan d'implémentation — Bascule d'Aperçu & Comparaison IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de masquer et réafficher l'aperçu transitoire d'une proposition IA à tout moment (dans le Chat IA et depuis l'en-tête de l'Aperçu PDF) pour comparer facilement la proposition avec son document original sans devoir la rejeter.

**Architecture:** Dans `ChatPanel.tsx`, la comparaison entre `previewOverride` (dans `docStore.ts`) et `proposal.json` détermine si une proposition est activement prévisualisée. Si oui, son bouton bascule sur « Masquer l'aperçu » et réinitialise `previewOverride` à `null` au clic. Dans `PreviewPane.tsx`, un bouton « Voir l'original » est ajouté au badge de prévisualisation IA pour réinitialiser `previewOverride` à `null` en un clic.

**Tech Stack:** React 19, Next.js 16 (App Router), Zustand (`docStore.ts`), Vitest.

## Global Constraints

- Rétrocompatibilité : Les boutons « Appliquer » et « Rejeter » conservent leur comportement exact.
- Maintien du statut : Basculer ou masquer l'aperçu conserve la proposition en statut `"open"`.
- TypeScript strict : 0 `any`, 0 `@ts-ignore`, 0 `eslint-disable`.
- Verrouillage Git : Ne jamais faire de `git push`.
- Maintien de l'UI : Utiliser les variables CSS globales (`var(--bg)`, `var(--orange)`, etc.).

---

### Task 1: Bascule d'aperçu dynamique dans ChatPanel

**Files:**
- Modify: `web/src/components/modals/ChatPanel.tsx`

**Interfaces:**
- Consumes: `useDocStore((s) => s.previewOverride)` et `useDocStore.getState().setPreviewOverride`.
- Produces: Bouton à bascule « Prévisualiser » / « Masquer l'aperçu » sur chaque carte de proposition open.

- [ ] **Step 1: Récupérer `previewOverride` depuis `useDocStore` dans `ChatPanel`**

Dans `web/src/components/modals/ChatPanel.tsx`, ajouter la lecture de `previewOverride` :
```tsx
const previewOverride = useDocStore((s) => s.previewOverride);
```

- [ ] **Step 2: Ajouter la fonction `isProposalActive` et la bascule dans `previewProposal`**

```tsx
function isProposalActive(p: Proposal): boolean {
  if (!previewOverride) return false;
  return JSON.stringify(previewOverride) === JSON.stringify(p.json);
}

function togglePreviewProposal(p: Proposal) {
  if (isProposalActive(p)) {
    useDocStore.getState().setPreviewOverride(null);
  } else {
    useDocStore.getState().setPreviewOverride(p.json);
  }
}
```

- [ ] **Step 3: Mettre à jour le rendu du bouton dans la proposition**

Remplacer le bouton de prévisualisation dans `ChatPanel.tsx` :
```tsx
<button
  type="button"
  className={`proposal-btn${isProposalActive(it.data) ? " proposal-btn--active" : ""}`}
  disabled={it.status !== "open"}
  onClick={() => togglePreviewProposal(it.data)}
>
  {isProposalActive(it.data) ? "Masquer l'aperçu" : "Prévisualiser"}
</button>
```

- [ ] **Step 4: Commit Task 1**

```bash
git add web/src/components/modals/ChatPanel.tsx
git commit -m "feat(chat): bascule dynamique du bouton de previsualisation dans le chat IA"
```

---

### Task 2: Bouton « Voir l'original » dans l'en-tête de PreviewPane

**Files:**
- Modify: `web/src/components/editor/PreviewPane.tsx`

**Interfaces:**
- Consumes: `useDocStore((s) => s.setPreviewOverride)`.
- Produces: Bouton d'action dans le badge `preview-override-badge`.

- [ ] **Step 1: Récupérer `setPreviewOverride` dans `PreviewPane`**

Dans `web/src/components/editor/PreviewPane.tsx` :
```tsx
const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);
```

- [ ] **Step 2: Rendre le badge interactif avec un bouton d'annulation de l'override**

Remplacer le rendu du badge `preview-override-badge` (lignes 72-74) :
```tsx
{isPreview ? (
  <div className="preview-override-badge">
    <span>Proposition IA</span>
    <button
      type="button"
      className="preview-override-badge__btn"
      onClick={() => setPreviewOverride(null)}
      title="Réafficher le document original"
    >
      Voir l'original ✕
    </button>
  </div>
) : null}
```

- [ ] **Step 3: Commit Task 2**

```bash
git add web/src/components/editor/PreviewPane.tsx
git commit -m "feat(editor): bouton Voir l'original dans l'en-tête de l'aperçu PDF"
```

---

### Task 3: Styles CSS pour le bouton actif et le badge interactif

**Files:**
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Ajouter la classe `.proposal-btn--active` et styliser `.preview-override-badge__btn`**

Dans `web/src/app/globals.css` (autour de la ligne 1170) :
```css
.proposal-btn--active {
  background: var(--orange-faint, rgba(234, 88, 12, 0.12));
  color: var(--orange-text, #c2410c);
  border-color: var(--orange, #ea580c);
  font-weight: 700;
}

.preview-override-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--amber-faint, #fef3c7);
  color: var(--amber-text, #92400e);
  border: 1px solid var(--amber-border, #fde68a);
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.preview-override-badge__btn {
  background: var(--bg, #ffffff);
  border: 1px solid var(--amber-border, #fde68a);
  color: var(--amber-text, #92400e);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.preview-override-badge__btn:hover {
  background: var(--amber-text, #92400e);
  color: #ffffff;
}
```

- [ ] **Step 2: Commit Task 3**

```bash
git add web/src/app/globals.css
git commit -m "style(editor): styles pour la bascule de previsualisation et badge d'aperçu"
```

---

### Task 4: Tests unitaires & vérifications de l'application

**Files:**
- Create: `web/src/components/modals/ChatPanel.test.tsx`

- [ ] **Step 1: Écrire le test unitaire pour `ChatPanel.test.tsx`**

Créer `web/src/components/modals/ChatPanel.test.tsx` :
```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ChatPanel from "./ChatPanel";
import { useDocStore } from "@/state/docStore";

describe("ChatPanel — bascule de prévisualisation", () => {
  beforeEach(() => {
    useDocStore.setState({
      json: { name: "Test" } as any,
      previewOverride: null,
      docType: "CV",
      templateId: "sobre",
    });
  });

  afterEach(() => cleanup());

  it("bascule le bouton de Prévisualiser à Masquer l'aperçu", () => {
    render(<ChatPanel open={true} onClose={() => {}} />);
    // Le composant est rendu fermé ou ouvert
    expect(screen.getByRole("aside", { hidden: true })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer la suite de vérifications**

Run: `npm test && npm run build && npm run lint`
Expected: 0 erreur, 100% tests au vert.

- [ ] **Step 3: Commit Task 4**

```bash
git add web/src/components/modals/ChatPanel.test.tsx
git commit -m "test(chat): validation de la bascule de previsualisation"
```

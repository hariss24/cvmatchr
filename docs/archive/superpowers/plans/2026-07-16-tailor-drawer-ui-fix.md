# Tailor Drawer UI Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sublimer le Drawer latéral pour l'adaptation des offres d'emploi afin de le rendre esthétiquement cohérent avec le design system (neumorphisme), aéré et agréable.

**Architecture:** La refonte se fait exclusivement via CSS dans `globals.css` en surchargeant et restylant les éléments spécifiques à l'intérieur de `.ui-drawer-left`.

**Tech Stack:** Vanilla CSS, React (Next.js).

## Global Constraints

- Respect du design system : pas de conteneurs superflus (shadow inset sur le bouton CTA doit disparaître).
- L'éditeur (`textarea`) doit utiliser flex-grow pour occuper l'espace disponible.
- Tests obligatoires (`npm run lint`, `npx vitest run`) avant la complétion.

---

### Task 1: CSS Refactoring for Drawer

**Files:**
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: `.ui-drawer-left` existing markup structure.
- Produces: Polished, flex-based drawer layout.

- [ ] **Step 1: Rewrite `.ui-drawer-left` styling for better spacing and layout**

```css
.ui-drawer-left {
  background: var(--bg);
  box-shadow: var(--neu-raised-lg);
  width: 50vw;
  max-width: 600px;
  height: 100vh;
  border-radius: 0 16px 16px 0;
  padding: 32px 32px 32px 24px; /* Un peu plus de padding pour respirer */
  display: flex; flex-direction: column; gap: 24px;
  animation: slideInLeft 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.ui-drawer-left .tailor-body-inner {
  display: flex; flex-direction: column; gap: 24px;
  flex: 1; min-height: 0;
}
```

- [ ] **Step 2: Rewrite inner columns and inputs for fluid height**

```css
.ui-drawer-left .tailor-col-left {
  flex: 1; display: flex; flex-direction: column; gap: 12px;
}
.ui-drawer-left #job-desc-input {
  flex: 1; min-height: 200px;
}
```

- [ ] **Step 3: Remove ugly inset shadow box around the CTA button**

```css
.ui-drawer-left .tailor-actions-box {
  background: transparent;
  box-shadow: none;
  padding: 0;
  margin-top: auto;
}
```

- [ ] **Step 4: Verify visually (if applicable) and commit**

```bash
cd web
npm run lint
```

# Refonte tiroir (drawer) pour le mode CV (TailorModal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer la structure de tiroir (drawer) au mode CV de TailorModal, en préservant le layout en deux colonnes pour les réglages et en épinglant les actions (CTA) en bas.

**Architecture:** Le mode CV n'utilisera plus `.ui-dialog` mais le système de tiroir `.ui-drawer--lg`. Le composant `TailorModal.tsx` sera uniformisé pour utiliser le tiroir pour tout type de document (Lettre ou CV), et les actions d'adaptation/génération seront déplacées de la colonne droite vers `.ui-drawer__foot`.

**Tech Stack:** React, Next.js, CSS Vanille

## Global Constraints

- Respecter le CADRAGE STRICT (TDD, vérifications, un commit par tâche).
- Maintenir la cohérence visuelle sans créer de nouveaux styles (réutiliser `.ui-drawer--lg` et `.ui-drawer__foot`).

---

### Task 1: Refonte layout CV dans TailorModal.tsx

**Files:**
- Modify: `web/src/components/modals/TailorModal.tsx`

**Interfaces:**
- Consumes: Modale existante `TailorModal`
- Produces: Layout unifié en tiroir

- [ ] **Step 1: Write minimal implementation**

Dans `web/src/components/modals/TailorModal.tsx`, modifier `content` pour uniformiser le layout :
1. `ui-overlay` doit toujours avoir `ui-overlay--drawer-left` (supprimer le ternaire).
2. `ui-drawer` doit toujours être appliqué : `className={\`ui-drawer ui-drawer--left \${isLetter ? "ui-drawer--md" : "ui-drawer--lg"}\`}`.
3. Le header `__head` doit utiliser `ui-drawer__head` pour les deux cas. Ajouter le sourcil (eyebrow) : `<span className="ui-eyebrow">{isLetter ? "Lettre de motivation" : "CV"}</span>` et le titre `ui-drawer__title`.
4. Placer le contenu principal du CV (`.tailor-body-inner`) dans `<div className="ui-drawer__body">`.
5. Extraire les actions (les deux `.tailor-action-group` et le `.tailor-divider`) qui étaient dans `.tailor-actions-box` et les placer dans `<div className="ui-drawer__foot">`.
6. Retirer `<div className="tailor-actions-box">` devenu inutile.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/modals/TailorModal.tsx
git commit -m "refactor(TailorModal): uniformiser le tiroir pour le CV et deplacer les actions dans le footer"
```

### Task 2: Nettoyage du CSS obsolète et vérifications

**Files:**
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: Styles globaux

- [ ] **Step 1: Write minimal implementation**

Dans `web/src/app/globals.css`, retirer `.tailor-actions-box` qui n'est plus utilisé.
Remplacer :
```css
.tailor-settings-box, .tailor-actions-box {
```
par :
```css
.tailor-settings-box {
```

- [ ] **Step 2: Run verification**

Run : `npm run lint; npx vitest run`
Expected : 0 erreurs, tous les tests au vert.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/globals.css
git commit -m "style: supprimer la classe .tailor-actions-box inutilisee"
```

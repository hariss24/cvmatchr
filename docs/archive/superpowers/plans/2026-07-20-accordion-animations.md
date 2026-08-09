# Accordion Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des animations fluides d'ouverture et de fermeture (façon Apple) pour les accordéons du formulaire (sections et éléments de liste).

**Architecture:** Utiliser CSS Grid (`grid-template-rows: 0fr` vers `1fr`) pour animer la hauteur des contenus repliables sans recourir à Javascript, ce qui assure une performance maximale et une animation fluide. On modifiera les composants `FormSection` et `ItemCard` pour qu'ils conservent le DOM de leurs enfants et utilisent ces nouvelles classes CSS au lieu de supprimer l'élément avec une condition tertiaire.

**Tech Stack:** React 19, CSS Vanilla (Next.js App Router).

## Global Constraints

- Interdiction d'ajouter des dépendances (ex: framer-motion).
- L'accessibilité doit être maintenue (conserver `aria-expanded` etc.).
- Ne modifier QUE les fichiers nécessaires (pas de refactor).

---

### Task 1: CSS pour les animations

**Files:**
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Produces: Nouvelles classes `.form-collapse` et `.form-collapse-inner`. Modification du comportement `gap` de `.form-section`.

- [ ] **Step 1: Ajouter les classes d'animation CSS**

Modifier le fichier `web/src/app/globals.css` pour adapter `.form-section` et ajouter l'animation grid :
Chercher :
```css
.form-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
```
Et remplacer par :
```css
.form-section { display: flex; flex-direction: column; gap: 0; margin-bottom: 18px; }
.form-section__title { margin-bottom: 8px; transition: margin-bottom 320ms cubic-bezier(0.32, 0.72, 0, 1); }
.form-section--collapsed .form-section__title { margin-bottom: 0; }

/* ---- Animations d'accordéon (façon Apple) ---- */
.form-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 320ms cubic-bezier(0.32, 0.72, 0, 1);
}
.form-collapse.is-open {
  grid-template-rows: 1fr;
}
.form-collapse-inner {
  overflow: hidden;
}
```

- [ ] **Step 2: Lancer le lint/build pour vérifier que tout est OK**
Run: `npm run lint` depuis `web/`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/app/globals.css
git commit -m "style: add css grid animation classes for accordions"
```

---

### Task 2: Composant FormSection et ItemCard

**Files:**
- Modify: `web/src/components/form/FormEditor.tsx`

**Interfaces:**
- Consumes: `.form-collapse` et `.form-collapse-inner` créées en Task 1.

- [ ] **Step 1: Remplacer le rendu conditionnel par CSS Grid dans FormSection**

Dans `web/src/components/form/FormEditor.tsx`, chercher la fonction `FormSection`.
Remplacer :
```tsx
      {open ? <div className="form-section__body">{children}</div> : null}
```
Par :
```tsx
      <div className={`form-collapse ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="form-collapse-inner">
          <div className="form-section__body">{children}</div>
        </div>
      </div>
```

- [ ] **Step 2: Remplacer le rendu conditionnel par CSS Grid dans ItemCard**

Dans la fonction `ItemCard`, remplacer :
```tsx
      {open ? <div className="form-item__body">{children}</div> : null}
```
Par :
```tsx
      <div className={`form-collapse ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="form-collapse-inner">
          <div className="form-item__body">{children}</div>
        </div>
      </div>
```

- [ ] **Step 3: Lancer le lint et les tests pour vérifier la syntaxe**
Run: `npx tsc --noEmit` et `npm run lint` depuis `web/`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/components/form/FormEditor.tsx
git commit -m "feat: animate form accordions using css grid"
```

# TopBar Minimalist Highlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en valeur les boutons "Nouveau CV" et "Offres" de la TopBar avec une esthétique minimaliste sémantique sans alourdir le design neumorphique.

**Architecture:** Ajout de classes utilitaires CSS sémantiques (`.btn-nav-outline-orange`, `.btn-nav-outline-blue`) injectant des bordures neumorphiques internes colorées (inset shadow). Application de ces classes aux composants React `TopBar` et `MobileMenu`.

**Tech Stack:** CSS Vanilla, React (Next.js 16).

## Global Constraints

- Ne **jamais** `git push` (la branche `feature/refonte-ui-nextjs` déploie la prod Vercel). Commits locaux uniquement.
- TypeScript strict : pas de `any`, pas de `@ts-ignore`.
- Réutiliser les classes existantes et étendre `globals.css` avec des variables CSS (`var(--orange-text)`, `var(--blue)`).
- Vérification de référence : `cd web && npx tsc --noEmit` (0 erreur), `npx vitest run` (tout vert), `npm run build`.
- Journaliser la tâche dans `WORK_HISTORY.md`.

---

### Task 1: CSS Utilities for Minimalist Outlines

**Files:**
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Produces: CSS classes `.btn-nav-outline-orange` and `.btn-nav-outline-blue`

- [ ] **Step 1: Add CSS classes to globals.css**

```css
/* Variantes Minimalistes avec contour sémantique fin */
.btn-nav-outline-orange {
  color: var(--orange-text);
  box-shadow: var(--neu-raised-sm), inset 0 0 0 1px var(--orange-text);
}
.btn-nav-outline-orange:hover {
  box-shadow: var(--neu-raised), inset 0 0 0 1px var(--orange-text);
}
.btn-nav-outline-blue {
  color: var(--blue);
  box-shadow: var(--neu-raised-sm), inset 0 0 0 1px var(--blue);
}
.btn-nav-outline-blue:hover {
  box-shadow: var(--neu-raised), inset 0 0 0 1px var(--blue);
}
```

- [ ] **Step 2: Run build to verify CSS syntax**

Run: `cd web && npm run build`
Expected: Passes successfully.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/globals.css
git commit -m "style(ui): ajout utilitaires CSS pour emphase minimaliste"
```

---

### Task 2: Apply styles to TopBar

**Files:**
- Modify: `web/src/components/layout/TopBar.tsx`

**Interfaces:**
- Consumes: CSS classes `.btn-nav-outline-orange` and `.btn-nav-outline-blue`

- [ ] **Step 1: Modify TopBar.tsx**

Update the "Nouveau CV" and "Offres" buttons to include the new classes.

```tsx
        <button type="button" className="btn-nav btn-nav-outline-orange mobile-hidden" onClick={onNewCv}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        <button type="button" className="btn-nav mobile-hidden" onClick={openChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
          Assistant IA
        </button>

        <Link href="/jobs" className="btn-nav btn-nav-outline-blue mobile-hidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          Offres
        </Link>
```

- [ ] **Step 2: Run typecheck to verify TSX syntax**

Run: `cd web && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/TopBar.tsx
git commit -m "feat(ui): mise en valeur de Nouveau CV et Offres dans la TopBar"
```

---

### Task 3: Apply styles to MobileMenu

**Files:**
- Modify: `web/src/components/layout/MobileMenu.tsx`

**Interfaces:**
- Consumes: CSS classes `.btn-nav-outline-orange` and `.btn-nav-outline-blue`

- [ ] **Step 1: Modify MobileMenu.tsx**

Update the "Nouveau CV" and "Offres" buttons in the mobile menu.

```tsx
        <button type="button" className="mobile-menu__item btn-nav-outline-orange" onClick={act(onNewCv)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        <button type="button" className="mobile-menu__item" onClick={act(onOpenChat)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
          Assistant IA
        </button>

        <Link href="/jobs" className="mobile-menu__item btn-nav-outline-blue" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          Offres
        </Link>
```

- [ ] **Step 2: Run typecheck to verify TSX syntax**

Run: `cd web && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/MobileMenu.tsx
git commit -m "feat(ui): mise en valeur de Nouveau CV et Offres dans le menu mobile"
```

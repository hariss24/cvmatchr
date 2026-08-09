# Refonte mobile « l'aperçu est l'écran » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur mobile (≤900px), l'aperçu PDF devient l'écran principal (zoomable), le formulaire passe en tiroir plein écran, la navigation secondaire dans un menu ☰, le CTA « Adapter à une offre » reste épinglé en bas — et les boutons orange retrouvent leur texte blanc d'origine.

**Architecture:** Tout le comportement mobile vit dans la media query `≤900px` **en fin de** `globals.css` (règle du projet : à spécificité égale, la dernière règle gagne — le bloc mobile DOIT rester après les règles de base). Les nouveaux panneaux (menu, tiroir) réutilisent le pattern existant du `ChatPanel` (`.chat-panel`, `position: fixed` + `transform` + classe `.open`). Le desktop ne change pas, sauf le retour du texte blanc sur les boutons orange (voulu).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS unique `globals.css` (variables de thème, **jamais de couleur en dur** hors variables existantes), Zustand, Playwright e2e (config : `reuseExistingServer: true`, port 3000).

## Global Constraints

- **Bloc mobile en fin de `globals.css`** : toute nouvelle règle `@media (max-width: 900px)` va dans le bloc final existant (commentaire « Règles mobiles (≤900px) — en fin de fichier exprès »), jamais avant.
- **Desktop intact** : aucune règle hors media query ne doit changer le rendu desktop (exception validée : couleur du texte des boutons orange/vert).
- **Couleurs** : uniquement via variables CSS (`--orange`, `--on-orange`, `--orange-text`…). `--orange-text` (petits textes orange) et les gris assombris (`--muted`/`--faint`) sont des acquis d'accessibilité : **ne pas y toucher**.
- **Jamais** `alert`/`confirm`/`prompt` natifs — utiliser `uiAlert`/`uiConfirm`/`uiPrompt` (`src/state/uiStore.ts`).
- **Noms accessibles stables** : les tests e2e ciblent les boutons par rôle+nom (`getByRole("button", { name: "…" })`). Quand un libellé visuel est masqué sur mobile, poser un `aria-label` identique à l'ancien texte.
- **Tests e2e existants** (24) doivent rester verts. ⚠️ `import-text.spec.ts` est **flaky** (course indépendante de ce chantier) : un échec isolé de ce seul test ne bloque pas, relancer la suite une fois pour confirmer.
- **Vérifications finales** (section 12 de `PROJECT_INDEX.md`) : `npm run lint`, `npx tsc --noEmit`, `npm test -- --run`, `npx playwright test`.
- **Journal** : à la fin, ajouter une entrée en tête du Journal de `WORK_HISTORY.md` (racine).
- Serveur de dev : `npm run dev` depuis `web/`. Si un changement CSS ne s'affiche pas : tuer le port 3000, supprimer `web/.next`, relancer (piège Turbopack/Windows connu).
- Tous les chemins ci-dessous sont relatifs à `web/` sauf mention contraire.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/app/globals.css` | Retour orange (Task 1), styles menu/tiroir/CTA/zoom (Tasks 2-4) |
| `src/components/layout/MobileMenu.tsx` | **Créé** — panneau latéral ☰ (navigation secondaire) |
| `src/components/layout/TopBar.tsx` | Boutons ☰ et ✏️, montage du MobileMenu, classes `mobile-hidden` |
| `src/components/layout/EditorDrawer.tsx` | **Créé** — wrapper client du panneau éditeur (tiroir plein écran mobile) |
| `src/app/page.tsx` | Remplace `<section className="pane editor-pane">` par `<EditorDrawer>` |
| `src/components/layout/ActionsBar.tsx` | Icônes + `.btn-label` sur Effacer / Comment ça marche |
| `src/components/editor/PreviewPane.tsx` | Bouton loupe (état `zoom`) |
| `src/components/editor/PdfPreview.tsx` | Prop `zoom` → classe `.pdf-preview--zoom` |
| `tests/e2e/mobile.spec.ts` | **Créé** — 3 tests e2e en viewport 390×844 |

---

### Task 1 : Retour du texte blanc sur les boutons orange/vert

Hariss préfère l'identité d'origine (blanc sur orange vif). On restaure le blanc et les gradients d'origine sur les **boutons**, en gardant le gras (compensation optique). On **garde** `--orange-text` pour les petits textes orange et les gris assombris.

**Files:**
- Modify: `src/app/globals.css` (règles `.btn-orange`, `button.go`, `.tailor-btn`, `.pack-btn-variant`, `.job-new-badge`)

**Interfaces:**
- Consomme : variables existantes `--orange`, `--orange2`, `--orange-hover`.
- Produit : rien pour les autres tasks (indépendante). La variable `--on-orange` devient inutilisée dans ces règles mais **reste définie** (zéro risque, nettoyage hors scope).

- [ ] **Step 1 : Restaurer les 5 règles dans `globals.css`**

Remplacer (recherche exacte de chaque bloc actuel) :

```css
.btn-orange {
  background: var(--orange);
  color: var(--on-orange);
  font-weight: 600;
}
```
par :
```css
.btn-orange {
  background: var(--orange);
  color: #fff;
  font-weight: 600;
}
```

Dans `button.go`, remplacer :
```css
  background: linear-gradient(145deg, var(--orange2), var(--orange));
  color: var(--on-orange);
  font-weight: 700;
```
par :
```css
  background: linear-gradient(145deg, var(--orange), var(--orange-hover));
  color: #fff;
  font-weight: 700;
```

Dans `.tailor-btn`, remplacer :
```css
  background: linear-gradient(145deg, var(--orange2), var(--orange));
  color: var(--on-orange); border: none; border-radius: 11px; padding: 8px 18px; font-size: 13px;
```
par :
```css
  background: linear-gradient(145deg, var(--orange), var(--orange-hover));
  color: #fff; border: none; border-radius: 11px; padding: 8px 18px; font-size: 13px;
```

Remplacer :
```css
.pack-btn-variant { background: linear-gradient(145deg, #3dbd93, #2fa982); color: #06251a; }
```
par :
```css
.pack-btn-variant { background: linear-gradient(145deg, #2fa982, #1e8e6a); color: #fff; }
```

Dans `.job-new-badge`, remplacer `color: var(--on-orange);` par `color: #fff;` (garder `font-size: 11px`).

- [ ] **Step 2 : Vérifier visuellement**

Serveur lancé (`npm run dev`), ouvrir http://localhost:3000 : « Convertir en PDF » et « Adapter à une offre » doivent être **blanc sur orange vif** (comme avant), les titres de sections du formulaire restent en orange foncé lisible.

- [ ] **Step 3 : Lancer le test e2e qui exerce ces boutons**

Run : `npx playwright test tests/e2e/export.spec.ts tests/e2e/tailor.spec.ts --reporter=line`
Expected : `2 passed`

- [ ] **Step 4 : Commit**

```bash
git add web/src/app/globals.css
git commit -m "style: retour du texte blanc sur les boutons orange/vert (identite d'origine)"
```

---

### Task 2 : Menu ☰ mobile (navigation secondaire)

Sur mobile, la topbar garde **une seule ligne** : logo, « Convertir en PDF », ✏️ (posé en Task 3), ☰. Les 6 autres commandes (Nouveau CV, Assistant IA, Offres, Historique, thème, Paramètres) passent dans un panneau latéral qui réutilise le pattern `.chat-panel`. Le menu est **monté seulement quand il est ouvert** (pas de doublons de noms accessibles pour les tests e2e desktop).

**Files:**
- Create: `src/components/layout/MobileMenu.tsx`
- Modify: `src/components/layout/TopBar.tsx`
- Modify: `src/app/globals.css` (bloc mobile final + styles `.mobile-menu__*` hors media)
- Test: `tests/e2e/mobile.spec.ts` (créé ici)

**Interfaces:**
- Consomme : le pattern CSS `.chat-panel` (fixed droite, `transform`), les handlers existants de `TopBar` (`onNewCv`, `onSettings`, `toggleTheme`, ouverture du chat).
- Produit : `MobileMenu({ open, onClose, onNewCv, onOpenChat, onToggleTheme, onSettings }: { open: boolean; onClose: () => void; onNewCv: () => void; onOpenChat: () => void; onToggleTheme: () => void; onSettings: () => void })` ; classes CSS `mobile-hidden` (caché ≤900px) et `mobile-only` (visible ≤900px seulement) réutilisées en Task 3.

- [ ] **Step 1 : Écrire le test e2e qui échoue**

Créer `tests/e2e/mobile.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

/**
 * Parcours mobile (viewport téléphone). La topbar tient sur une ligne :
 * la navigation secondaire vit dans le menu ☰ (panneau latéral).
 */
test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("le menu ☰ donne accès à la navigation secondaire", async ({ page }) => {
    await page.goto("/");

    // Sur mobile, Offres/Historique ne sont pas dans la topbar…
    await expect(page.locator(".topbar").getByRole("link", { name: "Offres" })).toBeHidden();

    // …mais dans le menu ☰.
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.locator(".mobile-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Offres" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Historique" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Nouveau CV" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Paramètres API" })).toBeVisible();

    // Navigation réelle depuis le menu.
    await menu.getByRole("link", { name: "Offres" }).click();
    await expect(page).toHaveURL(/\/jobs/);
  });
});
```

- [ ] **Step 2 : Vérifier qu'il échoue**

Run : `npx playwright test tests/e2e/mobile.spec.ts --reporter=line`
Expected : FAIL (« Menu » introuvable).

- [ ] **Step 3 : Créer `src/components/layout/MobileMenu.tsx`**

```tsx
"use client";

import Link from "next/link";

/**
 * Menu mobile ☰ : navigation secondaire (les actions restent dans TopBar,
 * ce panneau ne fait que les déclencher puis se fermer). Monté uniquement
 * quand `open` est vrai — pas de doublons de noms accessibles sur desktop.
 * Réutilise le pattern visuel du ChatPanel (panneau fixe à droite).
 */
export default function MobileMenu({
  open,
  onClose,
  onNewCv,
  onOpenChat,
  onToggleTheme,
  onSettings,
}: {
  open: boolean;
  onClose: () => void;
  onNewCv: () => void;
  onOpenChat: () => void;
  onToggleTheme: () => void;
  onSettings: () => void;
}) {
  if (!open) return null;

  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <div className="ui-overlay mobile-menu-overlay" role="presentation" onClick={onClose}>
      <nav
        className="chat-panel open mobile-menu"
        aria-label="Menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-panel__head">
          <span className="chat-panel__title">Menu</span>
          <button type="button" className="form-btn-mini" onClick={onClose} aria-label="Fermer le menu">✕</button>
        </div>

        <button type="button" className="mobile-menu__item" onClick={act(onNewCv)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        <button type="button" className="mobile-menu__item" onClick={act(onOpenChat)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
          Assistant IA
        </button>

        <Link href="/jobs" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          Offres
        </Link>

        <Link href="/history" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
          Historique
        </Link>

        <button type="button" className="mobile-menu__item" onClick={onToggleTheme}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          Thème clair / sombre
        </button>

        <button type="button" className="mobile-menu__item" onClick={act(onSettings)} aria-label="Paramètres API">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          Paramètres API
        </button>
      </nav>
    </div>
  );
}
```

Note : le bouton thème ne ferme **pas** le menu (on veut voir le thème changer), les autres si.

- [ ] **Step 4 : Modifier `src/components/layout/TopBar.tsx`**

1. Ajouter l'import : `import MobileMenu from "@/components/layout/MobileMenu";`
2. Ajouter l'état sous `const [chatOpen, setChatOpen] = useState(false);` :
```tsx
  const [menuOpen, setMenuOpen] = useState(false);
```
3. Extraire l'ouverture du chat (utilisée par le bouton desktop ET le menu) — au-dessus du `return` :
```tsx
  const openChat = () => {
    takeSnapshot("Avant chat IA");
    setChatOpen(true);
  };
```
   et remplacer le `onClick` du bouton « Assistant IA » par `onClick={openChat}`.
4. Ajouter `className` de masquage mobile sur les 6 éléments secondaires (le libellé accessible ne change pas) :
   - bouton Nouveau CV : `className="btn-nav mobile-hidden"`
   - bouton Assistant IA : `className="btn-nav mobile-hidden"`
   - Link Offres : `className="btn-nav mobile-hidden"`
   - Link Historique : `className="btn-nav mobile-hidden"`
   - div `#btn-theme` : ajouter `className="mobile-hidden"`
   - bouton `#btn-settings` : ajouter `className="mobile-hidden"`
5. Ajouter le bouton ☰ **après** le bouton `.go go-top` (fin de `.topbar-actions`) :
```tsx
        <button
          type="button"
          className="btn-nav mobile-only topbar-burger"
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
```
6. Monter le menu à côté du ChatPanel (avant `</>`) :
```tsx
    <MobileMenu
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      onNewCv={onNewCv}
      onOpenChat={openChat}
      onToggleTheme={toggleTheme}
      onSettings={onSettings}
    />
```

- [ ] **Step 5 : Ajouter le CSS**

Dans `globals.css`, **hors media query** (près des styles `.chat-panel`, vers la ligne 460) :

```css
/* ---- Menu mobile ☰ (réutilise le pattern chat-panel) ---- */
.mobile-menu-overlay { justify-content: flex-end; padding: 0; }
.mobile-menu { gap: 6px; }
.mobile-menu__item {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg); color: var(--text); border: none; text-align: left;
  border-radius: 12px; padding: 14px 16px; font-size: 14px; font-weight: 600;
  font-family: var(--font-ui); cursor: pointer; box-shadow: var(--neu-raised-sm);
  min-height: 48px;
}
.mobile-menu__item:hover { box-shadow: var(--neu-raised); text-decoration: none; color: var(--text); }
.mobile-menu__item:active { box-shadow: var(--neu-inset); }
.mobile-only { display: none !important; }
```

Puis dans le **bloc mobile final** (`@media (max-width: 900px)` en fin de fichier), remplacer les règles topbar actuelles :

```css
  .topbar { flex-wrap: wrap; row-gap: 8px; }
  .topbar-actions { display: contents; }
  .topbar-actions > * { order: 2; flex: 1 1 30%; justify-content: center; min-height: 44px; }
  .topbar-actions .go { order: 1; flex: 0 1 auto; margin-left: auto; }
  /* Le toggle thème garde son curseur centré malgré la hauteur tactile. */
  #btn-theme { height: 44px; }
  .toggle-icon { height: 44px; }
  .toggle-knob { top: 8px; }
```

par :

```css
  /* Topbar une ligne : logo | (CTA PDF, ✏️ Task 3, ☰). Le reste vit dans le menu. */
  .mobile-hidden { display: none !important; }
  .mobile-only { display: inline-flex !important; }
  .topbar-actions { gap: 8px; }
  .topbar-actions > * { min-height: 44px; }
  .go.go-top { padding: 10px 14px; font-size: 13px; }
  .mobile-menu { width: min(320px, 86vw); }
```

(Les règles `#btn-theme`/`.toggle-*` sautent : le toggle est dans le menu, taille desktop.)

- [ ] **Step 6 : Vérifier que le nouveau test passe**

Run : `npx playwright test tests/e2e/mobile.spec.ts --reporter=line`
Expected : `1 passed`

- [ ] **Step 7 : Non-régression desktop**

Run : `npx playwright test --reporter=line`
Expected : `25 passed` (24 existants + 1 nouveau). Si seul `import-text.spec.ts` échoue : relancer une fois (flaky connu).

- [ ] **Step 8 : Commit**

```bash
git add web/src/components/layout/MobileMenu.tsx web/src/components/layout/TopBar.tsx web/src/app/globals.css web/tests/e2e/mobile.spec.ts
git commit -m "feat(mobile): menu hamburger pour la navigation secondaire, topbar une ligne"
```

---

### Task 3 : Aperçu en premier, formulaire en tiroir, CTA épinglé

Sur mobile : l'aperçu monte en tête (ordre CSS), le panneau éditeur devient un tiroir plein écran ouvert par le bouton ✏️ de la topbar (événement `window` `cvforge:toggle-form`, même pattern que `cvforge:open-snapshots` existant dans `EditorPane.tsx:98`), et la barre d'actions du bas devient collante avec Effacer/Aide en icônes.

**Files:**
- Create: `src/components/layout/EditorDrawer.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/TopBar.tsx` (bouton ✏️)
- Modify: `src/components/layout/ActionsBar.tsx` (icône + `.btn-label` sur Effacer et Aide)
- Modify: `src/app/globals.css` (bloc mobile final)
- Test: `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consomme : classes `mobile-only`/`.btn-label` (Task 2 / bloc mobile existant), événements `window` custom (pattern existant).
- Produit : `EditorDrawer({ children }: { children: React.ReactNode })` (wrapper de section) ; événement `CustomEvent` nommé `"cvforge:toggle-form"` ; classes CSS `.editor-pane--open`, `.editor-drawer-close`.

- [ ] **Step 1 : Écrire le test e2e qui échoue**

Ajouter dans le `describe("mobile", …)` de `tests/e2e/mobile.spec.ts` :

```ts
  test("l'aperçu est en tête, le formulaire s'ouvre en tiroir", async ({ page }) => {
    await page.goto("/");

    // L'aperçu PDF est visible dans le premier écran, sans scroller.
    const preview = page.locator(".pane.preview-pane");
    await expect(preview).toBeVisible();
    const box = await preview.boundingBox();
    expect(box!.y).toBeLessThan(500);

    // Le formulaire est masqué par défaut…
    const editor = page.locator(".pane.editor-pane");
    await expect(editor.getByText("Informations personnelles")).not.toBeInViewport();

    // …et s'ouvre via le bouton ✏️ de la topbar.
    await page.getByRole("button", { name: "Modifier le contenu" }).click();
    await expect(editor.getByText("Informations personnelles")).toBeInViewport();

    // Une saisie dans le tiroir met à jour le document, puis « Terminé » referme.
    await editor.getByText("Nom complet").locator("xpath=following-sibling::input").fill("Test Mobile");
    await page.getByRole("button", { name: "Terminé" }).click();
    await expect(editor.getByText("Informations personnelles")).not.toBeInViewport();

    // Le CTA « Adapter à une offre » est visible sans scroller (barre épinglée).
    await expect(page.getByRole("button", { name: "Adapter à une offre" })).toBeInViewport();
  });
```

- [ ] **Step 2 : Vérifier qu'il échoue**

Run : `npx playwright test tests/e2e/mobile.spec.ts --reporter=line`
Expected : FAIL (« Modifier le contenu » introuvable).

- [ ] **Step 3 : Créer `src/components/layout/EditorDrawer.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * Wrapper client du panneau éditeur. Desktop : simple <section> inchangée.
 * Mobile (≤900px, via CSS) : la section devient un tiroir plein écran,
 * ouvert/fermé par l'événement `cvforge:toggle-form` (déclenché par le
 * bouton ✏️ de la TopBar — même pattern que `cvforge:open-snapshots`).
 */
export default function EditorDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener("cvforge:toggle-form", toggle);
    return () => window.removeEventListener("cvforge:toggle-form", toggle);
  }, []);

  return (
    <section className={`pane editor-pane${open ? " editor-pane--open" : ""}`}>
      {children}
      <button type="button" className="editor-drawer-close go" onClick={() => setOpen(false)}>
        ✓ Terminé
      </button>
    </section>
  );
}
```

- [ ] **Step 4 : Brancher le tiroir dans `src/app/page.tsx`**

```tsx
import PreviewPane from "@/components/editor/PreviewPane";
import EditorPane from "@/components/editor/EditorPane";
import TopBar from "@/components/layout/TopBar";
import MetaBar from "@/components/layout/MetaBar";
import ActionsBar from "@/components/layout/ActionsBar";
import DraftManager from "@/components/layout/DraftManager";
import EditorDrawer from "@/components/layout/EditorDrawer";

export default function Home() {
  return (
    <div className="wrap">
      <TopBar />

      <MetaBar />

      <div className="split">
        <EditorDrawer>
          <EditorPane />
        </EditorDrawer>

        <section className="pane preview-pane">
          <PreviewPane />
        </section>
      </div>

      <ActionsBar />

      <DraftManager />
    </div>
  );
}
```

(`EditorDrawer` rend lui-même la `<section className="pane editor-pane">` : le DOM desktop est identique.)

- [ ] **Step 5 : Ajouter le bouton ✏️ dans `TopBar.tsx`**

Juste **avant** le bouton ☰ de la Task 2 :

```tsx
        <button
          type="button"
          className="btn-nav mobile-only"
          aria-label="Modifier le contenu"
          onClick={() => window.dispatchEvent(new CustomEvent("cvforge:toggle-form"))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
        </button>
```

- [ ] **Step 6 : Icônes + libellés masquables dans `ActionsBar.tsx`**

Remplacer le bouton Effacer :
```tsx
      <button type="button" className="ghost" onClick={onClear}>Effacer</button>
```
par :
```tsx
      <button type="button" className="ghost" aria-label="Effacer" onClick={onClear}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        <span className="btn-label">Effacer</span>
      </button>
```
et dans le bouton `.actions-help`, envelopper le texte : `Comment ça marche` → `<span className="btn-label">Comment ça marche</span>`, et ajouter `aria-label="Comment ça marche"` au bouton (le testid `help-open` existant ne bouge pas).

⚠️ Le bouton `.ghost` n'a pas de `display: flex` de base : ajouter `display: inline-flex; align-items: center; gap: 6px;` à la règle `button.ghost` existante (hors media query, changement desktop cosmétique : icône + texte).

- [ ] **Step 7 : CSS mobile (bloc final de `globals.css`)**

Remplacer les règles `.actions` actuelles du bloc mobile :
```css
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: stretch; }
  .actions > * {
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; margin: 0; min-height: 48px; padding: 10px 16px;
  }
  .actions .actions-help { grid-column: 1 / -1; }
```
par :
```css
  /* CTA épinglé : Adapter (large) + Effacer/Aide en icônes, une seule rangée. */
  .actions {
    display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: stretch;
    position: sticky; bottom: 10px; z-index: 50;
    box-shadow: var(--neu-raised-lg);
  }
  .actions > * {
    display: inline-flex; align-items: center; justify-content: center;
    margin: 0; min-height: 48px; padding: 10px 14px;
  }
  .actions .btn-label { display: none; }
  .actions .actions-help { margin-left: 0; }
```

Et **ajouter** dans le même bloc mobile :
```css
  /* Aperçu en tête ; le panneau éditeur devient un tiroir plein écran. */
  .split { flex-direction: column; }
  .pane.preview-pane { order: -1; min-height: 60vh; }
  .pane.editor-pane {
    position: fixed; inset: 0; z-index: 105; border-radius: 0;
    transform: translateY(102%); transition: transform 220ms ease;
  }
  .pane.editor-pane.editor-pane--open { transform: translateY(0); }
  .editor-drawer-close { display: inline-flex; margin: 10px 16px; }
```
(La règle `.split { flex-direction: column; }` existe déjà dans le **premier** bloc `@media 900px` du fichier — la laisser là-bas, ne pas la dupliquer ; seule la ligne `order` est nouvelle. Supprimer aussi `.pane.preview-pane { min-height: 320px; }` du premier bloc, remplacée par les `60vh` ci-dessus.)

Hors media query, sous les styles `.pane` :
```css
.editor-drawer-close { display: none; }
```

- [ ] **Step 8 : Vérifier que le test passe**

Run : `npx playwright test tests/e2e/mobile.spec.ts --reporter=line`
Expected : `2 passed`

- [ ] **Step 9 : Non-régression complète**

Run : `npx playwright test --reporter=line`
Expected : `26 passed` (flaky `import-text` : relancer une fois si besoin).
⚠️ Vérifier en particulier `editor.spec.ts` et `help.spec.ts` (ils manipulent le formulaire et l'aide en desktop — le DOM n'a pas changé, seul un wrapper client s'est intercalé).

- [ ] **Step 10 : Contrôle visuel mobile**

Avec Playwright MCP ou le navigateur en 390×844 : aperçu visible d'entrée, ✏️ ouvre le tiroir (le formulaire défile à l'intérieur), « ✓ Terminé » referme, barre Adapter/🗑/? collée en bas pendant le scroll.

- [ ] **Step 11 : Commit**

```bash
git add web/src/app/page.tsx web/src/components/layout/EditorDrawer.tsx web/src/components/layout/TopBar.tsx web/src/components/layout/ActionsBar.tsx web/src/app/globals.css web/tests/e2e/mobile.spec.ts
git commit -m "feat(mobile): apercu en ecran principal, formulaire en tiroir, CTA epingle"
```

---

### Task 4 : Zoom de l'aperçu PDF

Le canvas est déjà rendu net (échelle 1.5 ≈ 892px de large pour un A4) puis **rétréci** par `max-width: 100%` — le zoom est donc purement CSS : afficher le canvas à sa taille native dans le conteneur `.pdf-preview` (qui a déjà `overflow: auto`). Un bouton loupe dans l'en-tête « Aperçu » bascule.

**Files:**
- Modify: `src/components/editor/PreviewPane.tsx`
- Modify: `src/components/editor/PdfPreview.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consomme : `PdfPreview({ blob, onPages })` existant.
- Produit : prop optionnelle `zoom?: boolean` sur `PdfPreview` ; classe `.pdf-preview--zoom`.

- [ ] **Step 1 : Écrire le test e2e qui échoue**

Ajouter dans `tests/e2e/mobile.spec.ts` :

```ts
  test("la loupe agrandit l'aperçu (défilement horizontal)", async ({ page }) => {
    await page.goto("/");
    const container = page.locator(".pdf-preview");
    await expect(container.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    // Ajusté à l'écran : la page ne déborde pas.
    const fitted = await container.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fitted).toBe(true);

    await page.getByRole("button", { name: "Agrandir l'aperçu" }).click();

    // Zoomé : le canvas dépasse et défile horizontalement.
    const zoomed = await container.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(zoomed).toBe(true);

    await page.getByRole("button", { name: "Réduire l'aperçu" }).click();
    const back = await container.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(back).toBe(true);
  });
```

- [ ] **Step 2 : Vérifier qu'il échoue**

Run : `npx playwright test tests/e2e/mobile.spec.ts --reporter=line`
Expected : FAIL (« Agrandir l'aperçu » introuvable).

- [ ] **Step 3 : Prop `zoom` dans `PdfPreview.tsx`**

Signature et racine du composant :

```tsx
export default function PdfPreview({
  blob,
  onPages,
  zoom = false,
}: {
  blob: Blob;
  onPages?: (n: number) => void;
  zoom?: boolean;
}) {
```
et :
```tsx
  return (
    <div
      ref={containerRef}
      className={`pdf-preview${zoom ? " pdf-preview--zoom" : ""}`}
      data-testid="pdf-preview"
    />
  );
```

- [ ] **Step 4 : Bouton loupe dans `PreviewPane.tsx`**

Ajouter l'état sous `const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);` :
```tsx
  const [zoom, setZoom] = useState(false);
```
Dans le `.pane-title`, après `<span>Aperçu</span>` :
```tsx
        <button
          type="button"
          className="form-btn-mini preview-zoom-btn"
          aria-label={zoom ? "Réduire l'aperçu" : "Agrandir l'aperçu"}
          onClick={() => setZoom((z) => !z)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />{zoom ? <line x1="8" y1="11" x2="14" y2="11" /> : <><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></>}</svg>
        </button>
```
Et passer la prop : `<PdfPreview blob={pdfBlob} onPages={onPdfPages} zoom={zoom} />`.

- [ ] **Step 5 : CSS**

Hors media query, sous `.pdf-preview__page` :

```css
/* Zoom : le canvas (déjà rendu à ~892px) s'affiche à sa taille native et
   défile horizontalement dans .pdf-preview (overflow: auto existant). */
.pdf-preview--zoom { align-items: flex-start; }
.pdf-preview--zoom .pdf-preview__page { max-width: none; }
```

- [ ] **Step 6 : Vérifier que le test passe**

Run : `npx playwright test tests/e2e/mobile.spec.ts --reporter=line`
Expected : `3 passed`

- [ ] **Step 7 : Commit**

```bash
git add web/src/components/editor/PreviewPane.tsx web/src/components/editor/PdfPreview.tsx web/src/app/globals.css web/tests/e2e/mobile.spec.ts
git commit -m "feat(apercu): zoom de la page PDF (bouton loupe, defilement horizontal)"
```

---

### Task 5 : Vérifications finales + journal

**Files:**
- Modify: `WORK_HISTORY.md` (racine du repo, PAS dans `web/`)

**Interfaces:** aucune (clôture).

- [ ] **Step 1 : Suite de vérification complète**

Depuis `web/` :
```bash
npm run lint          # attendu : 0 erreur (2 warnings préexistants tolérés : FormEditor <img>, TopBar useCallback)
npx tsc --noEmit      # attendu : aucune sortie
npm test -- --run     # attendu : 177+ tests verts
npx playwright test   # attendu : 27 passed (24 existants + 3 mobiles)
```

- [ ] **Step 2 : Contrôle visuel final (390×844 ET 1280×800, sombre ET clair)**

- Mobile : topbar 1 ligne ; menu ☰ fonctionnel ; aperçu en tête lisible ; loupe opérationnelle ; tiroir formulaire fluide ; CTA épinglé ; boutons orange blanc/orange.
- Desktop : **identique à avant ce plan** (à l'exception d'Effacer qui gagne une icône).

- [ ] **Step 3 : Entrée de journal**

Ajouter en tête du Journal de `WORK_HISTORY.md` une entrée datée décrivant : Quoi (les 4 chantiers, fichiers créés), Pourquoi (feedback de Hariss sur l'audit mobile : hiérarchie aperçu-d'abord, menu ☰, retour de l'orange), Résultat vérifs (sorties réelles des commandes du Step 1), Commits (hashes réels).

- [ ] **Step 4 : Commit du journal**

```bash
git add WORK_HISTORY.md
git commit -m "docs: journal de la refonte mobile apercu-d-abord"
```

---

## Self-Review

- **Couverture** : orange restauré (T1) ✓, texte réduit/menu ☰ avec Nouveau CV dedans (T2) ✓, aperçu en tête + formulaire en tiroir (T3) ✓, CTA épinglé (T3) ✓, zoom aperçu (T4) ✓ — les 4 points validés par Hariss sont couverts.
- **Pièges connus adressés** : cascade CSS (tout le mobile en fin de fichier), noms accessibles préservés (`aria-label` = ancien libellé), doublons a11y évités (menu monté seulement ouvert), `align-items: stretch` requis sur les grilles de boutons, flaky `import-text` documenté.
- **Hors scope assumé** : emojis→SVG, en-tête commun aux pages Offres/Historique, libellés de l'historique, repli de la MetaBar — feront l'objet d'un plan ultérieur si souhaité.

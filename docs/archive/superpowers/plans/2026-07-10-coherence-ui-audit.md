# Cohérence UI — correction des constats haute + moyenne Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 7 constats de gravité haute et moyenne de l'audit de cohérence UI du 2026-07-10, pour qu'il n'existe plus qu'une seule primaire pleine par écran, un seul patron de modale, et aucun débordement mobile.

**Architecture:** Aucune nouvelle abstraction. Deux variables de thème (`--apply`, `--apply-text`) sont ajoutées à `globals.css` pour donner au vert un statut de couleur sémantique « candidature » ; `.pack-btn-variant` cesse d'être un bouton plein et devient un **modificateur de contour** applicable indifféremment sur les deux bases de boutons existantes (`.tailor-btn` et `.neu-btn-sm`). Les modales convergent vers le patron déjà en place dans `TailorModal`/`DiffModal`/`SnapshotsModal` : `.ui-dialog__head` avec ✕ en haut à droite, et `.ui-dialog__actions` en pied uniquement quand il y a une vraie action.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, CSS global unique (`src/app/globals.css`), Vitest, Playwright.

## Global Constraints

Ces contraintes viennent de `web/CADRAGE_EXECUTION.md` et s'appliquent à **toutes** les tasks ci-dessous :

- Branche de travail : `feature/refonte-ui-nextjs`. **Aucun `git push`** (un push déploie la prod Vercel). Aucune création de branche, aucun merge.
- Toutes les commandes se lancent depuis `web/`.
- **Aucune couleur en dur** : uniquement des variables de thème définies dans `src/app/globals.css`.
- Aucune dépendance npm ajoutée ou mise à jour.
- Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté.
- Jamais `alert`/`confirm`/`prompt` natifs → `uiAlert`/`uiConfirm`/`uiPrompt`/`toast` de `@/state/uiStore`.
- Un test existant ne se modifie **que** si cette task l'ordonne explicitement (aucune ne l'ordonne : les tests actuels doivent tous rester verts sans retouche).
- Vérification après **chaque** task, dans cet ordre, sortie lue et collée :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  npm run build
  npx playwright test
  ```
- Après chaque task : une entrée datée en tête de la section `## Journal` de `WORK_HISTORY.md` (racine du repo) + mise à jour de la ligne « Prochaine étape suggérée ». Un commit local par task, message en français.
- Piège Windows/Turbopack : si un changement CSS ne s'affiche pas ou qu'un e2e échoue bizarrement → supprimer `web/.next`, vérifier qu'aucun serveur ne traîne sur le port 3000, relancer.

**Décisions de design actées avec l'utilisateur (ne pas les rediscuter) :**

1. Le vert devient une **couleur sémantique « candidature »**, employée **en contour uniquement, jamais en bouton plein**.
2. **Une seule primaire pleine orange par écran.**
3. Le constat n°12 (toggle de thème absent du header Offres) est **hors périmètre** : déjà corrigé le 2026-07-09.
4. Les constats de gravité basse (n°08 à n°13) sont **hors périmètre**, à deux exceptions près que les tasks ci-dessous emportent mécaniquement : le n°13 (« Pas intéressé » lien nu dans une coquille de bouton) est résolu par la Task 2, et l'emoji 💾 de la barre de modèles est retiré par la Task 6 parce que le constat n°05 l'exige explicitement (« Harmoniser le traitement des trois boutons »).

## Structure des fichiers

| Fichier | Responsabilité dans ce plan |
|---|---|
| `src/app/globals.css` | Seul porteur des couleurs et de la géométrie. Touché par les 6 tasks. |
| `src/components/jobs/JobCard.tsx` | Rangée d'actions d'une offre (Tasks 1, 2). |
| `src/components/modals/TailorModal.tsx` | Bouton « Créer le Pack candidature » (Task 1), segmented control (Task 5). |
| `src/components/modals/HelpModal.tsx` | Patron de modale (Task 3). |
| `src/components/modals/PackModal.tsx` | Patron de modale (Task 3), barre de modèles (Task 6). |
| `src/components/modals/ImportPdfModal.tsx` | Gabarit et pied d'import (Task 4). |
| `src/components/modals/ImportTextModal.tsx` | Gabarit et pied d'import (Task 4). |
| `tests/e2e/jobs.spec.ts` | Tests ajoutés (Tasks 1, 2). |
| `tests/e2e/help.spec.ts` | Test ajouté (Task 3). |
| `tests/e2e/import-pdf.spec.ts` | Test ajouté (Task 4). |
| `tests/e2e/tailor.spec.ts` | Test ajouté (Task 5). |
| `tests/e2e/pack.spec.ts` | Test ajouté (Task 6). |

Les tests unitaires Vitest ne couvrent pas le CSS : **toutes les vérifications de ce plan sont des e2e Playwright**, écrites avant le code (TDD).

---

### Task 1: Le vert devient une couleur sémantique en contour

Corrige le **constat n°01** (deux boutons primaires pleins de couleurs différentes se disputent l'attention).

**Files:**
- Modify: `src/app/globals.css` (`:root` l.25-29, `[data-theme="dark"]` l.53-56, `.pack-btn-variant` l.448, `.job-score-high` l.818)
- Test: `tests/e2e/jobs.spec.ts`

Cette task ne touche **que** le CSS : `JobCard.tsx` et `TailorModal.tsx` portent déjà la classe `.pack-btn-variant`, dont on change la définition sous eux. Le passage de `job-apply` sur la base `.neu-btn-sm` est l'affaire de la Task 2.

**Interfaces:**
- Consomme : rien.
- Produit : les variables CSS `--apply` (teinte de contour) et `--apply-text` (teinte de texte, contrastée sur `--bg`), et la classe modificatrice `.pack-btn-variant` **sans fond plein**, utilisable sur `.tailor-btn` comme sur `.neu-btn-sm`. La Task 2 s'appuie sur cette classe.

- [ ] **Step 1: Écrire le test e2e qui échoue**

Ajouter ce test à la fin de `tests/e2e/jobs.spec.ts`. Il vérifie qu'aucun bouton de la carte n'utilise un dégradé de fond, c'est-à-dire qu'il n'y a qu'une primaire pleine (« Adapter mon CV ») et que « Candidater » est un contour.

```ts
test("« Candidater » est un bouton de contour, pas une seconde primaire pleine", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);

  // « Adapter mon CV » est la seule primaire : fond en dégradé orange.
  const adaptBg = await page
    .getByTestId("job-adapt")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(adaptBg).toContain("gradient");

  // « Candidater » n'a aucun fond plein ni dégradé : c'est un contour.
  const apply = page.getByTestId("job-apply");
  const applyBg = await apply.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(applyBg).toBe("none");

  // Sa couleur de texte est la teinte sémantique « candidature », pas du blanc.
  const applyColor = await apply.evaluate((el) => getComputedStyle(el).color);
  expect(applyColor).not.toBe("rgb(255, 255, 255)");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx playwright test tests/e2e/jobs.spec.ts -g "Candidater"`
Expected: FAIL — `expect(applyBg).toBe("none")` reçoit `linear-gradient(145deg, rgb(47, 169, 130), rgb(30, 142, 106))` (le vert plein actuel).

- [ ] **Step 3: Ajouter les variables de thème**

Dans `src/app/globals.css`, bloc `:root`, juste après la ligne `--success:       #256D2A;` (l.25), insérer :

```css
  /* Vert « candidature » : couleur SÉMANTIQUE, jamais un fond de bouton plein.
     --apply sert au trait de contour, --apply-text au texte (4.5:1 sur --bg clair). */
  --apply:         #1E8E6A;
  --apply-text:    #146B4F;
```

Dans le bloc `[data-theme="dark"]`, juste après `--success:       #66BB6A;` (l.53), insérer :

```css
  --apply:         #2FA982;
  --apply-text:    #4FC49F;
```

- [ ] **Step 4: Supprimer le bouton vert plein**

Dans `src/app/globals.css`, **supprimer entièrement** la ligne 448 :

```css
.pack-btn-variant { background: linear-gradient(145deg, #2fa982, #1e8e6a); color: #fff; }
```

- [ ] **Step 5: Redéfinir `.pack-btn-variant` en modificateur de contour**

La nouvelle règle doit être placée **après** `.neu-btn-sm` (l.755-765) : à spécificité égale, la dernière règle du fichier gagne, et `.pack-btn-variant` doit pouvoir surcharger le `box-shadow` des deux bases (`.tailor-btn` l.436 et `.neu-btn-sm` l.755). L'insérer juste après la ligne `.neu-btn-sm.view-pdf { color: var(--orange-text); }` (l.765), avant le `@media (max-width: 768px)` qui suit :

```css
/* Modificateur « candidature » : contour vert sémantique, applicable sur .tailor-btn
   comme sur .neu-btn-sm. Jamais de fond plein — une seule primaire par écran. */
.pack-btn-variant {
  background: var(--bg);
  color: var(--apply-text);
  box-shadow: var(--neu-raised-sm), inset 0 0 0 1.5px var(--apply);
}
.pack-btn-variant:hover {
  box-shadow: var(--neu-raised), inset 0 0 0 1.5px var(--apply);
  transform: translateY(-1px);
}
.pack-btn-variant:active {
  box-shadow: var(--neu-inset), inset 0 0 0 1.5px var(--apply);
  transform: translateY(1px);
}
.pack-btn-variant:disabled {
  opacity: 0.5;
  transform: none;
}
```

- [ ] **Step 6: Supprimer la dernière couleur verte en dur**

Le vert du score élevé (`.job-score-high`) est aujourd'hui écrit en dur, ce qui viole la règle « aucune couleur en dur » et empêche le thème sombre de l'ajuster. C'est exactement la teinte qu'on vient de nommer. Dans `src/app/globals.css` l.818, remplacer :

```css
.job-score-high .job-score-num { color: #2fa982; }
```

par :

```css
.job-score-high .job-score-num { color: var(--apply-text); }
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il passe**

Run: `npx playwright test tests/e2e/jobs.spec.ts -g "Candidater"`
Expected: PASS (1 passed)

Si le test échoue en signalant un fond encore vert : purger `web/.next` (piège Turbopack, voir Global Constraints) et relancer.

- [ ] **Step 8: Vérifier la non-régression du bouton du Pack**

Le même modificateur habille « Créer le Pack candidature » dans `TailorModal` (`src/components/modals/TailorModal.tsx:210`) : aucun changement de code n'y est nécessaire, mais le rendu doit être vérifié.

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: PASS — le sélecteur `getByRole("button", { name: "Créer le Pack candidature" })` est inchangé.

- [ ] **Step 9: Vérification complète**

Run, depuis `web/`, en lisant chaque sortie :
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: 0 erreur tsc, 0 erreur lint, Vitest tout vert (194 tests au dernier relevé), build OK, e2e tous verts.

- [ ] **Step 10: Journal + commit**

Ajouter en tête de la section `## Journal` de `WORK_HISTORY.md` (racine du repo) une entrée datée `### 2026-07-10 : Vert « candidature » en contour (audit UI, constat 01)` au format des entrées existantes (Quoi / Fichiers touchés / Résultat vérifs / Commits), et mettre à jour la ligne « Prochaine étape suggérée » de la section « État actuel ».

```bash
git add src/app/globals.css tests/e2e/jobs.spec.ts ../WORK_HISTORY.md
git commit -m "fix(ui): le vert candidature devient une couleur semantique en contour (constat 01)"
```

---

### Task 2: Une seule primaire et un lien nu dans la rangée d'actions des offres

Corrige le **constat n°02** (quatre boutons, quatre styles) et emporte le **constat n°13** (« Pas intéressé » : lien rouge dans une coquille de bouton).

**Files:**
- Modify: `src/components/jobs/JobCard.tsx:48-69`
- Modify: `src/app/globals.css` (nouvelle règle `.job-dismiss-link` ; media query `@media (max-width: 768px)` l.835-851)
- Test: `tests/e2e/jobs.spec.ts`

**Interfaces:**
- Consomme : `.pack-btn-variant` (Task 1), qui doit déjà être un modificateur applicable sur `.neu-btn-sm`.
- Produit : la classe `.job-dismiss-link`. Le `data-testid="job-dismiss"` est **conservé** — le test existant `« Pas intéressé » retire l'offre, « Annuler » la restaure` (`tests/e2e/jobs.spec.ts:57`) doit rester vert sans être modifié.

Résultat visé pour la rangée : **1 primaire pleine** (« Adapter mon CV », `.tailor-btn`) + **2 secondaires de géométrie identique** (« Candidater » et « Voir l'offre », tous deux `.neu-btn-sm`, seule la teinte du contour les distingue) + **1 lien discret** hors de toute coquille (« Pas intéressé »).

- [ ] **Step 1: Écrire le test e2e qui échoue**

Ajouter à la fin de `tests/e2e/jobs.spec.ts` :

```ts
test("la rangée d'actions : une primaire, deux secondaires identiques, un lien nu", async ({ page }) => {
  await mockScanOk(page);
  await page.goto("/jobs");
  await page.getByTestId("jobs-scan").click();
  await expect(page.getByTestId("job-card")).toHaveCount(1);

  // « Candidater » et « Voir l'offre » partagent exactement la même base de bouton.
  await expect(page.getByTestId("job-apply")).toHaveClass(/neu-btn-sm/);
  const applyBox = await page.getByTestId("job-apply").boundingBox();
  const viewBox = await page.locator(".job-actions a.neu-btn-sm").boundingBox();
  expect(applyBox).not.toBeNull();
  expect(viewBox).not.toBeNull();
  expect(Math.abs(applyBox!.height - viewBox!.height)).toBeLessThanOrEqual(1);

  // « Pas intéressé » n'est plus une coquille de bouton : ni ombre, ni fond.
  const dismiss = page.getByTestId("job-dismiss");
  await expect(dismiss).toHaveClass(/job-dismiss-link/);
  const shadow = await dismiss.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toBe("none");
  const bg = await dismiss.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgba(0, 0, 0, 0)");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx playwright test tests/e2e/jobs.spec.ts -g "rangée d'actions"`
Expected: FAIL — `toHaveClass(/neu-btn-sm/)` échoue sur `job-apply`, qui porte encore `tailor-btn pack-btn-variant`.

- [ ] **Step 3: Réécrire la rangée d'actions**

Dans `src/components/jobs/JobCard.tsx`, remplacer intégralement le bloc `<div className="job-actions">` (l.48-69) par :

```tsx
      <div className="job-actions">
        <button type="button" className="tailor-btn" onClick={() => onAdapt(job)} data-testid="job-adapt">
          Adapter mon CV
        </button>
        <button
          type="button"
          className="neu-btn-sm pack-btn-variant"
          onClick={() => onApply(job)}
          data-testid="job-apply"
        >
          Candidater
        </button>
        {job.url ? (
          <a
            className="neu-btn-sm"
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSeen(job)}
          >
            Voir l&apos;offre
          </a>
        ) : null}
        <button
          type="button"
          className="job-dismiss-link"
          onClick={() => onDismiss(job)}
          data-testid="job-dismiss"
        >
          Pas intéressé
        </button>
      </div>
```

- [ ] **Step 4: Styler le lien discret**

Dans `src/app/globals.css`, juste après la règle `.job-actions { … }` (l.833), insérer :

```css
/* « Pas intéressé » : action de retrait, volontairement hors de la hiérarchie
   des boutons — un lien nu, sans coquille. */
.job-dismiss-link {
  background: none; border: none; box-shadow: none;
  padding: 6px 4px; margin-left: 4px;
  color: var(--muted); font-size: 12px; font-family: var(--font-ui);
  cursor: pointer; transition: color 120ms;
}
.job-dismiss-link:hover { color: var(--error); text-decoration: underline; }
```

- [ ] **Step 5: Corriger la grille mobile**

La règle mobile actuelle force **tous** les enfants de `.job-actions` à la pleine largeur avec une hauteur de 44 px — c'est elle qui fabrique la « coquille de bouton » autour du lien. Dans `src/app/globals.css`, remplacer le bloc l.841-850 :

```css
  .job-actions {
    grid-column: 1 / -1;
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    align-items: stretch;
  }
  .job-actions > * {
    width: 100%; min-height: 44px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .job-actions > :last-child { grid-column: 1 / -1; }
```

par :

```css
  .job-actions {
    grid-column: 1 / -1;
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    align-items: stretch;
  }
  /* Les vrais boutons se partagent la largeur ; le lien de retrait en est exclu. */
  .job-actions > *:not(.job-dismiss-link) {
    width: 100%; min-height: 44px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  /* Le lien passe seul sur sa ligne, centré, avec une cible tactile de 44 px. */
  .job-dismiss-link {
    grid-column: 1 / -1; justify-self: center;
    min-height: 44px; margin-left: 0;
  }
```

Note : `.job-dismiss-link` étant toujours le dernier enfant du JSX, la règle `> :last-child` devient inutile — d'où sa suppression.

- [ ] **Step 6: Lancer le test pour vérifier qu'il passe**

Run: `npx playwright test tests/e2e/jobs.spec.ts`
Expected: PASS — le nouveau test **et** les tests existants (`« Pas intéressé » retire l'offre, « Annuler » la restaure`, `« Adapter mon CV » …`) sont verts sans avoir été modifiés.

- [ ] **Step 7: Vérification complète**

Run, depuis `web/` :
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert.

- [ ] **Step 8: Journal + commit**

Entrée `### 2026-07-10 : Rangée d'actions des offres — une primaire, un lien nu (constats 02 et 13)` en tête du `## Journal` de `WORK_HISTORY.md`.

```bash
git add src/components/jobs/JobCard.tsx src/app/globals.css tests/e2e/jobs.spec.ts ../WORK_HISTORY.md
git commit -m "fix(ui): une seule primaire et un lien nu dans la rangee d'actions des offres (constats 02, 13)"
```

---

### Task 3: Un patron de fermeture unique pour toutes les modales

Corrige le **constat n°03** (trois conventions de fermeture cohabitent).

**Files:**
- Modify: `src/components/modals/HelpModal.tsx` (l.30 et l.100-104)
- Modify: `src/components/modals/PackModal.tsx` (l.213 et l.290-294)
- Test: `tests/e2e/help.spec.ts`

**Interfaces:**
- Consomme : `.ui-dialog__head` et `.ui-dialog__close`, déjà définis dans `globals.css` (l.403-408) et déjà utilisés par `TailorModal.tsx:136-141`, `DiffModal.tsx:49-51` et `SnapshotsModal.tsx:87-89`. **Aucun CSS à ajouter.**
- Produit : la règle « ✕ en haut à droite sur toutes les modales ; pied `.ui-dialog__actions` **uniquement** quand il reste une vraie action à offrir ». Les Tasks 4 et 6 s'y conforment.

Le bouton « Fermer » en pied d'Aide et de Pack est **redondant** avec le ✕ : il est supprimé, pas déplacé. C'est ce qui rend le pied disponible pour ce qu'il doit porter (une action primaire), comme dans Import texte.

⚠️ Ne pas toucher aux `.ui-dialog__actions` de `SnapshotsModal.tsx:125` et `AtsPanel.tsx:93` : ils portent un `style={{ justifyContent: "flex-start" }}` et servent de barre d'action **interne**, pas de pied de modale. Hors périmètre.

- [ ] **Step 1: Écrire le test e2e qui échoue**

Ajouter à la fin de `tests/e2e/help.spec.ts` :

```ts
test("l'aide se ferme par la croix, sans bouton « Fermer » redondant en pied", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("help-open").click();
  const dialog = page.getByRole("dialog", { name: "Comment ça marche ?" });
  await expect(dialog).toBeVisible();

  // La croix en haut à droite est la convention unique.
  await expect(dialog.locator(".ui-dialog__close")).toBeVisible();
  // Elle n'est pas doublée par un pied d'actions.
  await expect(dialog.locator(".ui-dialog__actions")).toHaveCount(0);

  await dialog.locator(".ui-dialog__close").click();
  await expect(dialog).toHaveCount(0);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx playwright test tests/e2e/help.spec.ts -g "sans bouton"`
Expected: FAIL — `expect(dialog.locator(".ui-dialog__close")).toBeVisible()` échoue : l'Aide n'a pas de croix.

- [ ] **Step 3: Mettre l'Aide au patron**

Dans `src/components/modals/HelpModal.tsx`, remplacer la ligne 30 :

```tsx
        <h2 className="ui-dialog__title">Comment ça marche ?</h2>
```

par :

```tsx
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Comment ça marche ?</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose}>
            &times;
          </button>
        </div>
```

Puis **supprimer** le pied redondant (l.100-104) :

```tsx
        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose}>
            Fermer
          </button>
        </div>
```

Le test existant `tests/e2e/help.spec.ts:10` (`dialog.getByRole("button", { name: "Fermer" }).click()`) **reste vert sans modification** : le ✕ porte `aria-label="Fermer"`, son nom accessible est donc « Fermer », et il est désormais le seul bouton de ce nom dans la modale.

- [ ] **Step 4: Mettre le Pack au patron**

Dans `src/components/modals/PackModal.tsx`, remplacer la ligne 213 :

```tsx
        <h2 className="ui-dialog__title">Pack candidature</h2>
```

par :

```tsx
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Pack candidature</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            &times;
          </button>
        </div>
```

Puis **supprimer** le pied redondant (l.290-294) :

```tsx
        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Fermer
          </button>
        </div>
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npx playwright test tests/e2e/help.spec.ts tests/e2e/pack.spec.ts`
Expected: PASS — les 2 tests d'aide (dont l'ancien, non modifié) et le test du pack.

- [ ] **Step 6: Vérification complète**

Run, depuis `web/` :
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert. `tests/e2e/tailor.spec.ts:40` (`.tailor-modal-content` → bouton « Fermer ») est inchangé et doit rester vert.

- [ ] **Step 7: Journal + commit**

Entrée `### 2026-07-10 : Patron de fermeture unique pour les modales (constat 03)`.

```bash
git add src/components/modals/HelpModal.tsx src/components/modals/PackModal.tsx tests/e2e/help.spec.ts ../WORK_HISTORY.md
git commit -m "fix(ui): croix de fermeture sur toutes les modales, pied redondant supprime (constat 03)"
```

---

### Task 4: Les deux modales d'import sur le même gabarit

Corrige le **constat n°04** (deux modales sœurs, deux gabarits) et le **constat n°07** (dans Import PDF, le secondaire domine visuellement le primaire).

**Files:**
- Modify: `src/components/modals/ImportPdfModal.tsx` (l.86, l.99-106, l.110-114)
- Modify: `src/components/modals/ImportTextModal.tsx` (l.87)
- Test: `tests/e2e/import-pdf.spec.ts`

**Interfaces:**
- Consomme : le patron de la Task 3 (`.ui-dialog__head` + ✕ ; pied `.ui-dialog__actions` réservé aux vraies actions).
- Produit : les deux imports partagent le gabarit `[Annuler (secondaire)] [action primaire (.go)]` aligné à droite. `.import-modal { max-width: 600px }` est déjà commun aux deux : aucun CSS à ajouter.

Aujourd'hui « Choisir un PDF… » est un `.form-btn-add` compact calé à gauche au milieu du corps, tandis que « Fermer » (`.form-btn-mini`) s'étale en pied — et la règle mobile `.ui-dialog__actions > * { flex: 1 1 auto }` (l.1073) lui donne toute la largeur. En remontant l'action réelle dans le pied, la hiérarchie se remet à l'endroit et les deux boutons deviennent de largeur égale en mobile, sans une ligne de CSS.

- [ ] **Step 1: Écrire le test e2e qui échoue**

Ajouter à la fin de `tests/e2e/import-pdf.spec.ts` :

⚠️ Ce test reste en viewport desktop (celui par défaut de `playwright.config.ts`). En 375 px, le bouton « Importer un PDF » vit dans le formulaire, qui est un **tiroir fermé** (`.editor-pane` en `translateY(100%)`) : il serait inatteignable sans ouvrir le tiroir. La structure du pied se vérifie aussi bien en desktop, et la règle mobile `.ui-dialog__actions > * { flex: 1 1 auto }` (globals.css l.1073) égalise les largeurs sans code supplémentaire.

```ts
test("Import PDF : pied d'actions à droite, primaire dominante, comme Import texte", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Importer un PDF" }).click();

  const modal = page.locator(".import-modal");
  await expect(modal.locator(".ui-dialog__close")).toBeVisible();

  // Le pied porte exactement deux boutons : secondaire « Annuler », primaire « Choisir un PDF… ».
  const footerButtons = modal.locator(".ui-dialog__actions button");
  await expect(footerButtons).toHaveCount(2);
  await expect(footerButtons.nth(0)).toHaveText("Annuler");
  await expect(footerButtons.nth(1)).toHaveText("Choisir un PDF…");

  // Le primaire est le dernier (à droite) et n'est jamais dominé par le secondaire.
  const cancel = await footerButtons.nth(0).boundingBox();
  const primary = await footerButtons.nth(1).boundingBox();
  expect(cancel).not.toBeNull();
  expect(primary).not.toBeNull();
  expect(primary!.width).toBeGreaterThanOrEqual(cancel!.width - 1);
  expect(primary!.x).toBeGreaterThan(cancel!.x);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx playwright test tests/e2e/import-pdf.spec.ts -g "pied d'actions"`
Expected: FAIL — `expect(modal.locator(".ui-dialog__close")).toBeVisible()` échoue : Import PDF n'a pas de croix.

- [ ] **Step 3: Mettre Import PDF au gabarit**

Dans `src/components/modals/ImportPdfModal.tsx`, remplacer la ligne 86 :

```tsx
        <h2 className="ui-dialog__title">Importer un PDF</h2>
```

par :

```tsx
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Importer un PDF</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            &times;
          </button>
        </div>
```

Puis **supprimer** le bouton du milieu (l.99-106) :

```tsx
        <button
          type="button"
          className="form-btn-add"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choisir un PDF…
        </button>
```

Enfin, remplacer le pied (l.110-114) :

```tsx
        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Fermer
          </button>
        </div>
```

par le pied standard — secondaire à gauche, primaire à droite, exactement comme Import texte :

```tsx
        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className="go"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Choisir un PDF…
          </button>
        </div>
```

L'`<input type="file" className="import-file">` (l.91-98) reste en place et inchangé : `tests/e2e/import-pdf.spec.ts` fait un `setInputFiles` dessus, et le test existant doit rester vert sans modification.

- [ ] **Step 4: Mettre Import texte au gabarit**

Dans `src/components/modals/ImportTextModal.tsx`, remplacer la ligne 87 :

```tsx
        <h2 className="ui-dialog__title">Importer un texte</h2>
```

par :

```tsx
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Importer un texte</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            &times;
          </button>
        </div>
```

Son pied `[Annuler] [Importer]` (l.101-108) est **déjà** au gabarit : ne pas y toucher.

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npx playwright test tests/e2e/import-pdf.spec.ts tests/e2e/import-text.spec.ts`
Expected: PASS — le nouveau test, plus les deux tests d'import existants, non modifiés.

Si `import-text.spec.ts` échoue sur `getByRole("button", { name: "Importer", exact: true })` : vérifier qu'aucun bouton « Importer » n'a été ajouté par erreur ; le ✕ a pour nom accessible « Fermer », il ne peut pas entrer en conflit.

- [ ] **Step 6: Vérification complète**

Run, depuis `web/` :
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert.

- [ ] **Step 7: Journal + commit**

Entrée `### 2026-07-10 : Les deux imports sur le même gabarit (constats 04 et 07)`.

```bash
git add src/components/modals/ImportPdfModal.tsx src/components/modals/ImportTextModal.tsx tests/e2e/import-pdf.spec.ts ../WORK_HISTORY.md
git commit -m "fix(ui): gabarit commun aux deux modales d'import, hierarchie du pied retablie (constats 04, 07)"
```

---

### Task 5: Le sélecteur « Niveau d'adaptation » devient un vrai segmented control

Corrige le **constat n°06** (seule la case sélectionnée a un contenant ; les trois autres sont du texte nu).

**Files:**
- Modify: `src/app/globals.css` (`.level-btn` l.459-465)
- Test: `tests/e2e/tailor.spec.ts`

**Interfaces:**
- Consomme : rien.
- Produit : rien que d'autres tasks utilisent.

Le conteneur `.level-segment` porte déjà un `box-shadow: var(--neu-inset)` (l.457) : le creux de groupe existe, mais les cellules inactives sont transparentes, donc invisibles. On leur donne un contenant discret, et la cellule active reste la seule **surélevée** — le sens néomorphique actuel (actif = en relief) est conservé. **Aucun changement de TSX** : `TailorModal.tsx:165-180` produit déjà la bonne structure.

- [ ] **Step 1: Écrire le test e2e qui échoue**

Ajouter à la fin de `tests/e2e/tailor.spec.ts` :

```ts
test("le niveau d'adaptation est un segmented control : les 4 cellules ont un contenant", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adapter à une offre" }).click();

  const cells = page.locator(".level-segment .level-btn");
  await expect(cells).toHaveCount(4);

  // Aucune cellule n'est un texte nu : toutes ont un fond et une ombre.
  for (let i = 0; i < 4; i += 1) {
    const bg = await cells.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    const shadow = await cells.nth(i).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
  }

  // Seule la cellule sélectionnée est en relief (« Adapté » par défaut).
  await expect(page.locator(".level-btn.active")).toHaveCount(1);
  await expect(page.locator(".level-btn.active")).toHaveText("Adapté");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx playwright test tests/e2e/tailor.spec.ts -g "segmented control"`
Expected: FAIL — `expect(bg).not.toBe("rgba(0, 0, 0, 0)")` échoue dès la première cellule inactive (`background: transparent`).

- [ ] **Step 3: Donner un contenant à toutes les cellules**

Dans `src/app/globals.css`, remplacer le bloc l.459-465 :

```css
.level-btn {
  padding: 7px 4px; font-size: 12px; border-radius: 9px; border: none; background: transparent;
  color: var(--muted); cursor: pointer; text-align: center; font-family: var(--font-ui);
  transition: box-shadow 150ms, color 150ms;
}
.level-btn:hover { color: var(--text); }
.level-btn.active { background: var(--bg); box-shadow: var(--neu-raised-sm); color: var(--orange-text); font-weight: 600; }
```

par :

```css
/* Segmented control : les 4 cellules ont le même contenant ; seule la sélection
   est en relief. Sans cela, les cellules inactives passaient pour du texte nu. */
.level-btn {
  padding: 7px 4px; font-size: 12px; border-radius: 9px; border: none;
  background: var(--bg); box-shadow: inset 0 0 0 1px var(--border);
  color: var(--muted); cursor: pointer; text-align: center; font-family: var(--font-ui);
  transition: box-shadow 150ms, color 150ms;
}
.level-btn:hover { color: var(--text); box-shadow: var(--neu-raised-sm); }
.level-btn.active { background: var(--bg); box-shadow: var(--neu-raised-sm); color: var(--orange-text); font-weight: 600; }
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx playwright test tests/e2e/tailor.spec.ts`
Expected: PASS — le nouveau test et les tests d'adaptation existants.

- [ ] **Step 5: Vérification complète**

Run, depuis `web/` :
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert.

- [ ] **Step 6: Journal + commit**

Entrée `### 2026-07-10 : Segmented control du niveau d'adaptation (constat 06)`.

```bash
git add src/app/globals.css tests/e2e/tailor.spec.ts ../WORK_HISTORY.md
git commit -m "fix(ui): les 4 cellules du niveau d'adaptation ont un contenant commun (constat 06)"
```

---

### Task 6: La barre de modèles du Pack ne déborde plus en mobile

Corrige le **constat n°05** (« Supprimer » coupé au bord droit en 375 px, et traitement hétérogène des trois boutons).

**Files:**
- Modify: `src/app/globals.css` (`@media (max-width: 700px)` l.961-963)
- Modify: `src/components/modals/PackModal.tsx:228`
- Test: `tests/e2e/pack.spec.ts`

**Interfaces:**
- Consomme : rien.
- Produit : rien.

La barre `.pack-tpl-bar` (l.947-953) est un `display: flex` sans `flex-wrap` : à 375 px, le `<select>` plus trois boutons dépassent la largeur de la modale. Le constat demande aussi d'harmoniser les trois boutons — « Enregistrer » est le seul à porter une icône (l'emoji 💾), que l'on retire.

- [ ] **Step 1: Écrire le test e2e qui échoue**

Ajouter à la fin de `tests/e2e/pack.spec.ts` :

```ts
test("en mobile, la barre de modèles ne déborde pas de la modale", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/extract-meta", (route) =>
    route.fulfill({ status: 500, json: { error: "pas de clé" } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Adapter à une offre" }).click();
  await page.getByRole("button", { name: "Créer le Pack candidature" }).click();

  const bar = page.locator(".pack-tpl-bar");
  await expect(bar).toBeVisible();

  // Aucun débordement horizontal : « Supprimer » n'est plus coupé.
  const overflow = await bar.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // « Supprimer » est entièrement dans la modale.
  const barBox = await bar.boundingBox();
  const deleteBox = await bar.getByRole("button", { name: "Supprimer" }).boundingBox();
  expect(barBox).not.toBeNull();
  expect(deleteBox).not.toBeNull();
  expect(deleteBox!.x + deleteBox!.width).toBeLessThanOrEqual(barBox!.x + barBox!.width + 1);

  // Les trois boutons de la barre sont traités à l'identique : aucun emoji.
  await expect(bar.getByRole("button", { name: "Enregistrer" })).toHaveText("Enregistrer");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx playwright test tests/e2e/pack.spec.ts -g "barre de modèles"`
Expected: FAIL — `expect(overflow).toBeLessThanOrEqual(1)` reçoit une valeur positive (la barre est plus large que la modale).

- [ ] **Step 3: Autoriser le retour à la ligne en mobile**

Dans `src/app/globals.css`, remplacer le bloc l.961-963 :

```css
@media (max-width: 700px) {
  .pack-vars { grid-template-columns: 1fr; }
}
```

par :

```css
@media (max-width: 700px) {
  .pack-vars { grid-template-columns: 1fr; }
  /* Sous 700px, le sélecteur prend sa ligne et les 3 actions passent en dessous :
     « Supprimer » n'est plus coupé au bord droit de la modale. */
  .pack-tpl-bar { flex-wrap: wrap; }
  .pack-tpl-bar select { flex: 1 1 100%; }
  .pack-tpl-bar .form-btn-mini { flex: 1 1 0; justify-content: center; }
}
```

- [ ] **Step 4: Harmoniser le traitement des trois boutons**

Dans `src/components/modals/PackModal.tsx`, remplacer la ligne 228 :

```tsx
          <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>💾 Enregistrer</button>
```

par :

```tsx
          <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>Enregistrer</button>
```

Les boutons « Dupliquer » (l.229) et « Supprimer » (l.230) sont déjà en texte seul : ne pas y toucher.

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npx playwright test tests/e2e/pack.spec.ts`
Expected: PASS — le nouveau test et le test du pack existant.

- [ ] **Step 6: Vérification complète**

Run, depuis `web/` :
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: tout vert. C'est la vérification de fin de plan : la suite e2e complète doit passer.

- [ ] **Step 7: Journal + commit**

Entrée `### 2026-07-10 : Barre de modèles du Pack en mobile (constat 05)`, et mise à jour de la ligne « Prochaine étape suggérée » de la section « État actuel » : les 7 constats haute+moyenne de l'audit sont soldés ; restent les constats basses 08 à 11 (emojis, z-index du FAB, coche de sauvegarde, casse « CV Tailor »).

```bash
git add src/app/globals.css src/components/modals/PackModal.tsx tests/e2e/pack.spec.ts ../WORK_HISTORY.md
git commit -m "fix(ui): la barre de modeles du Pack wrappe en mobile, boutons harmonises (constat 05)"
```

---

## Rapport final attendu

Au format imposé par `web/CADRAGE_EXECUTION.md` §5, pour chacune des 6 tasks :

```
### TASK n — <titre>
- Fichiers modifiés : <liste exacte>
- Résumé du changement : <3 lignes max>
- Critères du plan : [x] / [ ]
- tsc / lint / vitest / build / e2e : OK ou KO (+ extrait si KO)
- Commit : <hash + message>
- Journal WORK_HISTORY.md : fait [x]
```

Puis une section « Points sur lesquels je me suis arrêté pour demander » (même vide).

## Hors périmètre — à traiter plus tard si tu le souhaites

Constats de gravité basse non traités par ce plan : n°08 (emojis 🔥 et 🏴 dans des boutons), n°09 (le FAB « ✓ Terminé » passe au-dessus des modales), n°10 (« Brouillon sauvegardé » réduit à une coche isolée en mobile), n°11 (« cv-tailor » en minuscules dans l'Aide vs « CV Tailor » ailleurs — `HelpModal.tsx:36`). Le n°12 était déjà corrigé, le n°13 est emporté par la Task 2.

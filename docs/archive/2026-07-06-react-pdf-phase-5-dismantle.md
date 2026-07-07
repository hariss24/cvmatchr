# Démontage du Moteur HTML (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le moteur de rendu HTML historique et ses templates associés, et basculer 100% des aperçus et exports (CV et Lettre) vers le moteur React PDF.

**Architecture:** La logique conditionnelle (`docEngine`) sera supprimée. Les modales `PackModal` et `DiffModal`, ainsi que le panneau d'aperçu principal `PreviewPane` n'utiliseront plus d'iframes HTML sandboxées (`srcDoc`), mais des composants `<PdfPreview />` avec des URLs blob générées via `generateResumePdfBlob` et le nouveau `generateLetterPdfBlob`. Le serveur (API `/api/convert`) et la stack Playwright locale (`@sparticuz/chromium`) sont éliminés.

**Tech Stack:** Next.js, React, Zustand, `@react-pdf/renderer`, Playwright (pour E2E), Vitest.

## Global Constraints

- **Aucune dépendance npm ajoutée** : On ne fait qu'en retirer.
- **Règle #9 CADRAGE_EXECUTION.md** : Les tests existants doivent être adaptés car la méthode d'inspection de l'UI change (disparition de l'iframe texte, apparition d'un Canvas PDF in-inspectable).
- Les vérifications globales (Vitest, Playwright, TSC, Lint) doivent passer après chaque commit.

---

### Task 1: Nettoyage du Store et des Templates

**Files:**
- Modify: `web/src/state/docStore.ts`
- Modify: `web/src/lib/resume/templates.ts`
- Modify: `web/src/lib/pdfgen/generatePdf.tsx`
- Test: `web/src/state/docStore.test.ts`

**Interfaces:**
- Produces: `docEngine` retiré (on assume le PDF partout). Export de `generateLetterPdfBlob` disponible pour les autres composants.

- [ ] **Step 1: Write the failing test**

```typescript
// web/src/state/docStore.test.ts
import { describe, it, expect } from "vitest";
import { useDocStore } from "./docStore";
import { TEMPLATES } from "@/lib/resume/templates";
import * as pdfGen from "@/lib/pdfgen/generatePdf";

describe("docStore (PDF Only)", () => {
  it("ne contient plus les anciens templates", () => {
    expect(TEMPLATES["moderne"]).toBeUndefined();
    expect(TEMPLATES["classique"]).toBeUndefined();
    expect(TEMPLATES["minimal"]).toBeUndefined();
  });
});

describe("generatePdf", () => {
  it("exporte generateLetterPdfBlob", () => {
    expect(pdfGen.generateLetterPdfBlob).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run web/src/state/docStore.test.ts`
Expected: FAIL avec `expected undefined to be undefined` qui échoue si les templates existent, et `generateLetterPdfBlob` non défini.

- [ ] **Step 3: Write minimal implementation**
```typescript
// web/src/lib/resume/templates.ts
export type TemplateId = "sobre" | "graphique" | "kakuna";
export const TEMPLATES: Record<TemplateId, Template> = {
  sobre: { id: "sobre", name: "Sobre", css: "..." },
  graphique: { id: "graphique", name: "Graphique", css: "..." },
  kakuna: { id: "kakuna", name: "Kakuna", css: "..." },
};
```
Dans `web/src/state/docStore.ts`, supprimer la fonction `docEngine` et ses types associés.
Dans `web/src/lib/pdfgen/generatePdf.tsx`, ajouter :
```typescript
export async function generateLetterPdfBlob(
  letter: import("@/lib/resume/schema").Letter,
  atsKeywords: string[]
): Promise<Blob> {
  const [{ pdf }, { LetterDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./LetterDocument"),
  ]);
  return pdf(<LetterDocument letter={letter} atsKeywords={atsKeywords} />).toBlob();
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run web/src/state/docStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add web/src/state/docStore.ts web/src/lib/resume/templates.ts web/src/lib/pdfgen/generatePdf.tsx web/src/state/docStore.test.ts
git commit -m "refactor: suppression templates HTML et ajout generateLetterPdfBlob"
```

---

### Task 2: Refactorisation TopBar (Export)

**Files:**
- Modify: `web/src/components/layout/TopBar.tsx`

**Interfaces:**
- Consumes: `generateLetterPdfBlob` depuis la Tâche 1.
- Produces: Bouton "Convertir en PDF" fonctionnant 100% côté client (plus de fetch vers /api/convert).

- [ ] **Step 1: Write the failing test**
Les modifications UI de ce type seront validées par E2E.
```typescript
// web/tests/e2e/export.spec.ts (Créer ou adapter)
import { test, expect } from "@playwright/test";

test("TopBar génère un PDF côté client pour la Lettre sans appel réseau /api/convert", async ({ page }) => {
  await page.goto("/");
  // Basculer en Lettre
  await page.evaluate(() => window.useDocStore.getState().setDocType("Lettre"));
  
  // Intercepter /api/convert pour s'assurer qu'il N'EST PAS appelé
  let apiCalled = false;
  await page.route("/api/convert", () => { apiCalled = true; });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("text=Convertir en PDF").click()
  ]);
  
  expect(apiCalled).toBeFalsy();
  expect(download.suggestedFilename()).toContain("Lettre");
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx playwright test web/tests/e2e/export.spec.ts`
Expected: FAIL car l'API est appelée ou timeout sur le download.

- [ ] **Step 3: Write minimal implementation**
Dans `web/src/components/layout/TopBar.tsx`, remplacer le switch `docEngine` de `onConvert` par :
```typescript
let blob: Blob;
if (docType === "Lettre") {
  blob = await generateLetterPdfBlob(json as Letter, boostKeywords);
} else {
  blob = await generateResumePdfBlob(
    json as Resume,
    templateId as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId,
    boostKeywords
  );
}
```
Supprimer la variable `htmlSource` et le fallback `fetch("/api/convert")`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx playwright test web/tests/e2e/export.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add web/src/components/layout/TopBar.tsx web/tests/e2e/export.spec.ts
git commit -m "refactor: TopBar exporte le PDF 100% coté client"
```

---

### Task 3: PreviewPane full PDF

**Files:**
- Modify: `web/src/components/editor/PreviewPane.tsx`

**Interfaces:**
- Consumes: `generateLetterPdfBlob` et `generateResumePdfBlob`.
- Produces: Un `PreviewPane` sans balise `<iframe>`.

- [ ] **Step 1: Write the failing test**
Dans `web/tests/e2e/editor.spec.ts` (ou équivalent), adapter l'assertion historique qui lisait le texte dans l'iframe.
```typescript
// Mettre à jour editor.spec.ts pour la nouvelle logique
// Remplacer : expect(page.frameLocator(".preview-frame").getByText("...")) 
// Par : expect(page.locator(".pdf-preview")).toBeVisible();
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx playwright test web/tests/e2e/editor.spec.ts`
Expected: FAIL car le test d'origine échoue sans l'iframe.

- [ ] **Step 3: Write minimal implementation**
Dans `web/src/components/editor/PreviewPane.tsx` :
- Retirer tout ce qui concerne `iframe`, `srcDoc`, `mergeHtml`, `renderLetter`.
- Forcer la variable locale `const usePdf = true;` de manière inconditionnelle ou l'enlever complètement (le code sera plus simple).
- Lors de la génération (dans le `setTimeout`), générer `generateLetterPdfBlob` si `docType === "Lettre"`.
- Rendre `<PdfPreview />` (ou l'état de chargement) pour tous les templates.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx playwright test web/tests/e2e/editor.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add web/src/components/editor/PreviewPane.tsx web/tests/e2e/editor.spec.ts
git commit -m "refactor: PreviewPane bascule completement sur react-pdf"
```

---

### Task 4: Adaptation de PackModal et DiffModal

**Files:**
- Modify: `web/src/components/modals/PackModal.tsx`
- Modify: `web/src/components/modals/DiffModal.tsx`

**Interfaces:**
- Consumes: Composant `PdfPreview` depuis `/components/editor/PdfPreview`.

- [ ] **Step 1: Write the failing test**
Créer un E2E léger ou vérifier manuellement (la complexité de tester des modales IA en CI nécessite souvent des mocks complets). Un test manuel sera réalisé si E2E est bloquant.

- [ ] **Step 2: Run test to verify it fails**
(Si E2E écrit) Run : `npx playwright test web/tests/e2e/modals.spec.ts`

- [ ] **Step 3: Write minimal implementation**
Dans `PackModal.tsx` :
- Créer un effet asynchrone qui appelle `generateLetterPdfBlob(result.letter, [])` dès que `result` est là pour stocker `packPdfBlob`.
- Remplacer `<iframe srcDoc={...}>` par `<PdfPreview blob={packPdfBlob} />` (attention aux dimensions/styles du CSS pour `.pack-letter-frame`).
Dans `DiffModal.tsx` :
- Retirer `mergeHtml` et l'affichage d'iframes.
- Appeler `generateResumePdfBlob` pour `tailorBefore` et pour le CV en cours. Stocker dans `beforeBlob` et `afterBlob`.
- Afficher avec `<PdfPreview />` dans les encarts (ajuster le style CSS si nécessaire).

- [ ] **Step 4: Run test to verify it passes**
Run: `npx playwright test` global pour s'assurer qu'aucune syntaxe n'est brisée.
Run manuel dans le navigateur de `DiffModal` et `PackModal`.

- [ ] **Step 5: Commit**
```bash
git add web/src/components/modals/PackModal.tsx web/src/components/modals/DiffModal.tsx
git commit -m "refactor: Modales IA utilisent PdfPreview au lieu de iframes HTML"
```

---

### Task 5: Suppression du code serveur et des dépendances inutiles

**Files:**
- Delete: `web/src/app/api/convert/route.ts`
- Delete: `web/src/lib/resume/render.ts`
- Delete: `web/src/lib/resume/mergeHtml.ts`
- Modify: `web/package.json`

- [ ] **Step 1: Write the failing test**
```typescript
// Vérifier la destruction des fichiers (pas de test de code nécessaire).
```

- [ ] **Step 2: Run test to verify it fails**
N/A

- [ ] **Step 3: Write minimal implementation**
```bash
rm web/src/app/api/convert/route.ts
rm web/src/lib/resume/render.ts
rm web/src/lib/resume/mergeHtml.ts
npm uninstall playwright-core @sparticuz/chromium
```
Nettoyer le fichier `web/src/state/docStore.ts` pour supprimer `html`, `css`, `htmlSource` si non utilisées ailleurs (vérifier la sauvegarde dans `History`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run lint && npx tsc --noEmit && npx vitest run`
Expected: Tout doit compiler et aucun test unitaire mort ne doit survivre (supprimer `render.test.ts` et `mergeHtml.test.ts`).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "chore: retrait total du backend HTML et dépendances Puppeteer"
```

---

### Task 6: Réparation finale des E2E Playwright restants

**Files:**
- Modify: `web/tests/e2e/ats.spec.ts`
- Modify: `web/tests/e2e/import-text.spec.ts`
- Modify: `web/tests/e2e/jobs.spec.ts`
- Modify: `web/tests/e2e/tailor.spec.ts`
- Modify: `web/tests/e2e/chat.spec.ts`

- [ ] **Step 1: Write the failing test**
Les tests existants sont déjà cassés car ils lisent tous `<iframe class="preview-frame">`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx playwright test`
Expected: FAIL massif (erreurs de locator sur `frameLocator`).

- [ ] **Step 3: Write minimal implementation**
Pour chaque test, retirer les `await expect(page.frameLocator(".preview-frame").getByText(...)).toBeVisible()`.
Remplacer par :
1. Soit la vérification des données injectées dans le formulaire (`page.locator('input[value="..."]')`).
2. Soit l'accès au store zustand : `const json = await page.evaluate(() => window.useDocStore.getState().json); expect(json.name).toBe("...")`.
3. Vérification de l'affichage PDF sain : `await expect(page.locator(".pdf-preview")).toBeVisible()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx playwright test`
Expected: 100% PASS.

- [ ] **Step 5: Commit**
```bash
git add web/tests/e2e/
git commit -m "test: migration E2E vers vérifications PDF et store Zustand"
```

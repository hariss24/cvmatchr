# Phase 4 — Portage des 4 templates restants en React PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactoriser le code existant en primitives partagées et porter les 4 modèles HTML restants (Sobre, Moderne, Classique, Minimal) en pur React PDF.

**Architecture:** On extrait d'abord les composants réutilisables (TimelineItem, Bullets, SectionTitle) de `ResumeDocument.tsx` vers un fichier `primitives.tsx`. On isole le rendu du template "Graphique" dans `GraphiqueTemplate.tsx`. Ensuite, on crée les 4 autres templates en s'inspirant des mises en page d'origine (HTML/CSS) ou de templates de référence, mais en utilisant uniquement React PDF (flexbox). Enfin, on met à jour `ResumeDocument.tsx` pour qu'il route les données vers le bon template.

**Tech Stack:** React, `@react-pdf/renderer`, Vitest.

## Global Constraints

- Respecter le contrat `CADRAGE_EXECUTION.md` (aucun `any`, pas d'ajout de deps npm, commit propre après chaque task).
- Ajouter une entrée au journal `REWRITE_PROGRESS.md` à la fin de chaque tâche.
- Ne jamais modifier les tests e2e sans autorisation (sauf si justifié par le changement).

---

### Task 1: Extraction des primitives et du GraphiqueTemplate

**Files:**
- Create: `web/src/lib/pdfgen/templates/primitives.tsx`
- Create: `web/src/lib/pdfgen/templates/GraphiqueTemplate.tsx`
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`

**Interfaces:**
- Consumes: `Resume` schema (`@/lib/resume/schema`)
- Produces: `TimelineItem`, `Bullets`, `SectionTitle`, `SkillText` utilisables par n'importe quel template.

- [ ] **Step 1: Créer le fichier des primitives**
Créer `web/src/lib/pdfgen/templates/primitives.tsx` et y déplacer les fonctions `TimelineItem`, `Bullets`, `SectionTitle`, `SkillText` et le helper `t` depuis `ResumeDocument.tsx`.

- [ ] **Step 2: Créer le composant GraphiqueTemplate**
Créer `web/src/lib/pdfgen/templates/GraphiqueTemplate.tsx`. Déplacer les constantes de style (`ACCENT`, `INK`, `BODY`, `s`) et le composant principal (la balise `<Page>` et son contenu) depuis `ResumeDocument.tsx` vers ce fichier. Importer les primitives créées à l'étape 1.

- [ ] **Step 3: Mettre à jour ResumeDocument.tsx (le routeur)**
Modifier `web/src/lib/pdfgen/ResumeDocument.tsx` pour qu'il importe `GraphiqueTemplate` et le retourne. Il devient un simple switch.
```tsx
import { Document } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { GraphiqueTemplate } from "./templates/GraphiqueTemplate";

export function ResumeDocument({ resume, templateId, atsKeywords }: { resume: any; templateId: string; atsKeywords?: string[] }) {
  registerPdfFonts();
  // TODO: Switch depending on templateId
  return <GraphiqueTemplate resume={resume} atsKeywords={atsKeywords} />;
}
```

- [ ] **Step 4: Vérifier la compilation et les tests**
Run: `npm run lint` et `npx vitest run src/lib/pdfgen`
Expected: PASS

- [ ] **Step 5: Commit et Journal**
Commit avec message: `web: phase 4 task 1 — extraction primitives et graphique template`
Mettre à jour `REWRITE_PROGRESS.md` (Journal).

---

### Task 2: Portage du template Sobre

**Files:**
- Create: `web/src/lib/pdfgen/templates/SobreTemplate.tsx`
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`

**Interfaces:**
- Consumes: Primitives communes.

- [ ] **Step 1: Créer le template Sobre**
Créer `web/src/lib/pdfgen/templates/SobreTemplate.tsx`. S'inspirer du template HTML d'origine (`lib/resume/templates.ts`) : design minimaliste, nom centré, pas de couleurs vives, bordures simples. Utiliser les primitives de l'étape 1.

- [ ] **Step 2: Ajouter le routage dans ResumeDocument**
```tsx
import { SobreTemplate } from "./templates/SobreTemplate";
// Dans le composant :
if (templateId === "sobre") return <SobreTemplate resume={resume} atsKeywords={atsKeywords} />;
```

- [ ] **Step 3: Vérification visuelle et tests**
Run: `npx vitest run src/lib/pdfgen`
Expected: PASS. Vérifier manuellement dans le navigateur que le template "Sobre" s'affiche sans crash.

- [ ] **Step 4: Commit et Journal**
Commit et maj `REWRITE_PROGRESS.md`.

---

### Task 3: Portage du template Moderne

**Files:**
- Create: `web/src/lib/pdfgen/templates/ModerneTemplate.tsx`
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`

- [ ] **Step 1: Créer le template Moderne**
Reprendre la structure du modèle Moderne : potentiellement une mise en page en 2 colonnes asymétriques, couleurs un peu plus marquées. (On peut s'inspirer des conventions Reactive Resume si le dossier existe, sinon reproduire `templates.ts`).

- [ ] **Step 2: Ajouter le routage**
Ajouter `if (templateId === "moderne") return <ModerneTemplate ... />` dans `ResumeDocument.tsx`.

- [ ] **Step 3: Vérification visuelle et tests**
Run: `npx vitest run src/lib/pdfgen`
Expected: PASS

- [ ] **Step 4: Commit et Journal**
Commit et maj `REWRITE_PROGRESS.md`.

---

### Task 4: Portage du template Classique

**Files:**
- Create: `web/src/lib/pdfgen/templates/ClassiqueTemplate.tsx`
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`

- [ ] **Step 1: Créer le template Classique**
Reprendre le design Classique (serif fonts si possible, mise en page très standardisée, lignes de séparation fines).

- [ ] **Step 2: Ajouter le routage**
Ajouter `if (templateId === "classique") return <ClassiqueTemplate ... />` dans `ResumeDocument.tsx`.

- [ ] **Step 3: Vérification et tests**
Run: `npx vitest run src/lib/pdfgen`
Expected: PASS

- [ ] **Step 4: Commit et Journal**
Commit et maj `REWRITE_PROGRESS.md`.

---

### Task 5: Portage du template Minimal

**Files:**
- Create: `web/src/lib/pdfgen/templates/MinimalTemplate.tsx`
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`
- Modify: `web/src/state/docStore.ts`

- [ ] **Step 1: Créer le template Minimal**
Reprendre le design Minimal (très aéré, polices fines, peu de bordures).

- [ ] **Step 2: Ajouter le routage et forcer le moteur PDF**
Ajouter `if (templateId === "minimal") return <MinimalTemplate ... />` dans `ResumeDocument.tsx`.
Dans `web/src/state/docStore.ts`, modifier `docEngine` pour qu'il retourne `"pdf"` pour **tous les templates**. (Plus de fallback sur `"html"` sauf éventuellement pour un vieux document sans json).

- [ ] **Step 3: Vérification et tests**
Run: `npm run build` et `npx playwright test`
Expected: PASS (Toute la suite d'e2e doit continuer à fonctionner avec le moteur PDF actif partout).

- [ ] **Step 4: Commit et Journal**
Commit: `web: phase 4 terminée — tous les templates portés en React PDF`.
Maj `REWRITE_PROGRESS.md` en marquant la Phase 4 comme cochée [x].

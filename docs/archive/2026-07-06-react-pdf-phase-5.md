# Kakuna Template Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Kakuna template from Reactive Resume into CV Tailor's React PDF engine.

**Architecture:** Create a new React PDF template component (`KakunaTemplate.tsx`) that uses existing primitive components (`TimelineItem`, `Bullets`, `SectionTitle`). The layout will be a single column with a centered header. The template will be registered in `templates.ts`, `ResumeDocument.tsx`, and `docStore.ts`.

**Tech Stack:** React, @react-pdf/renderer, TypeScript, Next.js.

## Global Constraints
- **Une task = un lot.** Traiter les tasks dans l'ordre, avec vérification avant de passer à la suivante.
- **Preuves obligatoires** : coller la sortie intégrale des commandes de vérification.
- **Ne toucher que les fichiers nécessaires**, pas de refactoring voisin ni de features bonus.
- **Jamais de couleurs en dur** : utiliser les variables `defaultTheme` (sauf si adaptation propre au template via `ThemeContext`).
- **Commandes de vérification obligatoires** : `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, `npx playwright test`.
- **Commit local par task autorisé** avec message en français. PUSH INTERDIT.
- **Journal obligatoire** dans `REWRITE_PROGRESS.md` après chaque task.

---

### Task 1: Create KakunaTemplate.tsx

**Files:**
- Create: `web/src/lib/pdfgen/templates/KakunaTemplate.tsx`

**Interfaces:**
- Consumes: `Resume` from `@/lib/resume/schema`, `defaultTheme`, `TimelineItem`, `Bullets`, `SectionTitle`, `SkillText` from `primitives.tsx`.
- Produces: `KakunaTemplate` component rendering a `<Document><Page>...</Page></Document>`.

- [ ] **Step 1: Write the component skeleton**
```tsx
import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume, ExperienceItem, EducationItem, ProjectItem, VolunteerItem } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, defaultTheme, TimelineItem, Bullets, SectionTitle, SkillText } from "./primitives";

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9.5,
    color: defaultTheme.body,
    lineHeight: 1.25,
    paddingTop: px(16),
    paddingBottom: px(12),
    paddingHorizontal: px(36),
  },
  // Add Kakuna specific centered styles
});

export function KakunaTemplate({ resume, atsKeywords }: { resume: Resume; atsKeywords?: string[] }) {
  return (
    <ThemeContext.Provider value={defaultTheme}>
      <Document>
        <Page size="A4" style={s.page}>
           <Text>{resume.name}</Text>
           <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Implement full layout and styling**
Write the actual layout: centered header with photo, name, title, contact flex-wrap. Add vertical sections for Summary, Experience, Education, Skills, Projects, Certifications, Volunteer, Languages, Interests. Ensure SectionTitles are centered with a bottom border.

- [ ] **Step 3: Run verifications**
Run: `npx tsc --noEmit` and `npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**
```bash
git add web/src/lib/pdfgen/templates/KakunaTemplate.tsx
git commit -m "web: création du template Kakuna (skeleton et layout)"
```

---

### Task 2: Register KakunaTemplate in Router and Store

**Files:**
- Modify: `web/src/lib/pdfgen/ResumeDocument.tsx`
- Modify: `web/src/state/docStore.ts`
- Modify: `web/src/lib/resume/templates.ts`
- Modify: `REWRITE_PROGRESS.md`

**Interfaces:**
- Consumes: `KakunaTemplate` component.
- Produces: Updated application state and routing to support "kakuna" as a valid template.

- [ ] **Step 1: Update templates.ts**
Add `"kakuna"` to the `TEMPLATES` record in `web/src/lib/resume/templates.ts` with name `"Kakuna"`.

- [ ] **Step 2: Update ResumeDocument.tsx**
Import `KakunaTemplate` and add `case "kakuna": return <KakunaTemplate resume={resume} atsKeywords={atsKeywords} />;` in the switch statement.

- [ ] **Step 3: Update docStore.ts**
Add `state.template === "kakuna"` to the condition in `docEngine` to use the React PDF engine.

- [ ] **Step 4: Run full verification suite**
Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test
```
Expected: All tests PASS, build succeeds.

- [ ] **Step 5: Update REWRITE_PROGRESS.md**
Add an entry in the Journal section describing the tasks completed. Update the "Prochaine action" if necessary.

- [ ] **Step 6: Commit**
```bash
git add web/src/lib/pdfgen/ResumeDocument.tsx web/src/state/docStore.ts web/src/lib/resume/templates.ts REWRITE_PROGRESS.md
git commit -m "web: intégration Kakuna au routeur et store"
```

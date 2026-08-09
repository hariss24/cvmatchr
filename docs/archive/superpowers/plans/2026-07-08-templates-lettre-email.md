# Templates lettre + email à variables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la génération IA de la lettre de motivation et de l'email d'accompagnement par une bibliothèque de modèles à variables (style Candiboost), avec une IA optionnelle qui adapte le corps de la lettre à une offre, un bouton « Candidater » depuis l'onglet Offres, et le pré-remplissage automatique des champs entreprise/poste (qui alimentent déjà le nom du fichier PDF).

**Architecture:** Un moteur de substitution pur (`{Variable}` + repli `{Variable|repli}`) dans `src/lib/templates/`, une table Dexie `templates` (v4) avec 3 modèles de départ pré-rédigés, une refonte de `PackModal` (choix du modèle → variables remplies → aperçu instantané lettre PDF + email), une route IA légère `/api/adapt-letter` qui remplace `/api/generate-pack`, et une route `/api/extract-meta` qui extrait entreprise/poste d'une offre collée pour préremplir la barre meta (donc le nom du PDF via `buildFilename` existant, `TopBar.tsx:29`).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Zustand, Dexie (IndexedDB), `@react-pdf/renderer`, Vitest.

## Global Constraints

- Guidelines Karpathy (CLAUDE.md racine) : minimum de code, changements chirurgicaux, pas d'abstraction non demandée.
- UI en français ; jamais de couleur en dur dans le CSS (variables de thème de `globals.css` uniquement).
- Jamais `alert/confirm/prompt` natifs → `toast`, `uiAlert`, `uiConfirm` de `@/state/uiStore`.
- Le champ `photo` (base64) n'est **jamais** envoyé à une IA (`{ ...cv, photo: "" }` avant tout appel).
- Ce Next.js a des breaking changes vs les connaissances d'entraînement : lire `web/node_modules/next/dist/docs/` en cas de doute.
- Toutes les commandes se lancent depuis `web/`.
- Vérification avant de déclarer une tâche finie : la commande de test a réellement tourné et sa sortie a été lue.
- À la fin du chantier : consigner l'entrée dans `WORK_HISTORY.md` (racine) — obligation de journal du projet.

## Variables du système (référence pour toutes les tâches)

| Variable (syntaxe dans le texte) | Source de la valeur |
|---|---|
| `{Entreprise}` | Champ Entreprise (docStore `company`, préremplissable) |
| `{Poste}` | Champ Poste (docStore `role`, préremplissable) |
| `{M/Mme Nom}` | Champ Contact saisi dans la modale (ex. « Madame Dupont ») — souvent vide |
| `{Prénom}` | Premier mot de `cv.name` |
| `{Nom}` | Reste de `cv.name` |
| `{Date}` | Date du jour formatée fr-FR |

Syntaxe de repli : `{M/Mme Nom|Madame, Monsieur}` → si la valeur est vide, le repli est utilisé. Sans repli, une valeur vide est supprimée proprement (« Bonjour , » → « Bonjour, »). Une variable inconnue reste telle quelle.

---

### Task 1: Moteur de substitution `renderTemplate`

**Files:**
- Create: `web/src/lib/templates/render.ts`
- Test: `web/src/lib/templates/render.test.ts`

**Interfaces:**
- Consumes: rien (fonction pure).
- Produces: `renderTemplate(text: string, vars: TemplateVars): string`, `type TemplateVars = Record<string, string>`, `const TEMPLATE_VARIABLES: readonly string[]` (les 6 noms de variables). Les tâches 2, 5 et 6 en dépendent.

- [ ] **Step 1: Écrire les tests qui échouent**

```typescript
// web/src/lib/templates/render.test.ts
import { describe, it, expect } from "vitest";
import { renderTemplate, TEMPLATE_VARIABLES } from "./render";

describe("renderTemplate", () => {
  it("remplace les variables connues", () => {
    expect(
      renderTemplate("un poste de {Poste} au sein de {Entreprise}", {
        Poste: "Développeur",
        Entreprise: "ACME",
      }),
    ).toBe("un poste de Développeur au sein de ACME");
  });

  it("utilise le repli quand la valeur est vide", () => {
    expect(renderTemplate("{M/Mme Nom|Madame, Monsieur},", { "M/Mme Nom": "" }))
      .toBe("Madame, Monsieur,");
    expect(renderTemplate("{M/Mme Nom|Madame, Monsieur},", { "M/Mme Nom": "Madame Dupont" }))
      .toBe("Madame Dupont,");
  });

  it("supprime proprement une variable vide sans repli (ponctuation nettoyée)", () => {
    expect(renderTemplate("Bonjour {M/Mme Nom},", { "M/Mme Nom": "" })).toBe("Bonjour,");
  });

  it("laisse intactes les variables inconnues", () => {
    expect(renderTemplate("texte {Inconnu} ici", {})).toBe("texte {Inconnu} ici");
  });

  it("ne casse pas les sauts de ligne lors du nettoyage", () => {
    expect(renderTemplate("ligne 1 {X}\n\nligne 2", { X: "" })).toBe("ligne 1\n\nligne 2");
  });

  it("expose les 6 variables officielles", () => {
    expect(TEMPLATE_VARIABLES).toEqual([
      "Entreprise", "Poste", "M/Mme Nom", "Prénom", "Nom", "Date",
    ]);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run src/lib/templates/render.test.ts`
Expected: FAIL — `Cannot find module './render'` (ou équivalent).

- [ ] **Step 3: Implémenter le moteur**

```typescript
// web/src/lib/templates/render.ts

/**
 * Moteur de substitution des modèles de lettre/email.
 * Syntaxe : `{Variable}` ou `{Variable|repli}` (repli utilisé si la valeur est vide).
 * Une variable absente de `vars` (inconnue) est laissée telle quelle.
 */

export type TemplateVars = Record<string, string>;

/** Les variables proposées dans l'UI (boutons d'insertion). */
export const TEMPLATE_VARIABLES = [
  "Entreprise", "Poste", "M/Mme Nom", "Prénom", "Nom", "Date",
] as const;

const VAR_RE = /\{([^{}|]+)(?:\|([^{}]*))?\}/g;

export function renderTemplate(text: string, vars: TemplateVars): string {
  const out = text.replace(VAR_RE, (match, name: string, fallback?: string) => {
    const value = vars[name];
    if (value === undefined) return match; // variable inconnue : laisser tel quel
    if (value.trim()) return value;
    return fallback ?? "";
  });
  // Nettoyage : espaces (pas les \n) en double, espace avant ponctuation, fins de ligne.
  return out
    .replace(/ {2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/ +$/gm, "");
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run src/lib/templates/render.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates/render.ts src/lib/templates/render.test.ts
git commit -m "feat(templates): moteur de substitution {Variable|repli}"
```

---

### Task 2: Modèles de départ + construction de la Lettre

**Files:**
- Create: `web/src/lib/templates/defaults.ts`
- Create: `web/src/lib/templates/build.ts`
- Test: `web/src/lib/templates/defaults.test.ts`

**Interfaces:**
- Consumes: `renderTemplate`, `TemplateVars` (Task 1) ; types `Letter`, `Resume` de `@/lib/resume/schema`.
- Produces:
  - `interface MailTemplate { id: string; name: string; letterSubject: string; letterGreeting: string; letterBody: string; letterSignoff: string; emailSubject: string; emailBody: string; updatedAt: number }` (exportée depuis `defaults.ts`)
  - `const DEFAULT_TEMPLATES: MailTemplate[]` (3 modèles, ids `default-spontanee`, `default-offre`, `default-alternance`)
  - `buildLetterFromTemplate(tpl: MailTemplate, vars: TemplateVars, cv: Resume, today: string): Letter`
  - `renderEmail(tpl: MailTemplate, vars: TemplateVars): { subject: string; body: string }`
  - Les tâches 3, 5, 6 en dépendent.

- [ ] **Step 1: Écrire les tests qui échouent**

```typescript
// web/src/lib/templates/defaults.test.ts
import { describe, it, expect } from "vitest";
import { DEFAULT_TEMPLATES } from "./defaults";
import { buildLetterFromTemplate, renderEmail } from "./build";
import { DEFAULT_RESUME } from "@/lib/resume/schema";

describe("modèles de départ", () => {
  it("fournit 3 modèles avec des ids stables", () => {
    expect(DEFAULT_TEMPLATES.map((t) => t.id)).toEqual([
      "default-spontanee", "default-offre", "default-alternance",
    ]);
  });

  it("chaque modèle a un repli sur la formule d'appel de la lettre", () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.letterGreeting, t.id).toContain("{M/Mme Nom|Madame, Monsieur}");
    }
  });

  it("chaque email mentionne l'entreprise et le poste", () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.emailBody, t.id).toContain("{Entreprise}");
      expect(t.emailSubject + t.emailBody, t.id).toContain("{Poste}");
    }
  });
});

describe("buildLetterFromTemplate", () => {
  const tpl = DEFAULT_TEMPLATES[0];
  const cv = { ...DEFAULT_RESUME, name: "Hariss Tahet", location: "Paris, France", email: "h@x.fr", phone: "06" };
  const vars = { Entreprise: "ACME", Poste: "Chef de projet", "M/Mme Nom": "", "Prénom": "Hariss", Nom: "Tahet", Date: "8 juillet 2026" };

  it("assemble une Letter complète depuis le CV et les variables", () => {
    const letter = buildLetterFromTemplate(tpl, vars, cv, "8 juillet 2026");
    expect(letter.sender_name).toBe("Hariss Tahet");
    expect(letter.sender_contact).toBe("h@x.fr · 06");
    expect(letter.date).toBe("Paris, le 8 juillet 2026");
    expect(letter.recipient_name).toBe("ACME");
    expect(letter.greeting).toBe("Madame, Monsieur,");
    expect(letter.subject).toContain("Chef de projet");
    expect(letter.body).not.toContain("{Entreprise}");
    expect(letter.signature).toBe("Hariss Tahet");
  });

  it("replis corrects quand entreprise inconnue", () => {
    const letter = buildLetterFromTemplate(tpl, { ...vars, Entreprise: "" }, cv, "8 juillet 2026");
    expect(letter.recipient_name).toBe("À l'attention du responsable du recrutement");
  });
});

describe("renderEmail", () => {
  it("rend objet + corps avec variables substituées", () => {
    const { subject, body } = renderEmail(DEFAULT_TEMPLATES[0], {
      Entreprise: "ACME", Poste: "Dev", "M/Mme Nom": "", "Prénom": "Hariss", Nom: "Tahet", Date: "",
    });
    expect(subject).toContain("Dev");
    expect(body).toContain("ACME");
    expect(body).toContain("Bonjour,");
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run src/lib/templates/defaults.test.ts`
Expected: FAIL — modules `./defaults` / `./build` introuvables.

- [ ] **Step 3: Écrire `defaults.ts` (textes complets des 3 modèles)**

```typescript
// web/src/lib/templates/defaults.ts

/**
 * Modèles de départ de la bibliothèque lettre/email. Textes pré-rédigés en français,
 * paramétrés par les variables de `render.ts`. Les passages entre crochets [ ] sont
 * à personnaliser une fois par l'utilisateur (son parcours, ses atouts).
 */

export interface MailTemplate {
  id: string;
  name: string;
  letterSubject: string;
  letterGreeting: string;
  letterBody: string;
  letterSignoff: string;
  emailSubject: string;
  emailBody: string;
  updatedAt: number;
}

const SIGNOFF =
  "Je serais ravi d'échanger avec vous pour vous présenter plus concrètement mon parcours.\n\n" +
  "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.";

export const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    id: "default-spontanee",
    name: "Candidature spontanée",
    letterSubject: "Candidature spontanée – {Poste}",
    letterGreeting: "{M/Mme Nom|Madame, Monsieur},",
    letterBody:
      "Je me permets de vous adresser ma candidature spontanée pour un poste de {Poste} au sein de {Entreprise}.\n\n" +
      "[Présentez-vous en 2-3 phrases : votre formation, votre expérience, ce qui vous caractérise. " +
      "Exemple : Diplômé d'un Master en gestion de projet, je combine rigueur d'organisation et goût du terrain.]\n\n" +
      "Ce qui m'attire chez {Entreprise}, c'est [dites pourquoi cette entreprise : son secteur, ses valeurs, " +
      "un projet récent]. Je suis convaincu que [votre atout principal] me permettrait de contribuer rapidement " +
      "à vos équipes.",
    letterSignoff: SIGNOFF,
    emailSubject: "Candidature spontanée – {Poste} – {Prénom} {Nom}",
    emailBody:
      "Bonjour {M/Mme Nom},\n\n" +
      "Je me permets de vous adresser ma candidature spontanée pour un poste de {Poste} au sein de {Entreprise}.\n\n" +
      "Vous trouverez en pièce jointe mon CV ainsi que ma lettre de motivation.\n\n" +
      "Je reste à votre disposition pour tout échange, par téléphone ou en entretien.\n\n" +
      "Cordialement,\n{Prénom} {Nom}",
    updatedAt: 0,
  },
  {
    id: "default-offre",
    name: "Réponse à une offre",
    letterSubject: "Candidature au poste de {Poste}",
    letterGreeting: "{M/Mme Nom|Madame, Monsieur},",
    letterBody:
      "Votre offre pour le poste de {Poste} a retenu toute mon attention, et c'est avec un réel intérêt " +
      "que je vous adresse ma candidature.\n\n" +
      "[Reliez votre parcours aux attentes de l'offre : 2-3 phrases sur votre expérience la plus pertinente, " +
      "avec un exemple concret et si possible un résultat chiffré.]\n\n" +
      "Rejoindre {Entreprise} représenterait pour moi l'opportunité de [ce que le poste vous apporterait " +
      "et ce que vous apporteriez en retour]. Ma disponibilité est immédiate et je serais heureux de vous " +
      "en dire davantage lors d'un entretien.",
    letterSignoff: SIGNOFF,
    emailSubject: "Candidature – {Poste} – {Prénom} {Nom}",
    emailBody:
      "Bonjour {M/Mme Nom},\n\n" +
      "Suite à votre offre pour le poste de {Poste}, je vous adresse ma candidature.\n\n" +
      "Vous trouverez en pièce jointe mon CV ainsi que ma lettre de motivation détaillant mon parcours " +
      "et ma motivation pour rejoindre {Entreprise}.\n\n" +
      "Je reste à votre disposition pour un entretien à votre convenance.\n\n" +
      "Cordialement,\n{Prénom} {Nom}",
    updatedAt: 0,
  },
  {
    id: "default-alternance",
    name: "Alternance",
    letterSubject: "Candidature pour une alternance – {Poste}",
    letterGreeting: "{M/Mme Nom|Madame, Monsieur},",
    letterBody:
      "Actuellement en formation [intitulé de votre formation], je recherche une alternance en tant que " +
      "{Poste} à partir de [date de début], au rythme de [rythme d'alternance].\n\n" +
      "[Présentez vos premiers acquis : projets d'études, stages, compétences déjà mobilisables.]\n\n" +
      "Effectuer mon alternance chez {Entreprise} me permettrait de [ce que vous voulez apprendre] tout en " +
      "apportant à vos équipes [ce que vous savez déjà faire]. Motivé et impliqué, je saurai m'investir " +
      "pleinement dans les missions confiées.",
    letterSignoff: SIGNOFF,
    emailSubject: "Candidature alternance – {Poste} – {Prénom} {Nom}",
    emailBody:
      "Bonjour {M/Mme Nom},\n\n" +
      "Actuellement en formation, je recherche une alternance en tant que {Poste} et je me permets de " +
      "candidater auprès de {Entreprise}.\n\n" +
      "Vous trouverez en pièce jointe mon CV ainsi que ma lettre de motivation précisant mon rythme " +
      "d'alternance et mes disponibilités.\n\n" +
      "Je reste à votre disposition pour tout échange.\n\n" +
      "Cordialement,\n{Prénom} {Nom}",
    updatedAt: 0,
  },
];
```

- [ ] **Step 4: Écrire `build.ts`**

```typescript
// web/src/lib/templates/build.ts
import type { Letter, Resume } from "@/lib/resume/schema";
import { renderTemplate, type TemplateVars } from "./render";
import type { MailTemplate } from "./defaults";

/** Assemble la Letter structurée (rendu PDF) depuis un modèle + variables + CV courant. */
export function buildLetterFromTemplate(
  tpl: MailTemplate,
  vars: TemplateVars,
  cv: Resume,
  today: string,
): Letter {
  const city = (cv.location || "").split(",")[0].trim();
  return {
    sender_name: cv.name,
    sender_address: cv.location,
    sender_contact: [cv.email, cv.phone].filter(Boolean).join(" · "),
    date: city ? `${city}, le ${today}` : `Le ${today}`,
    recipient_name: vars["Entreprise"]?.trim() || "À l'attention du responsable du recrutement",
    recipient_service: "Service Recrutement",
    recipient_address: "",
    subject: renderTemplate(tpl.letterSubject, vars),
    greeting: renderTemplate(tpl.letterGreeting, vars),
    body: renderTemplate(tpl.letterBody, vars),
    signoff: renderTemplate(tpl.letterSignoff, vars),
    signature: cv.name,
  };
}

/** Rend l'email (objet + corps) d'un modèle. */
export function renderEmail(tpl: MailTemplate, vars: TemplateVars): { subject: string; body: string } {
  return {
    subject: renderTemplate(tpl.emailSubject, vars),
    body: renderTemplate(tpl.emailBody, vars),
  };
}
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npx vitest run src/lib/templates/`
Expected: PASS (render + defaults + build).

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/
git commit -m "feat(templates): 3 modèles de départ + assemblage Letter/email"
```

---

### Task 3: Table Dexie `templates` (v4) + CRUD

**Files:**
- Modify: `web/src/lib/storage/db.ts`

**Interfaces:**
- Consumes: `MailTemplate`, `DEFAULT_TEMPLATES` (Task 2).
- Produces: `db.templates` (Table<MailTemplate, string>), `listTemplates(): Promise<MailTemplate[]>`, `saveTemplate(tpl: MailTemplate): Promise<void>`, `deleteTemplate(id: string): Promise<void>`, `ensureDefaultTemplates(): Promise<void>`. Les tâches 6 et 7 en dépendent.

Pas de test unitaire Dexie (aucune infra fake-indexeddb dans le projet ; les API jobs/history suivent le même pattern try/catch sans test) — la vérification est manuelle en Task 9.

- [ ] **Step 1: Ajouter la table et le CRUD**

Dans `web/src/lib/storage/db.ts` :

1. Ajouter l'import en tête (après les imports existants) :

```typescript
import { DEFAULT_TEMPLATES, type MailTemplate } from "@/lib/templates/defaults";
```

2. Dans la classe `AppDatabase`, ajouter la propriété après `jobs!` :

```typescript
  templates!: Table<MailTemplate, string>; // Primary key: id
```

3. Dans le constructeur, après le bloc `this.version(3)…`, ajouter :

```typescript
    // v4 : bibliothèque de modèles lettre/email (feature « Pack candidature » sans IA).
    this.version(4).stores({
      templates: "id, updatedAt",
    });
```

4. En fin de fichier, ajouter la section :

```typescript
// ---------------------------------------------------------------------------
// TEMPLATES API (modèles lettre/email)
// ---------------------------------------------------------------------------

/** Seed les modèles de départ si la table est vide (premier lancement). */
export async function ensureDefaultTemplates() {
  try {
    if ((await db.templates.count()) === 0) {
      await db.templates.bulkPut(DEFAULT_TEMPLATES.map((t) => ({ ...t, updatedAt: Date.now() })));
    }
  } catch (e) {
    console.warn("ensureDefaultTemplates error:", e);
  }
}

export async function listTemplates(): Promise<MailTemplate[]> {
  try {
    const all = await db.templates.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn("listTemplates error:", e);
    return [];
  }
}

export async function saveTemplate(tpl: MailTemplate) {
  try {
    await db.templates.put({ ...tpl, updatedAt: Date.now() });
  } catch (e) {
    console.warn("saveTemplate error:", e);
  }
}

export async function deleteTemplate(id: string) {
  try {
    await db.templates.delete(id);
  } catch (e) {
    console.warn("deleteTemplate error:", e);
  }
}
```

- [ ] **Step 2: Vérifier la compilation et la non-régression**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 erreur TypeScript, suite de tests existante PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/db.ts
git commit -m "feat(storage): table templates (Dexie v4) + seed des modèles de départ"
```

---

### Task 4: Prompts + routes `/api/adapt-letter` et `/api/extract-meta`, suppression de `/api/generate-pack`

**Files:**
- Modify: `web/src/lib/ai/prompts.ts` (remplacer `SYSTEM_PACK` par `SYSTEM_ADAPT_LETTER` + `SYSTEM_EXTRACT_META`)
- Modify: `web/src/lib/ai/prompts.test.ts` (retirer les assertions sur `SYSTEM_PACK`, ajouter celles des nouveaux prompts)
- Create: `web/src/app/api/adapt-letter/route.ts` + `route.test.ts`
- Create: `web/src/app/api/extract-meta/route.ts` + `route.test.ts`
- Delete: `web/src/app/api/generate-pack/route.ts` + `route.test.ts`

**Interfaces:**
- Consumes: `complete` (`@/lib/ai/clients`), `parseAiJson` (`@/lib/ai/json`), `aiErrorResponse` (`@/lib/ai/http`) — mêmes briques que la route generate-pack actuelle.
- Produces:
  - `POST /api/adapt-letter` : body `{ letter_body: string, job_desc: string, cv_json?: object, company?: string, role?: string }` → `{ body: string }`.
  - `POST /api/extract-meta` : body `{ job_desc: string }` → `{ company: string, role: string }` (chaînes vides si introuvables).
  - La tâche 6 (PackModal) consomme les deux.

- [ ] **Step 1: Remplacer les prompts**

Dans `web/src/lib/ai/prompts.ts`, remplacer intégralement le bloc `// ---- pack candidature …` + `export const SYSTEM_PACK = …` (lignes ~395-423) par :

```typescript
// ---- adaptation du modèle de lettre à une offre ------------------------------

export const SYSTEM_ADAPT_LETTER =
  "Tu es un expert en candidatures. Tu reçois le CORPS d'une lettre de motivation rédigée par le " +
  "candidat (son modèle personnel), le texte d'une offre d'emploi, et les données JSON de son CV.\n\n" +
  "TA MISSION : adapter LÉGÈREMENT le corps de la lettre à l'offre.\n" +
  "RÈGLES :\n" +
  "- CONSERVE le ton, la structure, le nombre de paragraphes et la longueur (±20 %) du texte d'origine.\n" +
  "- Intègre naturellement 2 à 4 mots-clés ou attentes IMPORTANTS de l'offre.\n" +
  "- Remplace les passages entre crochets [ ] par du contenu concret tiré du CV.\n" +
  "- N'invente AUCUN fait : utilise uniquement les expériences et compétences réellement présentes dans le CV.\n" +
  "- CONSERVE telles quelles les variables {Entreprise}, {Poste}, {M/Mme Nom}, {Prénom}, {Nom}, {Date} " +
  "si le texte en contient — ne les remplace jamais par leur valeur.\n" +
  "- Réponds en français.\n\n" +
  "FORMAT DE RÉPONSE OBLIGATOIRE — JSON PUR, RIEN D'AUTRE :\n" +
  '{"body": "le corps adapté, avec des sauts de ligne \\n entre les paragraphes"}\n\n' +
  "CONTRAINTES :\n" +
  "- JSON PUR : aucune balise markdown, aucun ```json, aucun texte avant ou après le JSON.";

// ---- extraction entreprise/poste d'une offre ---------------------------------

export const SYSTEM_EXTRACT_META =
  "Tu es un extracteur d'informations. Tu reçois le texte d'une offre d'emploi.\n" +
  "Tu renvoies UNIQUEMENT le nom de l'entreprise qui recrute et l'intitulé exact du poste.\n" +
  "RÈGLES :\n" +
  '- Si une information est absente ou incertaine, renvoie une chaîne vide "".\n' +
  "- 'company' = le nom court de l'entreprise (pas le groupe, pas le cabinet de recrutement si " +
  "l'entreprise finale est nommée).\n" +
  "- 'role' = l'intitulé du poste tel qu'écrit dans l'offre, sans le niveau H/F ni la référence.\n\n" +
  "FORMAT DE RÉPONSE OBLIGATOIRE — JSON PUR, RIEN D'AUTRE :\n" +
  '{"company": "...", "role": "..."}\n\n' +
  "CONTRAINTES :\n" +
  "- JSON PUR : aucune balise markdown, aucun ```json, aucun texte avant ou après le JSON.";
```

- [ ] **Step 2: Adapter `prompts.test.ts`**

Dans `web/src/lib/ai/prompts.test.ts` : retirer `SYSTEM_PACK` de l'import et supprimer toute assertion qui l'utilise ; ajouter `SYSTEM_ADAPT_LETTER, SYSTEM_EXTRACT_META` à l'import et ce bloc :

```typescript
describe("prompts — templates lettre/email", () => {
  it("l'adaptation préserve les variables du modèle", () => {
    expect(SYSTEM_ADAPT_LETTER).toContain("{Entreprise}");
    expect(SYSTEM_ADAPT_LETTER).toContain("ne les remplace jamais");
    expect(SYSTEM_ADAPT_LETTER).toContain("N'invente AUCUN fait");
  });

  it("l'extraction meta impose le format JSON company/role", () => {
    expect(SYSTEM_EXTRACT_META).toContain('"company"');
    expect(SYSTEM_EXTRACT_META).toContain('"role"');
  });
});
```

- [ ] **Step 3: Écrire les tests des deux routes (qui échouent)**

```typescript
// web/src/app/api/adapt-letter/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/adapt-letter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockComplete.mockReset());

describe("POST /api/adapt-letter", () => {
  it("renvoie le corps adapté et transmet lettre + offre + CV", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ body: "corps adapté" }));
    const res = await POST(
      req({ letter_body: "mon modèle", job_desc: "offre", cv_json: { name: "x" }, company: "ACME", role: "Dev" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("corps adapté");

    const content = mockComplete.mock.calls[0][0][0].content;
    expect(content).toContain("mon modèle");
    expect(content).toContain("offre");
    expect(content).toContain("Entreprise visée : ACME");
  });

  it("400 si lettre ou offre manquante", async () => {
    const res = await POST(req({ letter_body: "", job_desc: "offre" }));
    expect(res.status).toBe(400);
  });

  it("502 si la réponse IA n'a pas de body", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ autre: 1 }));
    const res = await POST(req({ letter_body: "modèle", job_desc: "offre" }));
    expect(res.status).toBe(502);
  });
});
```

```typescript
// web/src/app/api/extract-meta/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/extract-meta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockComplete.mockReset());

describe("POST /api/extract-meta", () => {
  it("renvoie company/role extraits", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ company: "ACME", role: "Dev" }));
    const res = await POST(req({ job_desc: "offre de dev chez ACME" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ company: "ACME", role: "Dev" });
  });

  it("normalise en chaînes vides les champs absents", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({}));
    const res = await POST(req({ job_desc: "texte" }));
    expect(await res.json()).toEqual({ company: "", role: "" });
  });

  it("400 si offre manquante", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 4: Vérifier qu'ils échouent**

Run: `npx vitest run src/app/api/adapt-letter src/app/api/extract-meta`
Expected: FAIL — modules `./route` introuvables.

- [ ] **Step 5: Implémenter les deux routes**

```typescript
// web/src/app/api/adapt-letter/route.ts
import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_ADAPT_LETTER } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  letter_body?: string;
  job_desc?: string;
  cv_json?: unknown;
  company?: string;
  role?: string;
};

/** Adapte légèrement le corps du modèle de lettre de l'utilisateur à une offre. */
export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const letterBody = (body.letter_body ?? "").trim();
  const jobDesc = (body.job_desc ?? "").trim();
  if (!letterBody || !jobDesc) {
    return NextResponse.json({ error: "Modèle de lettre et offre d'emploi requis." }, { status: 400 });
  }

  let content = `Corps de la lettre (modèle du candidat) :\n${letterBody}`;
  content += `\n\nOffre d'emploi :\n${jobDesc}`;
  content += `\n\nCV (JSON) :\n${JSON.stringify(body.cv_json ?? {})}`;
  if (body.company?.trim()) content += `\n\nEntreprise visée : ${body.company.trim()}`;
  if (body.role?.trim()) content += `\n\nPoste visé : ${body.role.trim()}`;

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete([{ role: "user", content }], SYSTEM_ADAPT_LETTER, userKey);
    const result = parseAiJson(raw) as { body?: unknown };
    const adapted = String(result?.body ?? "").trim();
    if (!adapted) throw new Error("Réponse IA invalide : champ 'body' attendu.");
    return NextResponse.json({ body: adapted });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
```

```typescript
// web/src/app/api/extract-meta/route.ts
import { NextResponse } from "next/server";
import { complete } from "@/lib/ai/clients";
import { SYSTEM_EXTRACT_META } from "@/lib/ai/prompts";
import { parseAiJson } from "@/lib/ai/json";
import { aiErrorResponse } from "@/lib/ai/http";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Extrait { company, role } du texte d'une offre — préremplit la barre meta (nommage PDF). */
export async function POST(req: Request): Promise<Response> {
  let body: { job_desc?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const jobDesc = (body.job_desc ?? "").trim();
  if (!jobDesc) {
    return NextResponse.json({ error: "Offre d'emploi requise." }, { status: 400 });
  }

  const userKey = req.headers.get("x-api-key")?.trim() || null;

  try {
    const raw = await complete(
      [{ role: "user", content: `Offre d'emploi :\n${jobDesc}` }],
      SYSTEM_EXTRACT_META,
      userKey,
    );
    const result = parseAiJson(raw) as { company?: unknown; role?: unknown };
    return NextResponse.json({
      company: String(result?.company ?? "").trim(),
      role: String(result?.role ?? "").trim(),
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
```

- [ ] **Step 6: Supprimer generate-pack**

```bash
git rm -r src/app/api/generate-pack
```

Note : `PackModal.tsx` référence encore `/api/generate-pack` à ce stade — c'est attendu, la refonte arrive en Task 6. La suppression ne casse pas la compilation (l'URL est une chaîne), mais le bouton « Générer le pack » est cassé entre les tâches 4 et 6 : ne pas déployer entre les deux.

- [ ] **Step 7: Vérifier que tout passe**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (nouvelles routes + prompts), 0 erreur TS.

- [ ] **Step 8: Commit**

```bash
git add -A src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts src/app/api/adapt-letter src/app/api/extract-meta
git commit -m "feat(api): adapt-letter + extract-meta remplacent generate-pack"
```

---

### Task 5: Utilitaire client `fetchJobMeta` + docStore `pendingPackOpen`

**Files:**
- Create: `web/src/lib/ai/jobMeta.ts`
- Modify: `web/src/state/docStore.ts`

**Interfaces:**
- Consumes: `postJson` (`@/lib/ai/client`, déjà utilisé par PackModal/TailorModal) ; route `/api/extract-meta` (Task 4).
- Produces:
  - `fetchJobMeta(jobDesc: string): Promise<{ company: string; role: string } | null>` — null en cas d'échec (silencieux : le préremplissage est un confort, jamais bloquant).
  - `docStore.pendingPackOpen: boolean` + `setPendingPackOpen(v: boolean)` — signal « ouvrir le Pack à l'arrivée sur l'éditeur » (Task 7).

- [ ] **Step 1: Créer `jobMeta.ts`**

```typescript
// web/src/lib/ai/jobMeta.ts
import { postJson } from "@/lib/ai/client";

/**
 * Extrait entreprise + poste d'une offre via /api/extract-meta.
 * Échec silencieux (null) : le préremplissage est un confort, il ne doit jamais bloquer.
 */
export async function fetchJobMeta(
  jobDesc: string,
): Promise<{ company: string; role: string } | null> {
  const desc = jobDesc.trim();
  if (!desc) return null;
  try {
    return await postJson<{ company: string; role: string }>("/api/extract-meta", { job_desc: desc });
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Ajouter `pendingPackOpen` au docStore**

Dans `web/src/state/docStore.ts` :

1. Dans le type `Doc`, après `pendingJobDesc: string | null;` :

```typescript
  /** True si l'arrivée sur l'éditeur doit ouvrir directement le Pack candidature (bouton « Candidater » des Offres). */
  pendingPackOpen: boolean;
```

2. Dans `DocStore`, après `setPendingJobDesc` :

```typescript
  setPendingPackOpen: (v: boolean) => void;
```

3. Dans l'état initial, après `pendingJobDesc: null,` :

```typescript
  pendingPackOpen: false,
```

4. Dans les setters, après `setPendingJobDesc` :

```typescript
  setPendingPackOpen: (pendingPackOpen) => set({ pendingPackOpen }),
```

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npx vitest run src/state/docStore.test.ts`
Expected: 0 erreur TS, tests docStore PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/jobMeta.ts src/state/docStore.ts
git commit -m "feat: fetchJobMeta (extract-meta client) + pendingPackOpen dans docStore"
```

---

### Task 6: Refonte de PackModal (modèles + variables + aperçu + IA optionnelle)

**Files:**
- Create: `web/src/components/pack/TemplateEditorPanel.tsx`
- Rewrite: `web/src/components/modals/PackModal.tsx`
- Modify: `web/src/app/globals.css` (styles `.pack-vars`, `.pack-tpl-bar`, `.var-btn`)

**Interfaces:**
- Consumes: Tasks 1-5 — `renderTemplate`/`TEMPLATE_VARIABLES`, `buildLetterFromTemplate`/`renderEmail`, `MailTemplate`, CRUD Dexie (`ensureDefaultTemplates`, `listTemplates`, `saveTemplate`, `deleteTemplate`), `/api/adapt-letter`, `fetchJobMeta`, `generateLetterPdfBlob`, `PdfPreview`, `toast`/`uiConfirm`, `useEscapeClose`.
- Produces: `PackModal({ open, onClose })` — même signature qu'aujourd'hui (aucun changement dans `TailorModal` requis pour cette tâche).

**Comportement cible (spécification UI) :**
- En haut : barre modèle — `<select>` des modèles + boutons mini « 💾 Enregistrer », « Dupliquer », « Supprimer » (suppression refusée par toast s'il ne reste qu'un modèle ; `uiConfirm` avant suppression).
- Variables : 3 inputs — Entreprise, Poste, Contact (« M/Mme Nom », placeholder « Madame Dupont (optionnel) »). Entreprise/Poste initialisés depuis `docStore.company`/`role`.
- Offre (pour l'IA et le préremplissage) : `JobExtractor` + textarea (3 lignes). Au `onBlur` du textarea et après extraction URL : si Entreprise **ou** Poste est vide → `fetchJobMeta(jobDesc)` remplit **uniquement les champs vides** (jamais d'écrasement d'une saisie).
- Édition du modèle : composant `TemplateEditorPanel` — rangée de boutons variables (insère `{Nom de variable}` à la position du curseur du dernier champ focusé) + champs : Objet lettre (input), Formule d'appel (input), Corps lettre (textarea 8 lignes), Formule de politesse (textarea 2 lignes), Objet email (input), Corps email (textarea 6 lignes). Toute frappe modifie l'état local (la bibliothèque n'est touchée qu'au clic « Enregistrer »).
- Aperçu (colonne droite, réutilise `.pack-result`/`.pack-col` existants) : lettre rendue en PDF (`buildLetterFromTemplate` → `generateLetterPdfBlob`, régénéré avec un debounce de 600 ms) + email rendu (objet + corps, readOnly).
- Actions : « ✨ Adapter à l'offre (IA) » (nécessite une offre collée, sinon toast ; appelle `/api/adapt-letter` avec le CV strippé de sa photo, remplace le corps de lettre **local**), « Insérer dans l'éditeur (Lettre) » (comme l'existant : `saveDraft` + `setDocType("Lettre")` + `setJson` + `setCompany`/`setRole`), « 📋 Copier l'email » (copie `Objet : …\n\n…`).
- À l'ouverture : `ensureDefaultTemplates()` puis `listTemplates()` ; modèle sélectionné = le premier.
- `Prénom`/`Nom` : dérivés de `cv.name` (premier mot / reste) ; `Date` : `new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })`.

- [ ] **Step 1: Créer `TemplateEditorPanel.tsx`**

```tsx
// web/src/components/pack/TemplateEditorPanel.tsx
"use client";

import { useRef } from "react";
import { TEMPLATE_VARIABLES } from "@/lib/templates/render";
import type { MailTemplate } from "@/lib/templates/defaults";

/**
 * Panneau d'édition d'un modèle lettre/email : boutons d'insertion de variables
 * + champs texte. L'insertion cible le dernier champ focusé (position du curseur).
 */
export default function TemplateEditorPanel({
  tpl,
  onChange,
  disabled,
}: {
  tpl: MailTemplate;
  onChange: (patch: Partial<MailTemplate>) => void;
  disabled?: boolean;
}) {
  // Dernier champ texte focusé + sa clé dans le modèle (cible de l'insertion de variable).
  const activeRef = useRef<{ el: HTMLInputElement | HTMLTextAreaElement; key: keyof MailTemplate } | null>(null);

  const insertVariable = (name: string) => {
    const active = activeRef.current;
    if (!active) return;
    const { el, key } = active;
    const token = `{${name}}`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    onChange({ [key]: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const track = (key: keyof MailTemplate) =>
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      activeRef.current = { el: e.currentTarget, key };
    };

  return (
    <div className="tpl-editor">
      <div className="tpl-vars" aria-label="Insérer une variable">
        <span className="form-label">Variables :</span>
        {TEMPLATE_VARIABLES.map((v) => (
          <button key={v} type="button" className="var-btn" disabled={disabled} onClick={() => insertVariable(v)}>
            + {v}
          </button>
        ))}
      </div>

      <label className="form-label">Objet de la lettre</label>
      <input className="form-input" value={tpl.letterSubject} disabled={disabled}
        onFocus={track("letterSubject")} onChange={(e) => onChange({ letterSubject: e.target.value })} />

      <label className="form-label">Formule d&apos;appel</label>
      <input className="form-input" value={tpl.letterGreeting} disabled={disabled}
        onFocus={track("letterGreeting")} onChange={(e) => onChange({ letterGreeting: e.target.value })} />

      <label className="form-label">Corps de la lettre</label>
      <textarea className="form-textarea" rows={8} value={tpl.letterBody} disabled={disabled}
        onFocus={track("letterBody")} onChange={(e) => onChange({ letterBody: e.target.value })} />

      <label className="form-label">Formule de politesse</label>
      <textarea className="form-textarea" rows={2} value={tpl.letterSignoff} disabled={disabled}
        onFocus={track("letterSignoff")} onChange={(e) => onChange({ letterSignoff: e.target.value })} />

      <label className="form-label">Objet de l&apos;email</label>
      <input className="form-input" value={tpl.emailSubject} disabled={disabled}
        onFocus={track("emailSubject")} onChange={(e) => onChange({ emailSubject: e.target.value })} />

      <label className="form-label">Corps de l&apos;email</label>
      <textarea className="form-textarea" rows={6} value={tpl.emailBody} disabled={disabled}
        onFocus={track("emailBody")} onChange={(e) => onChange({ emailBody: e.target.value })} />
    </div>
  );
}
```

- [ ] **Step 2: Réécrire `PackModal.tsx`**

```tsx
// web/src/components/modals/PackModal.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import { generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import PdfPreview from "../editor/PdfPreview";
import TemplateEditorPanel from "../pack/TemplateEditorPanel";
import type { Resume } from "@/lib/resume/schema";
import type { MailTemplate } from "@/lib/templates/defaults";
import { buildLetterFromTemplate, renderEmail } from "@/lib/templates/build";
import type { TemplateVars } from "@/lib/templates/render";
import { ensureDefaultTemplates, listTemplates, saveTemplate, deleteTemplate, saveDraft } from "@/lib/storage/db";
import { toast, uiConfirm } from "@/state/uiStore";
import JobExtractor from "./JobExtractor";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Modale « Pack candidature » : lettre + email construits depuis un modèle à variables
 * (bibliothèque locale, zéro IA par défaut). IA optionnelle : « Adapter à l'offre »
 * ajuste le corps de la lettre au texte de l'offre (photo jamais envoyée).
 */
export default function PackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [tpl, setTpl] = useState<MailTemplate | null>(null);
  const [company, setCompanyLocal] = useState(() => useDocStore.getState().company);
  const [role, setRoleLocal] = useState(() => useDocStore.getState().role);
  const [contact, setContact] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Chargement de la bibliothèque à l'ouverture (seed au premier lancement).
  useEffect(() => {
    if (!open) return;
    (async () => {
      await ensureDefaultTemplates();
      const all = await listTemplates();
      setTemplates(all);
      setTpl((cur) => cur ?? all[0] ?? null);
    })();
  }, [open]);

  const cv = useDocStore((s) => s.json) as Resume;
  const isCv = "name" in (cv as object);
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const vars: TemplateVars = useMemo(() => {
    const name = (isCv ? cv.name : "").trim();
    const [prenom, ...rest] = name.split(/\s+/);
    return {
      Entreprise: company.trim(),
      Poste: role.trim(),
      "M/Mme Nom": contact.trim(),
      "Prénom": prenom ?? "",
      Nom: rest.join(" "),
      Date: today,
    };
  }, [company, role, contact, cv, isCv, today]);

  const letter = useMemo(
    () => (tpl && isCv ? buildLetterFromTemplate(tpl, vars, cv, today) : null),
    [tpl, vars, cv, isCv, today],
  );
  const email = useMemo(() => (tpl ? renderEmail(tpl, vars) : null), [tpl, vars]);

  // Aperçu PDF debouncé (600 ms) — régénérer à chaque frappe serait trop lourd.
  useEffect(() => {
    if (!letter) return;
    const t = setTimeout(() => {
      generateLetterPdfBlob(letter, []).then(setPdfBlob).catch(console.error);
    }, 600);
    return () => clearTimeout(t);
  }, [letter]);

  useEscapeClose(open && !busy, onClose);

  if (!open) return null;

  const patchTpl = (patch: Partial<MailTemplate>) => setTpl((t) => (t ? { ...t, ...patch } : t));

  const selectTpl = (id: string) => {
    const found = templates.find((t) => t.id === id);
    if (found) setTpl({ ...found });
  };

  // Préremplissage silencieux depuis l'offre — ne remplit QUE les champs vides.
  const prefillFromJob = async (desc: string) => {
    if (company.trim() && role.trim()) return;
    const meta = await fetchJobMeta(desc);
    if (!meta) return;
    if (!company.trim() && meta.company) setCompanyLocal(meta.company);
    if (!role.trim() && meta.role) setRoleLocal(meta.role);
  };

  const onSaveTpl = async () => {
    if (!tpl) return;
    await saveTemplate(tpl);
    setTemplates(await listTemplates());
    toast("Modèle enregistré.", "success");
  };

  const onDuplicateTpl = async () => {
    if (!tpl) return;
    const copy = { ...tpl, id: crypto.randomUUID(), name: `${tpl.name} (copie)` };
    await saveTemplate(copy);
    setTemplates(await listTemplates());
    setTpl(copy);
    toast("Modèle dupliqué.", "success");
  };

  const onDeleteTpl = async () => {
    if (!tpl) return;
    if (templates.length <= 1) {
      toast("Impossible de supprimer le dernier modèle.", "error");
      return;
    }
    if (!(await uiConfirm(`Supprimer le modèle « ${tpl.name} » ?`, "Supprimer"))) return;
    await deleteTemplate(tpl.id);
    const all = await listTemplates();
    setTemplates(all);
    setTpl(all[0] ? { ...all[0] } : null);
    toast("Modèle supprimé.", "success");
  };

  const adaptWithAi = async () => {
    if (!tpl) return;
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi pour adapter le modèle.", "error");
      return;
    }
    if (!isCv) {
      toast("Charge d'abord un CV dans l'éditeur.", "error");
      return;
    }
    setBusy(true);
    try {
      // Photo jamais envoyée à l'IA.
      const { body } = await postJson<{ body: string }>("/api/adapt-letter", {
        letter_body: tpl.letterBody,
        job_desc: desc,
        cv_json: { ...cv, photo: "" },
        company: company.trim(),
        role: role.trim(),
      });
      patchTpl({ letterBody: body });
      toast("Corps de la lettre adapté à l'offre.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadLetter = async () => {
    if (!letter) return;
    const { setDocType, setJson, setCompany, setRole } = useDocStore.getState();
    await saveDraft({
      id: "draft-Lettre",
      html: "",
      css: "",
      json: letter,
      templateId: null,
      htmlSource: false,
      updatedAt: 0,
    });
    setDocType("Lettre");
    setJson(letter);
    if (company.trim()) setCompany(company.trim());
    if (role.trim()) setRole(role.trim());
    toast("Lettre chargée dans l'éditeur (type « Lettre »).", "success");
    onClose();
  };

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(`Objet : ${email.subject}\n\n${email.body}`);
      toast("Email copié dans le presse-papier.", "success");
    } catch {
      toast("Copie automatique impossible — sélectionne et copie manuellement.", "error");
    }
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog pack-modal pack-modal--result"
        role="dialog"
        aria-modal="true"
        aria-label="Pack candidature"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ui-dialog__title">Pack candidature</h2>

        {/* Barre modèle */}
        <div className="pack-tpl-bar">
          <select
            className="form-input"
            value={tpl?.id ?? ""}
            onChange={(e) => selectTpl(e.target.value)}
            disabled={busy}
            aria-label="Choisir un modèle"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>💾 Enregistrer</button>
          <button type="button" className="form-btn-mini" onClick={onDuplicateTpl} disabled={busy || !tpl}>Dupliquer</button>
          <button type="button" className="form-btn-mini" onClick={onDeleteTpl} disabled={busy || !tpl}>Supprimer</button>
        </div>

        {/* Variables */}
        <div className="pack-vars">
          <input className="form-input" placeholder="Entreprise" value={company}
            onChange={(e) => setCompanyLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Poste visé" value={role}
            onChange={(e) => setRoleLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Contact — ex. Madame Dupont (optionnel)" value={contact}
            onChange={(e) => setContact(e.target.value)} disabled={busy} />
        </div>

        {/* Offre (IA optionnelle + préremplissage) */}
        <JobExtractor onExtracted={(text) => { setJobDesc(text); void prefillFromJob(text); }} disabled={busy} />
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Offre d'emploi (optionnel) — sert au bouton « Adapter à l'offre » et au préremplissage des champs…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          onBlur={() => void prefillFromJob(jobDesc)}
          disabled={busy}
        />

        <div className="pack-result">
          {/* Colonne gauche : édition du modèle */}
          <div className="pack-col">
            {tpl ? <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} /> : null}
            <button type="button" className="go" onClick={adaptWithAi} disabled={busy || !tpl}>
              {busy ? "Adaptation…" : "✨ Adapter à l'offre (IA)"}
            </button>
          </div>

          {/* Colonne droite : aperçus */}
          <div className="pack-col">
            <div className="pack-letter-title">Lettre de motivation</div>
            {pdfBlob ? (
              <PdfPreview blob={pdfBlob} />
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isCv ? "Génération de l'aperçu…" : "Charge d'abord un CV dans l'éditeur."}
              </div>
            )}
            <button type="button" className="go" onClick={loadLetter} disabled={busy || !letter}>
              {"Insérer dans l'éditeur (Lettre)"}
            </button>

            <div className="pack-letter-title">{"Email d'accompagnement"}</div>
            <textarea
              className="form-textarea pack-email"
              readOnly
              value={email ? `Objet : ${email.subject}\n\n${email.body}` : ""}
            />
            <button type="button" className="go" onClick={copyEmail} disabled={busy || !email}>
              {"📋 Copier l'email"}
            </button>
          </div>
        </div>

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter les styles dans `globals.css`**

À la suite des styles `.pack-*` existants (chercher `pack-modal` dans `web/src/app/globals.css`), ajouter — uniquement des variables de thème, pas de couleur en dur :

```css
/* Pack candidature — barre modèle + variables (refonte templates) */
.pack-tpl-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
.pack-tpl-bar select { flex: 1; min-width: 0; }

.pack-vars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
@media (max-width: 700px) {
  .pack-vars { grid-template-columns: 1fr; }
}

.tpl-editor { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }

.tpl-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}
.var-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
}
.var-btn:hover { background: var(--surface-2, var(--bg)); }
```

⚠️ Vérifier que les noms de variables CSS (`--border`, `--surface`, `--text`…) existent dans `globals.css` — sinon reprendre ceux réellement définis en tête de fichier (`:root`). Piège connu Windows/Turbopack : si le CSS ne s'applique pas en dev, purger `web/.next` et relancer.

- [ ] **Step 4: Vérification compilation + tests + lint**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: 0 erreur TS, tests PASS, lint propre.

- [ ] **Step 5: Vérification manuelle dans le navigateur**

Run: `npm run dev` puis ouvrir `http://localhost:3000`, cliquer « Adapter à une offre » → « Créer le Pack candidature ». Vérifier :
1. Les 3 modèles sont dans le select ; changer de modèle change l'aperçu.
2. Taper une entreprise → l'aperçu lettre (après ~1 s) et l'email se mettent à jour ; « Bonjour, » sans contact, « Bonjour Madame Dupont, » avec.
3. Bouton « + Entreprise » insère `{Entreprise}` au curseur dans le champ focusé.
4. « Insérer dans l'éditeur (Lettre) » bascule l'éditeur en Lettre remplie ; le nom de fichier PDF (TopBar) contient l'entreprise.
5. « Copier l'email » copie objet + corps.

Expected: les 5 points OK (captures d'écran ou description du résultat réel).

- [ ] **Step 6: Commit**

```bash
git add src/components/pack/TemplateEditorPanel.tsx src/components/modals/PackModal.tsx src/app/globals.css
git commit -m "feat(pack): refonte Pack candidature en modèles à variables (zéro IA par défaut)"
```

---

### Task 7: Bouton « Candidater » depuis l'onglet Offres

**Files:**
- Modify: `web/src/components/jobs/JobCard.tsx`
- Modify: `web/src/components/jobs/JobsView.tsx`
- Modify: `web/src/components/layout/ActionsBar.tsx`
- Modify: `web/src/components/modals/TailorModal.tsx`

**Interfaces:**
- Consumes: `docStore.pendingPackOpen`/`setPendingPackOpen` (Task 5), mécanisme `pendingJobDesc` existant (`JobsView.adapt`, `ActionsBar`, `TailorModal`).
- Produces: prop `onApply: (job: JobEntry) => void` sur `JobCard`. Flux : Offres → clic « Candidater » → navigation `/` → TailorModal s'ouvre avec le Pack déjà ouvert, offre + entreprise + poste préremplis.

- [ ] **Step 1: Ajouter le bouton à `JobCard.tsx`**

Ajouter `onApply` aux props :

```tsx
export default function JobCard({
  job,
  onAdapt,
  onApply,
  onDismiss,
  onSeen,
}: {
  job: JobEntry;
  onAdapt: (job: JobEntry) => void;
  onApply: (job: JobEntry) => void;
  onDismiss: (job: JobEntry) => void;
  onSeen: (job: JobEntry) => void;
}) {
```

Dans `.job-actions`, après le bouton « Adapter mon CV » :

```tsx
        <button type="button" className="tailor-btn pack-btn-variant" onClick={() => onApply(job)} data-testid="job-apply">
          Candidater
        </button>
```

- [ ] **Step 2: Brancher le handler dans `JobsView.tsx`**

Après la fonction `adapt` existante (`JobsView.tsx:138-145`), ajouter :

```tsx
  /** « Candidater » : ouvre l'éditeur avec le Pack candidature prérempli (offre + meta). */
  async function apply(job: JobEntry) {
    await markJobSeen(job.id);
    setPendingJobDesc(job.jobText);
    if (job.company) setCompany(job.company);
    if (job.title) setRole(job.title);
    useDocStore.getState().setPendingPackOpen(true);
    router.push("/");
  }
```

Et passer la prop au rendu : `<JobCard key={job.id} job={job} onAdapt={adapt} onApply={apply} onDismiss={dismiss} onSeen={seen} />`.

Note : `useDocStore` est déjà importé dans `JobsView.tsx` (hooks en tête de composant) — utiliser `useDocStore.getState().setPendingPackOpen(true)` évite d'ajouter un hook.

- [ ] **Step 3: Ouvrir le Pack à l'arrivée (`ActionsBar` + `TailorModal`)**

`ActionsBar.tsx` : l'init existante ouvre déjà TailorModal quand `pendingJobDesc` est présent (`ActionsBar.tsx:21-23`) — le flux « Candidater » pose `pendingJobDesc`, donc rien à changer ici.

`TailorModal.tsx` : initialiser `packOpen` depuis le flag et le consommer. Remplacer :

```tsx
  const [packOpen, setPackOpen] = useState(false);
```

par :

```tsx
  // « Candidater » depuis l'onglet Offres : le Pack s'ouvre directement par-dessus.
  const [packOpen, setPackOpen] = useState(
    () => typeof window !== "undefined" && useDocStore.getState().pendingPackOpen,
  );
```

et dans le `useEffect` de consommation existant (`TailorModal.tsx:55-57`), ajouter la ligne de reset :

```tsx
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
    if (useDocStore.getState().pendingPackOpen) useDocStore.getState().setPendingPackOpen(false);
  }, []);
```

⚠️ `PackModal` ne lit pas `pendingJobDesc` (il a son propre état `jobDesc` vide à l'ouverture). Pour que l'offre suive jusqu'au Pack, `TailorModal` doit la transmettre : ajouter une prop à `PackModal` :

```tsx
export default function PackModal({ open, onClose, initialJobDesc = "" }: { open: boolean; onClose: () => void; initialJobDesc?: string }) {
  ...
  const [jobDesc, setJobDesc] = useState(initialJobDesc);
```

et dans `TailorModal` : `<PackModal open={packOpen} onClose={() => setPackOpen(false)} initialJobDesc={jobDesc} />` (l'état `jobDesc` de TailorModal est initialisé depuis `pendingJobDesc` — `TailorModal.tsx:44-46`).

- [ ] **Step 4: Vérification compilation + tests**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: 0 erreur, tests PASS, lint propre.

- [ ] **Step 5: Vérification manuelle du flux Offres**

Run: `npm run dev` → onglet Offres (nécessite des offres en base ; sinon vérifier avec une entrée de test en modifiant temporairement rien — si aucune offre disponible, documenter que le test complet attend le prochain scan). Clic « Candidater » → l'éditeur s'ouvre, TailorModal + Pack ouverts, offre collée, Entreprise/Poste remplis, aperçu lettre/email rendus.
Expected: flux complet OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/jobs/ src/components/layout/ActionsBar.tsx src/components/modals/TailorModal.tsx src/components/modals/PackModal.tsx
git commit -m "feat(jobs): bouton Candidater → Pack candidature prérempli"
```

---

### Task 8: Préremplissage meta après adaptation du CV (TailorModal)

**Files:**
- Modify: `web/src/components/modals/TailorModal.tsx`

**Interfaces:**
- Consumes: `fetchJobMeta` (Task 5), `useDocStore` (company/role/setters).
- Produces: après une adaptation de CV réussie, si Entreprise/Poste de la barre meta sont vides, ils sont remplis automatiquement depuis l'offre → le nom du fichier PDF (`buildFilename`, `TopBar.tsx:29`) contient l'entreprise sans saisie manuelle.

- [ ] **Step 1: Ajouter le préremplissage dans `run()`**

Dans `TailorModal.tsx`, ajouter l'import :

```tsx
import { fetchJobMeta } from "@/lib/ai/jobMeta";
```

Dans `run()`, juste après le `toast(master ? … : …, "success")` (`TailorModal.tsx:100-103`), ajouter :

```tsx
      // Préremplissage de la barre meta (nommage PDF/historique) — champs vides uniquement.
      const { company, role, setCompany, setRole } = useDocStore.getState();
      if (!company.trim() || !role.trim()) {
        void fetchJobMeta(desc).then((meta) => {
          if (!meta) return;
          const s = useDocStore.getState();
          if (!s.company.trim() && meta.company) setCompany(meta.company);
          if (!s.role.trim() && meta.role) setRole(meta.role);
        });
      }
```

(Appel non bloquant — `void …then(…)` : l'utilisateur voit son CV adapté immédiatement, la meta arrive une seconde plus tard.)

- [ ] **Step 2: Vérification**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 erreur.

Vérification manuelle : `npm run dev`, coller une offre dans « Adapter à une offre », adapter le CV avec la barre meta vide → les champs Entreprise/Poste de la MetaBar se remplissent seuls, et le nom de fichier PDF affiché dans la TopBar inclut l'entreprise.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/TailorModal.tsx
git commit -m "feat(tailor): préremplissage auto entreprise/poste après adaptation (nommage PDF)"
```

---

### Task 9: Vérification finale + documentation

**Files:**
- Modify: `PROJECT_INDEX.md` (racine — section 7 tableau des routes : retirer `generate-pack`, ajouter `adapt-letter` et `extract-meta` ; section 10 : ajouter `components/pack/`)
- Modify: `WORK_HISTORY.md` (racine — nouvelle entrée de journal)
- Modify: `TODO.md` (racine — cocher/consigner la feature si elle y figure)

**Interfaces:**
- Consumes: l'ensemble des tâches 1-8.
- Produces: chantier vérifié de bout en bout et documenté.

- [ ] **Step 1: Suite de vérification complète**

Run (depuis `web/`):
```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```
Expected: tout PASS, build OK. Lire réellement les sorties.

- [ ] **Step 2: Parcours manuel de recette (les 4 flux)**

`npm run dev`, puis :
1. **Pack sans IA** : ouvrir le Pack, choisir « Réponse à une offre », remplir Entreprise/Poste à la main → aperçus corrects → Insérer dans l'éditeur → exporter le PDF → le fichier est nommé avec l'entreprise.
2. **Préremplissage** : rouvrir le Pack, coller une offre, quitter le champ → Entreprise/Poste se remplissent seuls (si clé IA configurée).
3. **IA optionnelle** : « ✨ Adapter à l'offre (IA) » → le corps de lettre change, ton conservé, variables `{…}` intactes.
4. **Candidater** : onglet Offres → « Candidater » → Pack ouvert prérempli.
5. **Persistance** : modifier un modèle, « 💾 Enregistrer », recharger la page → la modification est conservée ; « Dupliquer » et « Supprimer » fonctionnent ; suppression du dernier modèle refusée.

Expected: les 5 points constatés (noter tout écart).

- [ ] **Step 3: Mettre à jour la documentation**

- `PROJECT_INDEX.md` section 7 : remplacer la ligne `| generate-pack | Génère un pack candidature … |` par :

```markdown
| `adapt-letter` | Adapte le corps du modèle de lettre de l'utilisateur à une offre (IA optionnelle du Pack) |
| `extract-meta` | Extrait entreprise + poste d'une offre (préremplissage barre meta / nommage PDF) |
```

  et compléter la description du Pack (section 7 ou 10) : « Pack candidature : lettre + email construits depuis des modèles à variables (table Dexie `templates`, seed 3 modèles), IA optionnelle. » Mettre à jour la section 5 (Dexie : ajouter `templates`).

- `WORK_HISTORY.md` : nouvelle entrée datée décrivant la refonte (modèles à variables, routes remplacées, bouton Candidater, préremplissage meta).

- [ ] **Step 4: Commit final**

```bash
git add PROJECT_INDEX.md WORK_HISTORY.md TODO.md
git commit -m "docs: refonte Pack candidature en modèles à variables (journal + index)"
```

---

## Self-Review (fait à la rédaction)

- **Couverture spec** : bibliothèque de modèles (T2/T3/T6), repli destinataire (T1/T2), IA remplacée par « Adapter mon modèle » (T4/T6), email 100 % template (T2/T6), Candidater depuis Offres (T7), préremplissage auto + nommage PDF (T4/T5/T6/T8 — `buildFilename` existant consomme `company`/`role`). ✓
- **Placeholders** : aucun TBD/TODO ; textes des 3 modèles rédigés en entier ; code complet dans chaque étape. ✓
- **Cohérence des types** : `MailTemplate` défini en T2, consommé tel quel en T3/T6 ; `TemplateVars` clés françaises identiques partout (« M/Mme Nom » avec majuscules/slash) ; `fetchJobMeta` retourne `| null` géré par tous les appelants. ✓
- **Point d'attention connu** : entre T4 (suppression generate-pack) et T6 (refonte PackModal), le bouton « Générer le pack » est cassé — signalé dans T4, ne pas déployer entre les deux.

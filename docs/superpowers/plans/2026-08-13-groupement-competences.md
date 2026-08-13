# Groupement des compétences par catégorie — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire en sorte qu'un CV importé conserve (ou reçoive) un regroupement de ses
compétences par catégorie, et que le template Marine cesse d'empiler une compétence par
ligne.

**Architecture :** Aucune modification du schéma de données. La catégorie devient le
contenu de la ligne, au format `Catégorie — élément, élément` — format que `SkillText`
sait déjà mettre en gras. Trois leviers indépendants : les prompts d'extraction
(produire le format), les prompts de tailoring (ne pas le casser), et le template Marine
(rendre correctement, y compris pour les CV déjà importés avant ce changement).

**Tech Stack :** Next.js, TypeScript, Zod, @react-pdf/renderer, Vitest.

**Spec :** `docs/superpowers/specs/2026-08-13-groupement-competences-design.md`

## Global Constraints

- Tout le code vit dans `web/`. Toutes les commandes se lancent depuis `web/`.
- Commentaires et messages de commit en français.
- Séparateur de catégorie imposé : ` — ` (tiret cadratin U+2014 **entouré d'un espace de
  chaque côté**). C'est le premier séparateur testé par `SkillText`
  (`src/lib/pdfgen/templates/primitives.tsx:235`).
- Seuil de regroupement piloté par l'IA : **8 éléments**. Une liste de 8 éléments ou moins
  reste plate.
- Seuil de rendu compact : **20 caractères**. Sans rapport avec le seuil de 8.
- `sectionTitles` entre dans la fiche d'**extraction** uniquement. La fiche de
  **tailoring** (`RESUME_SCHEMA_DESC`) ne doit jamais le contenir.
- Aucune modification des templates Sobre, Kakuna et Graphique.
- Aucune migration de données : les CV existants doivent continuer de s'afficher.
- `npm run build` doit passer en plus de `npm test` — Vitest ne fait pas de typecheck.

## Vue d'ensemble des fichiers

| Fichier | Rôle | Tâches |
|---|---|---|
| `src/lib/pdfgen/templates/primitives.tsx` | `shouldRenderCompact` + rendu tags dans `SectionContent` | 1 |
| `src/lib/pdfgen/templates/primitives.test.tsx` | **créé** — tests de `shouldRenderCompact` | 1 |
| `src/lib/pdfgen/ResumeDocument.test.tsx` | caractérisation Sobre, non-régression, rendu Marine | 1, 2, 3 |
| `src/lib/pdfgen/templates/MarineTemplate.tsx` | `SkillText` en sidebar + branchement du compact | 2, 3 |
| `src/lib/ai/prompts.ts` | `EXTRACTION_SCHEMA_DESC`, règle de regroupement, verrouillage tailoring | 4, 5, 6 |
| `src/lib/ai/prompts.test.ts` | garde-fous anti-dérive | 4, 5, 6 |

**Ordre :** 1 → 2 → 3 (rendu, vérifiable seul) puis 4 → 5 → 6 (prompts) puis 7
(vérification bout-en-bout avec appel IA réel).

---

### Task 1: `shouldRenderCompact` et rendu en tags

Une liste dont tous les éléments sont courts (`Git`, `AWS`, `4G`) gaspille une ligne
entière par élément. On la rend en tags repliés sur la largeur. Dès qu'un élément est
long, la lecture en puces reste préférable.

Cette tâche pose la mécanique et la rend disponible via un prop **optionnel**. Aucun
template ne l'active encore : le comportement de l'app est inchangé à la fin de cette
tâche.

**Files:**
- Modify: `src/lib/pdfgen/templates/primitives.tsx`
- Create: `src/lib/pdfgen/templates/primitives.test.tsx`
- Modify: `src/lib/pdfgen/ResumeDocument.test.tsx` (test de caractérisation Sobre)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `shouldRenderCompact(items: string[]): boolean` — exportée depuis `primitives.tsx`.
  - `SectionContent` accepte un prop optionnel `compact?: boolean`. Absent ou `false` =
    comportement actuel, à l'identique.

- [ ] **Step 1: Écrire le test de caractérisation de Sobre AVANT toute modification**

Ce test fige le rendu actuel de Sobre. Il doit être écrit et vert **avant** de toucher à
`primitives.tsx` : c'est ce qui prouvera plus tard qu'on n'a rien cassé chez les
templates non concernés.

Dans `src/lib/pdfgen/ResumeDocument.test.tsx`, ajouter à la fin du fichier :

```tsx
describe("non-régression des templates non concernés par le rendu compact", () => {
  /** 25 compétences courtes : le cas qui déclenchera le mode tags chez Marine. */
  const CV_LISTES_COURTES = resumeSchema.parse({
    name: "Jean Test",
    skills: ["Git", "AWS", "Azure", "Docker", "Linux", "Python", "SQL", "Shell"],
    tools: ["2G", "3G", "4G", "5G", "Jira", "CI/CD", "Ansible", "Grafana"],
  });

  // Sobre, Kakuna et Graphique ont leur propre gestion de largeur : le prop `compact`
  // ne doit JAMAIS leur être passé. Ce test échoue si quelqu'un l'active par mégarde.
  for (const templateId of ["sobre", "kakuna", "graphique"] as const) {
    it(`${templateId} rend toutes les compétences sans changer de mise en page`, async () => {
      const buf = await renderToBuffer(
        <ResumeDocument resume={CV_LISTES_COURTES} templateId={templateId} />,
      );
      const pages = await extractPdfText(new Uint8Array(buf));
      const text = pages.join("\n");

      for (const item of [...CV_LISTES_COURTES.skills, ...CV_LISTES_COURTES.tools]) {
        expect(text, `« ${item} » perdu par ${templateId}`).toContain(item);
      }
      expect(pages).toHaveLength(1);
    });
  }
});
```

- [ ] **Step 2: Lancer ce test pour vérifier qu'il passe DÉJÀ**

```bash
cd web && npx vitest run src/lib/pdfgen/ResumeDocument.test.tsx -t "non-régression"
```

Attendu : **PASS**. C'est un test de caractérisation — il décrit l'existant. S'il échoue
maintenant, ne pas continuer : le problème est ailleurs et doit être compris d'abord.

- [ ] **Step 3: Écrire le test de `shouldRenderCompact` (échouera)**

Créer `src/lib/pdfgen/templates/primitives.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { shouldRenderCompact } from "./primitives";

describe("shouldRenderCompact", () => {
  it("compacte une liste dont tous les éléments sont courts", () => {
    expect(shouldRenderCompact(["Git", "AWS", "Docker", "4G"])).toBe(true);
  });

  it("ne compacte pas dès qu'un seul élément est long", () => {
    expect(
      shouldRenderCompact(["Git", "Configuration des connecteurs d'alerte d'urgence"]),
    ).toBe(false);
  });

  it("ne compacte pas une liste au format « Catégorie — éléments »", () => {
    // Ces lignes sont longues par nature : elles doivent garder une ligne chacune.
    expect(
      shouldRenderCompact([
        "Réseau — TCP/IP, DNS, TLS, firewalls",
        "Cloud — Docker, Kubernetes, AWS",
      ]),
    ).toBe(false);
  });

  it("ne compacte pas une liste d'un seul élément (aucun gain de place)", () => {
    expect(shouldRenderCompact(["Git"])).toBe(false);
  });

  it("ignore les éléments vides pour décider", () => {
    expect(shouldRenderCompact(["Git", "   ", "AWS"])).toBe(true);
  });

  it("ne compacte pas une liste vide", () => {
    expect(shouldRenderCompact([])).toBe(false);
    expect(shouldRenderCompact(["  "])).toBe(false);
  });

  it("accepte un élément pile au seuil de 20 caractères", () => {
    expect("Développement web12".length).toBe(19);
    expect(shouldRenderCompact(["Développement web12", "Git"])).toBe(true);
    expect(shouldRenderCompact(["Développement web123456", "Git"])).toBe(false);
  });
});
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il échoue**

```bash
cd web && npx vitest run src/lib/pdfgen/templates/primitives.test.tsx
```

Attendu : **FAIL**, `shouldRenderCompact is not a function` / erreur d'import.

- [ ] **Step 5: Implémenter `shouldRenderCompact` et les styles**

Dans `src/lib/pdfgen/templates/primitives.tsx`, ajouter après la constante `MUTED`
(ligne 9) :

```tsx
/**
 * Longueur au-delà de laquelle un élément de liste mérite sa propre ligne.
 * Choix de mise en page, sans rapport avec le seuil de regroupement piloté par l'IA.
 */
const COMPACT_MAX_CHARS = 20;

/**
 * Une liste dont TOUS les éléments sont courts (« Git », « AWS », « 4G ») gaspille une
 * ligne entière par élément : on la rend alors en tags repliés sur la largeur. Dès qu'un
 * élément est long, la lecture en puces verticales reste préférable.
 *
 * Sert de filet pour les CV importés AVANT le regroupement par catégorie : eux seuls
 * arrivent encore en dizaines d'éléments atomiques.
 */
export function shouldRenderCompact(items: string[]): boolean {
  const kept = items.filter((i) => t(i));
  return kept.length > 1 && kept.every((i) => i.trim().length <= COMPACT_MAX_CHARS);
}
```

Dans le `StyleSheet.create` du même fichier, ajouter après le bloc `// Listes à puces`
(après `bulletText`, ligne 46) :

```tsx
  // Listes compactes (tags repliés) — cf. shouldRenderCompact
  compactWrap: { flexDirection: "row", flexWrap: "wrap", paddingLeft: px(15) },
  compactItem: { marginRight: px(12), marginBottom: px(2) },
```

- [ ] **Step 6: Lancer le test — il doit passer**

```bash
cd web && npx vitest run src/lib/pdfgen/templates/primitives.test.tsx
```

Attendu : **PASS** (7 tests).

- [ ] **Step 7: Brancher le prop `compact` sur `SectionContent`**

Dans `src/lib/pdfgen/templates/primitives.tsx`, modifier la signature de
`SectionContent` (ligne 133). Ajouter le prop et sa doc :

```tsx
export function SectionContent({
  section,
  hideGutter,
  color,
  subtitle = "bold",
  compact = false,
}: {
  section: ResumeSection;
  hideGutter?: boolean;
  color?: string;
  /** Rendu du sous-titre d'un parcours (entreprise, école, organisation) : gras, ou capitales grisées. */
  subtitle?: "bold" | "caps";
  /**
   * Autorise le rendu en tags repliés pour les listes d'éléments courts (cf.
   * `shouldRenderCompact`). Opt-in : sans ce prop, le rendu est inchangé. Seul Marine
   * l'active — les autres modèles gèrent déjà leur largeur.
   */
  compact?: boolean;
}) {
```

Puis remplacer le `case "list":` (lignes 154-166) par :

```tsx
    case "list":
      if (compact && shouldRenderCompact(section.items)) {
        return (
          <View style={s.compactWrap}>
            {section.items.map((item, i) => (
              <Text key={i} style={[s.compactItem, { color: itemColor }]}>
                {"• "}
                {item}
              </Text>
            ))}
          </View>
        );
      }
      return (
        <View style={s.bullets}>
          {section.items.map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletGlyph, { color: itemColor }]}>•</Text>
              <Text style={[s.bulletText, { color: itemColor }]}>
                <SkillText skill={item} />
              </Text>
            </View>
          ))}
        </View>
      );
```

**Pourquoi la branche compacte n'appelle pas `SkillText` :** elle ne se déclenche que si
tous les éléments font 20 caractères ou moins. Une ligne catégorisée
(`Réseau — TCP/IP, DNS…`) dépasse forcément ce seuil, donc elle passe toujours par la
branche à puces. Les deux modes sont mutuellement exclusifs par construction — ajouter
`SkillText` en mode compact serait du code mort.

- [ ] **Step 8: Vérifier que rien n'a bougé pour les autres templates**

```bash
cd web && npx vitest run src/lib/pdfgen/
```

Attendu : **PASS**, y compris le test de caractérisation Sobre du Step 1. Si celui-ci
échoue, le prop `compact` fuit quelque part — le corriger avant de continuer.

- [ ] **Step 9: Typecheck**

```bash
cd web && npm run build
```

Attendu : build réussi.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/pdfgen/templates/primitives.tsx web/src/lib/pdfgen/templates/primitives.test.tsx web/src/lib/pdfgen/ResumeDocument.test.tsx
git commit -m "feat(pdf): rendu compact optionnel des listes d'éléments courts"
```

---

### Task 2: Marine — la sidebar doit passer par `SkillText`

`MarineTemplate.tsx:189` affiche `{item}` brut. La colonne principale, elle, passe par
`SectionContent` qui utilise `SkillText`. Résultat : une fois le regroupement en place,
`COMPÉTENCES` aurait sa catégorie en gras mais `OUTILS` non.

**Files:**
- Modify: `src/lib/pdfgen/templates/MarineTemplate.tsx:183-194` (`SideList`)
- Modify: `src/lib/pdfgen/ResumeDocument.test.tsx`

**Interfaces:**
- Consumes: `SkillText` depuis `./primitives` (déjà exportée, ligne 234).
- Produces: rien de nouveau.

- [ ] **Step 1: Écrire le test (échouera)**

Dans `src/lib/pdfgen/ResumeDocument.test.tsx`, ajouter :

```tsx
describe("Marine — sidebar au format « Catégorie — éléments »", () => {
  it("conserve l'intégralité du texte d'un outil catégorisé", async () => {
    const cv = resumeSchema.parse({
      name: "Jean Test",
      tools: ["Cloud & DevOps — Docker, Kubernetes, Ansible, AWS, Azure"],
    });
    const buf = await renderToBuffer(<ResumeDocument resume={cv} templateId="marine" />);
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");

    // SkillText scinde la chaîne en deux <Text> : les deux moitiés doivent survivre.
    expect(text).toContain("Cloud & DevOps");
    expect(text).toContain("Docker, Kubernetes, Ansible, AWS, Azure");
  });
});
```

**Limite connue et assumée :** `extractPdfText` ne restitue pas la graisse des
caractères. Ce test garantit qu'aucun texte n'est perdu par la scission ; **le gras se
vérifie à l'œil** en Task 7.

- [ ] **Step 2: Lancer le test**

```bash
cd web && npx vitest run src/lib/pdfgen/ResumeDocument.test.tsx -t "sidebar au format"
```

Attendu : ce test peut **passer dès maintenant** (le texte brut contient déjà tout). Ce
n'est pas un échec du plan : il sert de filet contre une régression lors du Step 3, où
la scission en deux `<Text>` pourrait perdre le séparateur. Noter le résultat et
continuer.

- [ ] **Step 3: Modifier `SideList`**

Dans `src/lib/pdfgen/templates/MarineTemplate.tsx`, l'import ligne 5 devient :

```tsx
import { px, t, ThemeContext, PdfTheme, SectionContent, SkillText } from "./primitives";
```

Puis remplacer le corps de `SideList` (lignes 183-194) :

```tsx
function SideList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={s.sideBulletRow}>
          <Text style={s.sideBulletGlyph}>•</Text>
          <Text style={s.sideBulletText}>
            <SkillText skill={item} />
          </Text>
        </View>
      ))}
    </>
  );
}
```

`SkillText` ne pose que `fontWeight` : la couleur claire de `s.sideBulletText` est
héritée, aucune encre sombre n'est réintroduite sur le fond navy.

- [ ] **Step 4: Lancer les tests**

```bash
cd web && npx vitest run src/lib/pdfgen/
```

Attendu : **PASS**, tous.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/pdfgen/templates/MarineTemplate.tsx web/src/lib/pdfgen/ResumeDocument.test.tsx
git commit -m "fix(pdf): la sidebar Marine ignorait SkillText, pas de gras sur les catégories"
```

---

### Task 3: Marine — activer le rendu compact

Filet pour les CV déjà importés, restés en dizaines d'éléments atomiques. Deux points
d'application distincts, une seule règle partagée.

**Files:**
- Modify: `src/lib/pdfgen/templates/MarineTemplate.tsx` (styles, `SideList`, ligne 308)
- Modify: `src/lib/pdfgen/ResumeDocument.test.tsx`

**Interfaces:**
- Consumes: `shouldRenderCompact` (Task 1), prop `compact` de `SectionContent` (Task 1).
- Produces: rien de nouveau.

- [ ] **Step 1: Écrire le test (échouera)**

Dans `src/lib/pdfgen/ResumeDocument.test.tsx`, ajouter :

```tsx
describe("Marine — listes d'éléments courts", () => {
  /** Le cas réel : un CV importé avant le regroupement, 25 outils atomiques. */
  const CV_25_OUTILS = resumeSchema.parse({
    name: "Jean Test",
    title: "Ingénieur SRE",
    tools: [
      "PyTorch", "Python", "Shell", "SQL", "Git", "Linux", "Jenkins", "Ansible",
      "CI/CD", "Docker", "Kubernetes", "Jira", "Grafana", "Prometheus", "AWS",
      "Azure", "2G", "3G", "4G", "5G", "Huawei", "Ericsson", "Terraform",
      "Vault", "Consul",
    ],
    skills: [
      "Machine Learning", "Data Analysis", "KPI Optimization", "JSON",
      "version control", "network config", "KPI dashboards", "service debugging",
    ],
  });

  it("tient sur une seule page malgré 25 outils et 8 compétences", async () => {
    const buf = await renderToBuffer(
      <ResumeDocument resume={CV_25_OUTILS} templateId="marine" />,
    );
    const pages = await extractPdfText(new Uint8Array(buf));
    expect(pages).toHaveLength(1);
  });

  it("ne perd aucun outil ni aucune compétence en passant en tags", async () => {
    const buf = await renderToBuffer(
      <ResumeDocument resume={CV_25_OUTILS} templateId="marine" />,
    );
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");
    for (const item of [...CV_25_OUTILS.tools, ...CV_25_OUTILS.skills]) {
      expect(text, `« ${item} » perdu`).toContain(item);
    }
  });

  it("ne perd rien quand les compétences sont catégorisées", async () => {
    const cv = resumeSchema.parse({
      name: "Jean Test",
      skills: [
        "Réseau — TCP/IP, HTTP/HTTPS, DNS, TLS, firewalls, tcpdump",
        "Cloud & DevOps — Docker, Kubernetes, Ansible, AWS, Azure, CI/CD",
      ],
    });
    const buf = await renderToBuffer(<ResumeDocument resume={cv} templateId="marine" />);
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");
    expect(text).toContain("TCP/IP, HTTP/HTTPS, DNS, TLS, firewalls, tcpdump");
    expect(text).toContain("Docker, Kubernetes, Ansible, AWS, Azure, CI/CD");
  });
});
```

**Limite connue :** `extractPdfText` restitue le texte, pas la mise en page. Ces tests
prouvent qu'aucun contenu n'est perdu et que la pagination s'améliore — ils **ne peuvent
pas** distinguer visuellement le mode tags du mode puces. C'est `shouldRenderCompact`
(testée unitairement en Task 1) qui porte la garantie du choix de mode ; le rendu se
contrôle à l'œil en Task 7.

- [ ] **Step 2: Lancer le test pour voir lequel échoue**

```bash
cd web && npx vitest run src/lib/pdfgen/ResumeDocument.test.tsx -t "listes d'éléments courts"
```

Attendu : le test « tient sur une seule page » **FAIL** (2 pages). Les deux autres
passent. Si le premier passe déjà, le seuil de déclenchement est mal calibré — le
signaler avant de continuer plutôt que d'ajuster le test.

- [ ] **Step 3: Ajouter les styles compacts de la sidebar**

Dans `src/lib/pdfgen/templates/MarineTemplate.tsx`, dans le `StyleSheet.create`, après
`sideBulletText` (ligne 88) :

```tsx
  sideCompactWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sideCompactItem: {
    fontSize: 9,
    color: SIDEBAR_INK,
    marginRight: px(9),
    marginBottom: px(2),
  },
```

- [ ] **Step 4: Faire consommer la règle par `SideList`**

L'import ligne 5 devient :

```tsx
import { px, t, ThemeContext, PdfTheme, SectionContent, SkillText, shouldRenderCompact } from "./primitives";
```

`SideList` devient (elle intègre le `SkillText` de la Task 2) :

```tsx
function SideList({ items }: { items: string[] }) {
  // Une sidebar de 34 % de large tient très mal 25 puces d'un mot : on replie.
  if (shouldRenderCompact(items)) {
    return (
      <View style={s.sideCompactWrap}>
        {items.map((item, i) => (
          <Text key={i} style={s.sideCompactItem}>
            {"• "}
            {item}
          </Text>
        ))}
      </View>
    );
  }
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={s.sideBulletRow}>
          <Text style={s.sideBulletGlyph}>•</Text>
          <Text style={s.sideBulletText}>
            <SkillText skill={item} />
          </Text>
        </View>
      ))}
    </>
  );
}
```

- [ ] **Step 5: Activer `compact` sur la colonne principale**

Ligne 308, `<SectionContent section={sec} hideGutter subtitle="caps" />` devient :

```tsx
                <SectionContent section={sec} hideGutter subtitle="caps" compact />
```

- [ ] **Step 6: Lancer les tests**

```bash
cd web && npx vitest run src/lib/pdfgen/
```

Attendu : **PASS**, dont les 3 nouveaux tests et la caractérisation Sobre de la Task 1.

- [ ] **Step 7: Typecheck**

```bash
cd web && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/pdfgen/templates/MarineTemplate.tsx web/src/lib/pdfgen/ResumeDocument.test.tsx
git commit -m "fix(pdf): Marine replie les listes d'éléments courts au lieu de les empiler"
```

---

### Task 4: `EXTRACTION_SCHEMA_DESC` — ouvrir `sectionTitles` à l'extraction

Cause racine du doublon `ASSETS` : la fiche envoyée à l'IA ne contient pas
`sectionTitles`, ce qui rend inconciliables les règles « utilise le champ standard » et
« ne renomme jamais une rubrique ». L'IA produit alors les deux sorties.

À l'import, l'intitulé du CV source est du **contenu**. Au tailoring, c'est une
préférence de l'utilisateur — la distinction doit être portée par deux fiches distinctes.

**Files:**
- Modify: `src/lib/ai/prompts.ts:110-129` (découpage), `:565`, `:586`
- Modify: `src/lib/ai/prompts.test.ts:34-51` (garde-fou)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `EXTRACTION_SCHEMA_DESC: string` — exportée depuis `prompts.ts`. Vaut
    `RESUME_SCHEMA_DESC` plus une entrée `"sectionTitles"`.
  - `RESUME_SCHEMA_DESC` conserve exactement sa valeur actuelle.

- [ ] **Step 1: Écrire les tests (échoueront)**

Dans `src/lib/ai/prompts.test.ts`, ajouter l'import de `EXTRACTION_SCHEMA_DESC` en tête
de fichier (à côté de `RESUME_SCHEMA_DESC`, ligne 7), puis ajouter ce bloc :

```ts
describe("fiches de schéma — extraction vs tailoring", () => {
  // `sectionTitles` sépare les deux usages, et cette séparation est la correction d'un
  // bug réel : sans ce champ à l'extraction, l'IA ne pouvait pas à la fois « utiliser le
  // champ standard » et « ne jamais renommer une rubrique ». Elle faisait les deux, et
  // le CV sortait avec une section libre doublonnant un champ déjà rempli.
  it("la fiche d'extraction décrit sectionTitles", () => {
    expect(EXTRACTION_SCHEMA_DESC).toContain('"sectionTitles"');
  });

  it("la fiche de tailoring ne décrit PAS sectionTitles", () => {
    expect(RESUME_SCHEMA_DESC).not.toContain('"sectionTitles"');
  });

  it("la fiche d'extraction est un sur-ensemble de la fiche de tailoring", () => {
    for (const key of RESUME_TOP_KEYS) {
      if (key === "sectionTitles") continue;
      if (!RESUME_SCHEMA_DESC.includes(`"${key}"`)) continue;
      expect(EXTRACTION_SCHEMA_DESC, `champ « ${key} » perdu à l'extraction`).toContain(
        `"${key}"`,
      );
    }
  });

  it("les deux extractions utilisent la fiche étendue, le tailoring non", () => {
    for (const system of [SYSTEM_PDF_TO_RESUME, SYSTEM_TEXT_TO_RESUME]) {
      expect(system).toContain('"sectionTitles"');
    }
    expect(SYSTEM_TAILOR_RESUME_BASE).not.toContain('"sectionTitles"');
  });
});
```

Ajouter `RESUME_TOP_KEYS` (depuis `@/lib/resume/schema`) et `SYSTEM_TAILOR_RESUME_BASE`
aux imports du fichier de test s'ils n'y sont pas déjà.

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

```bash
cd web && npx vitest run src/lib/ai/prompts.test.ts -t "fiches de schéma"
```

Attendu : **FAIL** — `EXTRACTION_SCHEMA_DESC` n'existe pas.

- [ ] **Step 3: Découper `RESUME_SCHEMA_DESC` en corps commun + deux fiches**

Dans `src/lib/ai/prompts.ts`, remplacer intégralement le bloc `RESUME_SCHEMA_DESC`
(lignes 110-129) par :

```ts
/**
 * Corps commun aux deux fiches de schéma. Ne se termine PAS par l'accolade fermante :
 * chaque fiche ajoute ses propres champs puis ferme.
 */
const SCHEMA_BODY_COMMON =
  "{\n" +
  '  "name": "...", "title": "...", "location": "...", "email": "...", ' +
  '"phone": "...", "linkedin": "...",\n' +
  '  "summary": "...",\n' +
  '  "experience": [{"title": "...", "company": "...", "contract": "...", ' +
  '"location": "...", "date": "...", "bullets": ["...", "..."]}],\n' +
  '  "education": [{"title": "...", "school": "...", "location": "...", "date": "..."}],\n' +
  '  "skills": ["...", "..."],\n' +
  '  "softSkills": ["...", "..."],\n' +
  '  "tools": ["...", "..."],\n' +
  '  "languages": [{"name": "...", "level": "..."}],\n' +
  '  "interests": ["...", "..."],\n' +
  '  "projects": [{"title": "...", "date": "...", "description": "..."}],\n' +
  '  "certifications": ["...", "..."],\n' +
  '  "volunteer": [{"title": "...", "organization": "...", "location": "...", ' +
  '"date": "...", "bullets": ["...", "..."]}],\n' +
  '  "customSections": [{"title": "...", "items": ["...", "..."]}],\n' +
  '  "customFields": [{"label": "...", "value": "..."}],\n' +
  '  "sectionOrder": ["...", "..."]';

/** Fiche envoyée à l'IA pour l'ADAPTATION d'un CV à une offre. Sans `sectionTitles` :
 *  les titres personnalisés sont une préférence de l'utilisateur, restaurée par
 *  `mergeTailored`, dont l'IA n'a pas à connaître l'existence. */
export const RESUME_SCHEMA_DESC = SCHEMA_BODY_COMMON + "\n}";

/**
 * Fiche envoyée à l'IA pour l'EXTRACTION d'un CV (PDF ou texte). Elle ajoute
 * `sectionTitles` — et c'est délibérément l'inverse du choix fait pour le tailoring.
 *
 * À l'import, l'intitulé d'une rubrique du CV source est du CONTENU, pas une préférence
 * d'affichage : sans ce champ, l'IA affronte deux règles inconciliables (« utilise le
 * champ standard » / « ne renomme jamais une rubrique ») et produit les deux sorties à
 * la fois — le champ standard ET une section libre qui le doublonne.
 */
export const EXTRACTION_SCHEMA_DESC =
  SCHEMA_BODY_COMMON +
  ",\n" +
  '  "sectionTitles": {"<id de section>": "<intitulé EXACT tel qu\'écrit dans le CV>"}\n' +
  "}";
```

- [ ] **Step 4: Faire consommer la nouvelle fiche par les deux extractions**

Ligne ~565 (`SYSTEM_PDF_TO_RESUME`) et ligne ~586 (`SYSTEM_TEXT_TO_RESUME`) : remplacer
`RESUME_SCHEMA_DESC +` par `EXTRACTION_SCHEMA_DESC +`.

**Ne pas toucher** à la ligne ~245 (`SYSTEM_TAILOR_RESUME_BASE`).

- [ ] **Step 5: Expliquer le champ à l'IA dans les règles d'extraction**

Dans `SECTION_ROUTING_RULES` (`prompts.ts:137`), remplacer le bloc `- INTERDICTION
ABSOLUE : ...` (celui qui se termine par « c'est l'application qui s'adapte au CV.\n »)
par :

```ts
  "- INTERDICTION ABSOLUE : ne supprime, ne renomme et ne déforme JAMAIS une rubrique pour la " +
  "faire entrer de force dans un champ existant. Si elle ne rentre nulle part, crée-la en section " +
  "libre — c'est précisément à ça que sert 'customSections'. Le CV de l'utilisateur n'a pas à se " +
  "plier au format de l'application : c'est l'application qui s'adapte au CV.\n" +
  "- INTITULÉS D'ORIGINE ('sectionTitles') : si une rubrique correspond BIEN à un champ standard " +
  "mais porte un autre intitulé (« Assets » pour les soft skills, « Tech Stack » pour les outils, " +
  "« Parcours » pour les expériences), place le contenu dans le CHAMP STANDARD et l'intitulé EXACT " +
  "dans 'sectionTitles', sous la forme {\"softSkills\": \"Assets\"}. Les identifiants valides sont " +
  "les noms de champs eux-mêmes : summary, experience, education, skills, softSkills, tools, " +
  "languages, interests, projects, certifications, volunteer.\n" +
  "- ZÉRO DOUBLON : n'ajoute JAMAIS dans 'customSections' une rubrique dont le contenu figure " +
  "déjà, même reformulé, dans un champ standard rempli. Un même contenu ne doit apparaître " +
  "qu'UNE seule fois dans tout le JSON.\n" +
  "- LANGUE : recopie les intitulés dans la langue du CV source. Un CV en anglais garde " +
  "des intitulés en anglais.\n" +
```

- [ ] **Step 6: Lancer les tests**

```bash
cd web && npx vitest run src/lib/ai/prompts.test.ts
```

Attendu : **PASS**, dont le garde-fou anti-dérive existant (ligne 34) qui reste vert :
`sectionTitles` demeure exclu de `RESUME_SCHEMA_DESC`.

- [ ] **Step 7: Mettre à jour le commentaire du garde-fou existant**

Dans `src/lib/ai/prompts.test.ts`, l'entrée `"sectionTitles"` de `HORS_FICHE` (ligne ~42)
porte un commentaire devenu partiellement faux. Le remplacer par :

```ts
      "sectionTitles", // titres personnalisés : hors de la fiche de TAILORING seulement
      //                  (préférence d'affichage, restaurée par `mergeTailored`). La fiche
      //                  d'EXTRACTION le décrit, elle — cf. « fiches de schéma » plus bas :
      //                  à l'import, l'intitulé du CV source est du contenu.
```

- [ ] **Step 8: Relancer les tests et typechecker**

```bash
cd web && npx vitest run src/lib/ai/ && npm run build
```

Attendu : **PASS** + build réussi.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/ai/prompts.ts web/src/lib/ai/prompts.test.ts
git commit -m "fix(ai): ouvrir sectionTitles à l'extraction pour supprimer les sections doublons"
```

---

### Task 5: Règle de regroupement des compétences à l'extraction

**Files:**
- Modify: `src/lib/ai/prompts.ts` — `SECTION_ROUTING_RULES` (ligne 137)
- Modify: `src/lib/ai/prompts.test.ts`

**Interfaces:**
- Consumes: `SECTION_ROUTING_RULES` tel que modifié en Task 4.
- Produces: rien de nouveau (contenu de prompt uniquement).

- [ ] **Step 1: Écrire le test (échouera)**

Dans `src/lib/ai/prompts.test.ts`, ajouter :

```ts
describe("regroupement des compétences par catégorie", () => {
  // Le CV source range ses compétences par famille (« Networking : TCP/IP, DNS… »).
  // Les listes plates du schéma ne peuvent porter ce regroupement qu'en convention
  // d'écriture : « Catégorie — a, b, c ». Le séparateur DOIT être le tiret cadratin
  // entouré d'espaces, seul format reconnu par `SkillText` côté PDF.
  it("les extractions imposent le format « Catégorie — éléments »", () => {
    for (const system of [SYSTEM_PDF_TO_RESUME, SYSTEM_TEXT_TO_RESUME]) {
      expect(system).toContain("'Catégorie — élément, élément, élément'");
      // Le seuil sous lequel on laisse la liste plate. Assertion sur la phrase entière :
      // un simple toContain("8") passerait sur n'importe quel autre chiffre du prompt.
      expect(system).toContain("8 ÉLÉMENTS OU MOINS");
      expect(system).toContain("dépasse 8 éléments");
    }
  });

  it("le regroupement ne remplace pas le cloisonnement des trois listes", () => {
    for (const system of [SYSTEM_PDF_TO_RESUME, SYSTEM_TEXT_TO_RESUME]) {
      expect(system).toContain("ne fusionne JAMAIS");
    }
  });
});
```

- [ ] **Step 2: Lancer le test**

```bash
cd web && npx vitest run src/lib/ai/prompts.test.ts -t "regroupement"
```

Attendu : **FAIL** sur `toContain("Catégorie — ")`.

- [ ] **Step 3: Ajouter la règle**

Dans `SECTION_ROUTING_RULES`, juste après le paragraphe de répartition (après la ligne
`"dans la liste qui lui correspond selon sa nature.\n\n"`), insérer :

```ts
  "REGROUPEMENT PAR CATÉGORIE — dans chacune des trois listes, séparément :\n" +
  "- Format d'un élément groupé : 'Catégorie — élément, élément, élément'. Le séparateur est " +
  "un tiret cadratin ENTOURÉ D'UN ESPACE de chaque côté (' — '), jamais un deux-points ni un " +
  "tiret simple.\n" +
  "- SI LE CV GROUPE DÉJÀ ses compétences (« Systèmes : Linux, systemd… », « Networking : " +
  "TCP/IP, DNS… »), REPRENDS ses catégories À L'IDENTIQUE, sans les traduire, sans les " +
  "renommer, sans en fusionner deux.\n" +
  "- SI LE CV NE GROUPE PAS et que la liste dépasse 8 éléments, REGROUPE-LES toi-même en 3 à 6 " +
  "familles cohérentes que tu nommes. N'invente aucune compétence : tu ne fais que ranger " +
  "celles qui sont écrites.\n" +
  "- SI LA LISTE COMPTE 8 ÉLÉMENTS OU MOINS et que le CV ne la groupe pas, laisse-la PLATE : " +
  "une catégorie par élément n'apporte rien.\n" +
  "- Une catégorie tient sur UNE entrée de la liste. Ne crée jamais une entrée par élément " +
  "d'une catégorie : c'est ce qui fait déborder le CV sur une seconde page.\n" +
  "- Les catégories que tu nommes suivent la LANGUE DU CV : un CV en anglais reçoit des " +
  "catégories en anglais.\n\n" +
```

- [ ] **Step 4: Lancer les tests**

```bash
cd web && npx vitest run src/lib/ai/prompts.test.ts
```

Attendu : **PASS**, tous.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/ai/prompts.ts web/src/lib/ai/prompts.test.ts
git commit -m "feat(ai): regrouper les compétences par catégorie à l'extraction"
```

---

### Task 6: Verrouiller le format au tailoring

Sans cette tâche, adapter un CV à une offre détruirait le regroupement obtenu à l'import.
La règle actuelle (`format 'Mot clé — Description'`) est ambiguë : elle laisse penser
qu'une compétence est un couple terme/définition, pas une famille et ses membres.

**Files:**
- Modify: `src/lib/ai/prompts.ts` — `RESUME_TAILOR_RULES.adapte` (ligne ~193) et
  `.hyper` (ligne ~203)
- Modify: `src/lib/ai/prompts.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: rien de nouveau.

- [ ] **Step 1: Écrire le test (échouera)**

Dans `src/lib/ai/prompts.test.ts` :

```ts
describe("le tailoring préserve le regroupement par catégorie", () => {
  it("interdit d'éclater une catégorie aux niveaux adapte et hyper", () => {
    for (const level of ["adapte", "hyper"] as const) {
      expect(RESUME_TAILOR_RULES[level]).toContain("regroupement");
      expect(RESUME_TAILOR_RULES[level]).not.toContain("Mot clé — Description");
    }
  });

  it("le niveau subtil continue de ne toucher à rien", () => {
    expect(RESUME_TAILOR_RULES.peu).toContain("IDENTIQUES");
  });
});
```

Ajouter `RESUME_TAILOR_RULES` aux imports du fichier de test s'il n'y est pas.

- [ ] **Step 2: Lancer le test**

```bash
cd web && npx vitest run src/lib/ai/prompts.test.ts -t "préserve le regroupement"
```

Attendu : **FAIL**.

- [ ] **Step 3: Remplacer la règle dans les deux niveaux**

Dans `RESUME_TAILOR_RULES`, la ligne suivante apparaît **deux fois** — une fois dans
`adapte`, une fois dans `hyper` :

```ts
    "- COMPÉTENCES : chaque élément de 'skills' respecte le format 'Mot clé — Description'.\n" +
```

Remplacer **les deux occurrences** par :

```ts
    "- COMPÉTENCES : si les entrées de 'skills', 'softSkills' ou 'tools' sont groupées au " +
    "format 'Catégorie — élément, élément', CONSERVE ce regroupement. Tu peux réordonner les " +
    "catégories entre elles, et réordonner les éléments à l'intérieur d'une catégorie, pour " +
    "faire remonter ce qui sert l'offre. Tu ne dois JAMAIS éclater une catégorie en plusieurs " +
    "entrées, ni fusionner deux catégories, ni changer le séparateur ' — '.\n" +
```

- [ ] **Step 4: Lancer les tests**

```bash
cd web && npx vitest run src/lib/ai/
```

Attendu : **PASS**.

- [ ] **Step 5: Suite complète et typecheck**

```bash
cd web && npm test && npm run build && npm run lint
```

Attendu : tests verts, build réussi, lint sans nouvelle erreur (4 warnings préexistants
tolérés).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/ai/prompts.ts web/src/lib/ai/prompts.test.ts
git commit -m "fix(ai): le tailoring ne doit plus éclater les catégories de compétences"
```

---

### Task 7: Vérification bout-en-bout avec appel IA réel

Les tâches 4 à 6 modifient des prompts. Aucun test automatisé ne peut prouver qu'un LLM
les respecte : cette tâche est **manuelle et obligatoire**. Ne pas déclarer le travail
terminé sans l'avoir faite.

**Files:** aucun (vérification).

**Interfaces:**
- Consumes: toutes les tâches précédentes.
- Produces: un compte rendu à coller dans `WORK_HISTORY.md`.

- [ ] **Step 1: Lancer l'app**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Importer le CV source**

Importer `CV_2026-07-26_Khan_Yasin.pdf` (fourni par l'utilisateur, hors dépôt) via le
bouton d'import PDF du formulaire. Une clé Gemini est obligatoire pour cette route
(garde images, cf. `src/app/api/pdf-to-resume/route.ts:27`).

- [ ] **Step 3: Vérifier les données importées**

Dans le formulaire, contrôler et **noter le résultat** :

| Contrôle | Attendu |
|---|---|
| `skills` | ≤ 10 lignes, chacune contenant ` — ` |
| `tools` | ≤ 10 lignes, chacune contenant ` — ` |
| `softSkills` | 3 éléments, restés plats (sous le seuil de 8) |
| Sections libres | **aucune** section `Assets` doublonnant les soft skills |
| Intitulé de section | la rubrique des soft skills s'affiche « Assets » |
| Intitulés généraux | en anglais, pas « PROFIL » / « FORMATIONS » sur un CV anglais |

- [ ] **Step 4: Générer le PDF en template Marine**

Contrôler visuellement :

- le document tient sur **une seule page** ;
- en colonne principale, la catégorie est **en gras** avant le tiret ;
- en sidebar, la catégorie est **en gras** aussi (c'est le correctif de la Task 2, que
  les tests ne peuvent pas vérifier) ;
- aucun bloc de puces d'un seul mot empilées verticalement.

- [ ] **Step 5: Vérifier le filet des CV déjà importés**

Éditer à la main un CV en remettant 20 outils atomiques courts (`Git`, `AWS`, `4G`…),
régénérer en Marine : ils doivent se replier sur la largeur, pas s'empiler.

- [ ] **Step 6: Vérifier le tailoring**

Adapter le CV importé à `web/tests/fixtures/job_sharkninja.txt` au niveau **hyper**.
Contrôler que les catégories survivent : mêmes intitulés, format ` — ` intact, aucune
catégorie éclatée en entrées séparées.

- [ ] **Step 7: Consigner le résultat**

Ajouter une entrée au Journal de `WORK_HISTORY.md` : ce qui a été vérifié, ce qui a
fonctionné, et **tout écart constaté** (notamment si l'IA ignore le seuil de 8 ou le
séparateur). Un écart n'invalide pas le plan — il indique une règle de prompt à durcir,
à traiter dans une itération séparée.

- [ ] **Step 8: Commit du compte rendu**

```bash
git add WORK_HISTORY.md
git commit -m "docs: compte rendu de vérification du groupement des compétences"
```

---

## Ce que ce plan ne fait pas

- Aucun changement de `resumeSchema` — la conversion vers un champ structuré
  (`{category, items}`) reste possible plus tard sans perte.
- Aucune modification de Sobre, Kakuna, Graphique — protégée par le test de
  caractérisation de la Task 1.
- Aucune migration des CV existants — la Task 3 est leur filet.
- Le placement de `COMPÉTENCES` en bas de la colonne principale relève de `sectionOrder`,
  hors périmètre.

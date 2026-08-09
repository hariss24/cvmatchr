# Drag & drop des éléments dans les sections du formulaire — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes
> sont en cases à cocher (`- [ ]`).

**Spec :** `docs/archive/superpowers/specs/2026-07-14-drag-drop-items-formulaire-design.md`

**But :** permettre de réordonner par glisser-déposer les éléments **à l'intérieur** des sections du
formulaire CV (expériences, formations, compétences, langues…), ce qui n'est aujourd'hui possible
que pour les sections entre elles.

**Architecture :** un seul fichier nouveau, `web/src/components/form/Sortable.tsx`, contient toute
la mécanique dnd-kit et l'expose sous deux composants (`SortableList`, `DragHandle`) plus un hook
(`useSortableItem`). `FormEditor.tsx` ne connaît que ces trois exports : il ne voit jamais dnd-kit.
Le réordonnancement repart par le `onChange` déjà existant de chaque section, donc l'aperçu PDF et
l'Annuler/Rétablir fonctionnent sans une ligne de plus.

**Pile technique :** Next 16, React 19, TypeScript, Vitest (unitaire), Playwright (e2e), CSS
neumorphique maison dans `web/src/app/globals.css`.

## Contraintes globales

- **Répertoire de travail : `web/`.** Toutes les commandes s'y lancent.
- Versions imposées : `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`,
  `@dnd-kit/modifiers@^9.0.0`, `@dnd-kit/utilities@^3.2.2`. **Ne pas** installer `@dnd-kit/react`
  (v2, encore en 0.x).
- **Aucun champ `id` n'est ajouté au schéma du CV** (`web/src/lib/resume/schema.ts`). L'identité des
  éléments est leur indice, décalé de 1 (voir Tâche 1) — dnd-kit traite l'identifiant `0` comme
  absent, un identifiant `0` casserait silencieusement le glissement du premier élément.
- **Ne pas toucher** au bloc « Ordre des sections » (`SectionOrderSection`) : il garde ses flèches
  ↑/↓. Ni aux puces « Réalisations » (`BulletsEditor`), qui restent une zone de texte.
- Guidelines Karpathy : changements chirurgicaux, pas de nettoyage du code adjacent, pas
  d'abstraction non demandée.
- Interface en français, accents compris. Les identifiants de code restent en anglais.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `web/src/components/form/Sortable.tsx` | **Créé.** Toute la mécanique dnd-kit : contexte de tri, capteurs, poignée. Le seul fichier qui importe dnd-kit. |
| `web/src/components/form/FormEditor.tsx` | **Modifié.** `ItemCard` gagne une poignée ; nouveau `RowCard` ; les 12 listes sont entourées d'un `SortableList`. |
| `web/src/app/globals.css` | **Modifié.** Styles de la poignée et de la gouttière ; `.form-item` passe en deux colonnes. |
| `web/tests/e2e/form-reorder.spec.ts` | **Créé.** Test clavier (expériences) et test souris (compétences). |
| `web/package.json` | **Modifié.** Les 4 paquets dnd-kit. |

---

## Tâche 1 : la mécanique de tri + les 5 sections en cartes

Les cinq sections en cartes (Expériences, Formations, Projets, Bénévolat, Sections libres) passent
toutes par le composant `ItemCard`. Le modifier une fois les couvre toutes les cinq.

**Fichiers :**
- Créer : `web/src/components/form/Sortable.tsx`
- Créer : `web/tests/e2e/form-reorder.spec.ts`
- Modifier : `web/src/components/form/FormEditor.tsx` (`ItemCard` l.197-211 ; les 5 sections)
- Modifier : `web/src/app/globals.css` (`.form-item` l.701-706)
- Modifier : `web/package.json`

**Interfaces produites** (la tâche 2 s'appuie dessus) :
- `SortableList({ count: number; onMove: (from: number, to: number) => void; children: React.ReactNode })`
- `useSortableItem(index: number)` → `{ ref, style, handleProps, isDragging }`
- `DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>)`
- `moveItem<T>(list: T[], from: number, to: number): T[]` (ré-export de `arrayMove`)

---

- [ ] **Étape 1 : installer les dépendances**

```bash
cd web
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/modifiers@^9.0.0 @dnd-kit/utilities@^3.2.2
```

Attendu : installation sans erreur de pair de dépendances (React 19 est couvert, le pair déclaré est
`react: >=16.8.0`).

---

- [ ] **Étape 2 : écrire le test e2e clavier — il doit échouer**

Créer `web/tests/e2e/form-reorder.spec.ts` :

```ts
import { test, expect, type Page } from "@playwright/test";

/**
 * Réordonnancement des éléments À L'INTÉRIEUR d'une section (drag & drop, dnd-kit).
 * Le chemin clavier est le plus fiable à automatiser ; le chemin souris exige des
 * déplacements de pointeur intermédiaires (dnd-kit ignore un saut instantané).
 */

type StoreWindow = {
  useDocStore: {
    getState: () => {
      json: Record<string, unknown>;
      setJson: (json: Record<string, unknown>) => void;
    };
  };
};

/** Remplace les listes du CV par un contenu déterministe. */
async function seed(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((p) => {
    const store = (window as unknown as StoreWindow).useDocStore.getState();
    store.setJson({ ...store.json, ...p });
  }, patch);
}

/** Lit une liste du CV dans le store après l'action. */
async function readList(page: Page, key: string) {
  return page.evaluate((k) => {
    const store = (window as unknown as StoreWindow).useDocStore.getState();
    return store.json[k];
  }, key);
}

/**
 * Cible une section par son titre exact. `:has(h3:text-is(...))` est indispensable :
 * un simple `hasText` attraperait aussi le bloc « Ordre des sections », qui liste les
 * mêmes intitulés.
 */
function section(page: Page, title: string) {
  return page.locator(`.form-section:has(h3:text-is("${title}"))`);
}

test("clavier : une expérience remonte d'un cran", async ({ page }) => {
  await page.goto("/");
  await seed(page, {
    experience: [
      { title: "Alpha", company: "A", contract: "", location: "", date: "", bullets: [] },
      { title: "Beta", company: "B", contract: "", location: "", date: "", bullets: [] },
    ],
  });

  const cards = section(page, "Expériences").locator(".form-item");
  await expect(cards).toHaveCount(2);

  // Saisir la 2e carte, la monter, déposer.
  await cards.nth(1).locator(".drag-handle").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");

  const experience = (await readList(page, "experience")) as { title: string }[];
  expect(experience.map((e) => e.title)).toEqual(["Beta", "Alpha"]);
});
```

---

- [ ] **Étape 3 : lancer le test, vérifier qu'il échoue**

```bash
cd web
npx playwright test tests/e2e/form-reorder.spec.ts --reporter=list
```

Attendu : ÉCHEC. Le locator `.drag-handle` ne trouve rien (`expected 2, received 0` sur
`.form-item` n'arrivera pas — les cartes existent ; c'est le `.focus()` sur `.drag-handle` qui
expire).

---

- [ ] **Étape 4 : créer `web/src/components/form/Sortable.tsx`**

```tsx
"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Glisser-déposer des éléments d'une liste du formulaire. SEUL fichier qui connaît dnd-kit :
 * les sections de `FormEditor` ne voient que `SortableList`, `useSortableItem` et `DragHandle`.
 * Le jour où l'on change de bibliothèque, c'est ce fichier — et lui seul — qu'on réécrit.
 *
 * IDENTITÉ DES ÉLÉMENTS : les listes du CV n'ont pas d'identifiant (une compétence est une simple
 * chaîne, et deux éléments peuvent être identiques). On utilise donc l'indice, DÉCALÉ DE 1 :
 * dnd-kit traite l'identifiant `0` comme absent. C'est correct parce que l'ensemble des indices ne
 * change jamais pendant un glissement — seul l'ordre du tableau change, après la dépose.
 */

/** Déplace un élément d'une liste. Ré-export : la logique vient de dnd-kit, rien de maison. */
export { arrayMove as moveItem };

export function SortableList({
  count,
  onMove,
  children,
}: {
  count: number;
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    // Une distance minimale évite qu'un simple clic dans un champ déclenche un glissement.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = Array.from({ length: count }, (_, i) => i + 1);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onMove(Number(active.id) - 1, Number(over.id) - 1);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Props à poser sur l'élément déplaçable ; `handleProps` va sur la poignée, pas sur la carte. */
export function useSortableItem(index: number) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: index + 1,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };
  return { ref: setNodeRef, style, handleProps: { ...attributes, ...listeners }, isDragging };
}

/**
 * La poignée. Seul point de saisie : le reste de la carte laisse la page défiler au doigt
 * (c'est `touch-action: none`, posé sur `.drag-handle` en CSS, qui rend le glissement tactile
 * possible ici et seulement ici).
 */
export function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label="Déplacer l'élément"
      title="Glisser pour déplacer"
      {...props}
    >
      <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="3" r="1.3" />
        <circle cx="7" cy="3" r="1.3" />
        <circle cx="3" cy="8" r="1.3" />
        <circle cx="7" cy="8" r="1.3" />
        <circle cx="3" cy="13" r="1.3" />
        <circle cx="7" cy="13" r="1.3" />
      </svg>
    </button>
  );
}
```

---

- [ ] **Étape 5 : donner une poignée à `ItemCard`**

Dans `web/src/components/form/FormEditor.tsx`, ajouter l'import en tête de fichier (sous l'import de
`buildSections`) :

```tsx
import { SortableList, DragHandle, useSortableItem, moveItem } from "./Sortable";
```

Puis remplacer `ItemCard` (l.196-211) par :

```tsx
/** Carte d'un élément de liste : poignée à gauche, contenu, bouton de suppression. */
function ItemCard({
  index,
  onRemove,
  children,
}: {
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { ref, style, handleProps } = useSortableItem(index);
  return (
    <div ref={ref} style={style} className="form-item">
      <div className="form-item__gutter">
        <DragHandle {...handleProps} />
      </div>
      <div className="form-item__body">
        <button
          type="button"
          className="form-btn-mini form-item__remove"
          aria-label="Supprimer l'élément"
          onClick={onRemove}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
```

---

- [ ] **Étape 6 : brancher les 5 sections en cartes**

Toujours dans `FormEditor.tsx`. Dans **chacune** des cinq sections, entourer la liste d'un
`SortableList` et passer `index={i}` à `ItemCard`. Le reste du contenu de chaque carte ne bouge pas.

`ExperienceSection` (l.463-474) :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((e, i) => (
          <ItemCard key={i} index={i} onRemove={() => onChange(removeAt(items, i))}>
            <div className="form-grid">
              <Field label="Poste" value={e.title} onChange={(v) => patch(i, { title: v })} />
              <Field label="Entreprise" value={e.company} onChange={(v) => patch(i, { company: v })} />
              <Field label="Contrat" value={e.contract} onChange={(v) => patch(i, { contract: v })} />
              <Field label="Lieu" value={e.location} onChange={(v) => patch(i, { location: v })} />
              <Field label="Date" value={e.date} onChange={(v) => patch(i, { date: v })} />
            </div>
            <BulletsEditor bullets={e.bullets} onChange={(b) => patch(i, { bullets: b })} />
          </ItemCard>
        ))}
      </SortableList>
```

`EducationSection` (l.494-503) :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((e, i) => (
          <ItemCard key={i} index={i} onRemove={() => onChange(removeAt(items, i))}>
            <div className="form-grid">
              <Field label="Diplôme" value={e.title} onChange={(v) => patch(i, { title: v })} />
              <Field label="Établissement" value={e.school} onChange={(v) => patch(i, { school: v })} />
              <Field label="Lieu" value={e.location} onChange={(v) => patch(i, { location: v })} />
              <Field label="Date" value={e.date} onChange={(v) => patch(i, { date: v })} />
            </div>
          </ItemCard>
        ))}
      </SortableList>
```

`ProjectsSection` (l.566-582) :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((p, i) => (
          <ItemCard key={i} index={i} onRemove={() => onChange(removeAt(items, i))}>
            <div className="form-grid">
              <Field label="Titre" value={p.title} onChange={(v) => patch(i, { title: v })} />
              <Field label="Date" value={p.date} onChange={(v) => patch(i, { date: v })} />
            </div>
            <div className="form-field">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={p.description}
                onChange={(e) => patch(i, { description: e.target.value })}
              />
            </div>
          </ItemCard>
        ))}
      </SortableList>
```

`CustomSectionsSection` (l.607-633) :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((c, i) => (
          <ItemCard key={i} index={i} onRemove={() => onChange(removeAt(items, i))}>
            <Field
              label="Titre de la section"
              value={c.title}
              onChange={(v) => patch(i, { title: v })}
            />
            <div className="form-field">
              <label className="form-label">Contenu</label>
              <textarea
                className="form-textarea form-bullets"
                rows={4}
                placeholder="Une ligne par élément."
                value={c.items.join("\n")}
                onChange={(e) => patch(i, { items: e.target.value.split("\n") })}
                onBlur={(e) =>
                  patch(i, {
                    items: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter((l) => l !== ""),
                  })
                }
              />
            </div>
          </ItemCard>
        ))}
      </SortableList>
```

`VolunteerSection` (l.657-666) :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((v, i) => (
          <ItemCard key={i} index={i} onRemove={() => onChange(removeAt(items, i))}>
            <div className="form-grid">
              <Field label="Rôle" value={v.title} onChange={(val) => patch(i, { title: val })} />
              <Field label="Organisation" value={v.organization} onChange={(val) => patch(i, { organization: val })} />
              <Field label="Lieu" value={v.location} onChange={(val) => patch(i, { location: val })} />
              <Field label="Date" value={v.date} onChange={(val) => patch(i, { date: val })} />
            </div>
            <BulletsEditor bullets={v.bullets} onChange={(b) => patch(i, { bullets: b })} />
          </ItemCard>
        ))}
      </SortableList>
```

---

- [ ] **Étape 7 : styler la gouttière et la poignée**

Dans `web/src/app/globals.css`, remplacer le bloc `.form-item` / `.form-item__remove` (l.701-706) :

```css
/* Carte d'un élément de liste : gouttière de saisie à gauche, contenu à droite. */
.form-item {
  display: flex; gap: 8px; align-items: stretch;
  padding: 12px; border-radius: 12px; background: var(--bg);
  box-shadow: var(--neu-inset); margin-bottom: 4px;
}
.form-item__gutter { display: flex; align-items: flex-start; }
.form-item__body {
  position: relative; flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 10px; padding-top: 28px;
}
.form-item__remove { position: absolute; top: 0; right: 0; z-index: 1; }

/* Poignée de glisser-déposer. `touch-action: none` est ce qui rend le glissement possible au
   doigt ICI et nulle part ailleurs : le reste de la carte continue de faire défiler la page. */
.drag-handle {
  background: var(--bg); color: var(--muted); border: none; border-radius: 8px;
  padding: 8px 5px; cursor: grab; box-shadow: var(--neu-raised-sm);
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0; touch-action: none; transition: box-shadow 120ms, color 120ms;
}
.drag-handle:hover { color: var(--orange-text); box-shadow: var(--neu-raised); }
.drag-handle:active { cursor: grabbing; box-shadow: var(--neu-inset); }
.drag-handle:focus-visible {
  outline: none; box-shadow: var(--neu-inset), 0 0 0 2px rgba(232,93,4,0.25);
}
.drag-handle svg { width: 10px; height: 16px; }
```

Puis, dans la requête média mobile qui commence l.1201 (`@media (max-width: 900px)`), à côté de
`.form-btn-mini { padding: 12px; min-height: 44px; }`, ajouter :

```css
  .drag-handle { min-height: 44px; min-width: 32px; }
```

---

- [ ] **Étape 8 : lancer le test clavier, vérifier qu'il passe**

```bash
cd web
npx playwright test tests/e2e/form-reorder.spec.ts --reporter=list
```

Attendu : `1 passed`.

Si le test échoue sur le `Space` : vérifier que `handleProps` (qui contient `attributes` ET
`listeners`) est bien posé sur le `<button class="drag-handle">` et pas sur la carte — le capteur
clavier n'écoute que l'élément activateur.

---

- [ ] **Étape 9 : commit**

```bash
cd web
git add package.json package-lock.json src/components/form/Sortable.tsx src/components/form/FormEditor.tsx src/app/globals.css tests/e2e/form-reorder.spec.ts
git commit -m "$(cat <<'EOF'
feat(form): glisser-déposer des éléments dans les sections en cartes

Expériences, formations, projets, bénévolat, sections libres : une poignée
en gouttière gauche remplace l'absence de réordonnancement. Toute la
mécanique dnd-kit est isolée dans Sortable.tsx.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Tâche 2 : les listes en ligne

Compétences, soft skills, outils, certifications et centres d'intérêt passent tous par
`StringListSection` : une seule modification les couvre. Restent `LanguagesSection` et
`CustomFieldsSection`, deux composants distincts.

**Fichiers :**
- Modifier : `web/src/components/form/FormEditor.tsx` (`StringListSection` l.215-251,
  `CustomFieldsSection` l.297-345, `LanguagesSection` l.511-552)
- Modifier : `web/tests/e2e/form-reorder.spec.ts` (ajouter le test souris)

**Interfaces consommées :** `SortableList`, `useSortableItem`, `DragHandle`, `moveItem` — définis en
Tâche 1, déjà importés en tête de `FormEditor.tsx`.

---

- [ ] **Étape 1 : écrire le test e2e souris — il doit échouer**

Ajouter à la fin de `web/tests/e2e/form-reorder.spec.ts` (les fonctions `seed`, `readList` et
`section` sont déjà définies en haut du fichier par la Tâche 1) :

```ts
test("souris : une compétence remonte d'un cran", async ({ page }) => {
  await page.goto("/");
  await seed(page, { skills: ["Python", "TypeScript"] });

  const rows = section(page, "Compétences").locator(".form-row");
  await expect(rows).toHaveCount(2);

  const from = await rows.nth(1).locator(".drag-handle").boundingBox();
  const to = await rows.nth(0).locator(".drag-handle").boundingBox();
  if (!from || !to) throw new Error("poignée introuvable");

  // dnd-kit ignore un saut instantané : il faut des déplacements intermédiaires, et un premier
  // mouvement supérieur à la distance d'activation (4 px).
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 4, { steps: 10 });
  await page.mouse.up();

  expect(await readList(page, "skills")).toEqual(["TypeScript", "Python"]);
});
```

---

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
cd web
npx playwright test tests/e2e/form-reorder.spec.ts --reporter=list
```

Attendu : le test clavier passe, le test souris ÉCHOUE (`poignée introuvable` — les lignes de
compétences n'ont pas encore de `.drag-handle`).

---

- [ ] **Étape 3 : créer `RowCard`**

Dans `web/src/components/form/FormEditor.tsx`, juste après `ItemCard` (donc après la l.211 d'origine,
modifiée en Tâche 1), ajouter :

```tsx
/** Ligne d'un élément simple : poignée, contenu, bouton de suppression. Pendant d'`ItemCard`. */
function RowCard({
  index,
  onRemove,
  removeLabel,
  children,
}: {
  index: number;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  const { ref, style, handleProps } = useSortableItem(index);
  return (
    <div ref={ref} style={style} className="form-row">
      <DragHandle {...handleProps} />
      {children}
      <button type="button" className="form-btn-mini" aria-label={removeLabel} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
```

---

- [ ] **Étape 4 : brancher `StringListSection` (couvre 5 sections)**

Remplacer le corps de `StringListSection` (l.226-250) par :

```tsx
  return (
    <section className="form-section">
      <h3 className="form-section__title">{title}</h3>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((value, i) => (
          <RowCard
            key={i}
            index={i}
            removeLabel="Supprimer"
            onRemove={() => onChange(removeAt(items, i))}
          >
            <input
              className="form-input"
              value={value}
              onChange={(e) => onChange(replaceAt(items, i, e.target.value))}
            />
          </RowCard>
        ))}
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </section>
  );
```

---

- [ ] **Étape 5 : brancher `LanguagesSection`**

Remplacer la liste de `LanguagesSection` (l.523-546) par :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((l, i) => (
          <RowCard
            key={i}
            index={i}
            removeLabel="Supprimer la langue"
            onRemove={() => onChange(removeAt(items, i))}
          >
            <input
              className="form-input"
              placeholder="Langue"
              value={l.name}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <input
              className="form-input"
              placeholder="Niveau"
              value={l.level}
              onChange={(e) => patch(i, { level: e.target.value })}
            />
          </RowCard>
        ))}
      </SortableList>
```

---

- [ ] **Étape 6 : brancher `CustomFieldsSection`**

Remplacer la liste de `CustomFieldsSection` (l.312-335) par :

```tsx
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((f, i) => (
          <RowCard
            key={i}
            index={i}
            removeLabel="Supprimer l'information"
            onRemove={() => onChange(removeAt(items, i))}
          >
            <input
              className="form-input"
              placeholder="Intitulé (ex : Permis)"
              value={f.label}
              onChange={(e) => patch(i, { label: e.target.value })}
            />
            <input
              className="form-input"
              placeholder="Valeur (ex : B, véhiculé)"
              value={f.value}
              onChange={(e) => patch(i, { value: e.target.value })}
            />
          </RowCard>
        ))}
      </SortableList>
```

---

- [ ] **Étape 7 : lancer les deux tests, vérifier qu'ils passent**

```bash
cd web
npx playwright test tests/e2e/form-reorder.spec.ts --reporter=list
```

Attendu : `2 passed`.

Si le test souris échoue alors que le clavier passe : augmenter le nombre d'étapes du dernier
`page.mouse.move` (dnd-kit a besoin de plusieurs événements de pointeur pour calculer la
collision), ou viser le centre de la ligne cible plutôt que celui de sa poignée.

---

- [ ] **Étape 8 : commit**

```bash
cd web
git add src/components/form/FormEditor.tsx tests/e2e/form-reorder.spec.ts
git commit -m "$(cat <<'EOF'
feat(form): glisser-déposer des listes en ligne

Compétences, soft skills, outils, certifications, centres d'intérêt, langues
et informations complémentaires : nouveau RowCard, pendant d'ItemCard.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Tâche 3 : vérification complète et documentation

**Fichiers :**
- Modifier : `TODO.md` (racine du dépôt, l.58-61)
- Modifier : `WORK_HISTORY.md` (racine du dépôt)

---

- [ ] **Étape 1 : suite unitaire**

```bash
cd web
npm test
```

Attendu : aucune régression. Aucun test unitaire n'a été ajouté — le déplacement lui-même est
`arrayMove`, déjà testé en amont par dnd-kit ; le comportement propre au projet est couvert par les
deux tests e2e.

---

- [ ] **Étape 2 : lint**

```bash
cd web
npm run lint
```

Attendu : aucune erreur.

---

- [ ] **Étape 3 : build de production**

```bash
cd web
npm run build
```

Attendu : compilation réussie. Un échec ici signalerait un souci de composant serveur/client :
`Sortable.tsx` porte `"use client"` en tête, il ne doit pas en manquer.

---

- [ ] **Étape 4 : suite e2e complète (non-régression)**

```bash
cd web
npx playwright test --reporter=list
```

Attendu : tous les tests passent. Attention particulière à `mobile.spec.ts` et `import-pdf.spec.ts`,
qui touchent le formulaire.

---

- [ ] **Étape 5 : contrôle manuel**

`npm run dev`, puis sur http://localhost:3000 :

1. Glisser la 2ᵉ expérience au-dessus de la 1ʳᵉ → l'aperçu PDF se réordonne.
2. `Ctrl+Z` → l'ordre initial revient.
3. Réduire la fenêtre à ~400 px de large (ou émulation mobile des outils de développement) : le
   glissement au doigt fonctionne depuis la poignée, et le défilement de la page reste possible en
   posant le doigt ailleurs sur la carte.

Rendre compte de ce qui a été observé, pas de ce qui était attendu.

---

- [ ] **Étape 6 : mettre à jour le TODO**

Dans `TODO.md`, supprimer l'entrée « Déplacement haut/bas DANS les sections du formulaire » de la
section « 🔵 Priorité haute — à faire » (l.58-61) et l'ajouter sous « ✅ Fait », rubrique « CV &
import », sous cette forme :

```markdown
- [x] **Réordonner les éléments à l'intérieur d'une section** — glisser-déposer (dnd-kit) sur les
      12 listes du formulaire : expériences, formations, projets, bénévolat, sections libres,
      compétences, soft skills, outils, certifications, centres d'intérêt, langues, infos
      complémentaires. Poignée en gouttière gauche, pilotable au clavier. Le bloc « Ordre des
      sections », lui, garde ses flèches ↑/↓.
```

Mettre à jour la date en pied de fichier : `*Dernière mise à jour : 14 juillet 2026*`.

---

- [ ] **Étape 7 : journaliser dans `WORK_HISTORY.md`**

Ajouter une entrée en tête du Journal, en suivant le format des entrées existantes du fichier :
ce qui a été fait, pourquoi, et les décisions assumées (drag & drop directement plutôt que des
flèches jetables ; identité par indice décalé de 1 ; « Ordre des sections » laissé aux flèches).

---

- [ ] **Étape 8 : commit**

```bash
git add TODO.md WORK_HISTORY.md
git commit -m "$(cat <<'EOF'
docs: TODO et journal — drag & drop des éléments du formulaire

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

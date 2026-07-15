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
  // `goto` se résout au `load`, avant que le script (async) qui attache le store au
  // window ait forcément fini de s'exécuter — on l'attend explicitement.
  await page.waitForFunction(() => !!(window as unknown as StoreWindow).useDocStore);
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

  // dnd-kit ne mesure les zones cibles qu'une frame APRÈS la saisie : un ArrowUp envoyé trop
  // tôt ne trouve aucune cible et le curseur reste sur la carte elle-même. Plutôt qu'un délai
  // fixe, on s'appuie sur deux signaux que dnd-kit publie lui-même :
  //  - `opacity: 0.4` (posé par `useSortableItem`, Sortable.tsx) confirme la carte saisie ;
  //  - la région d'annonce accessibilité (`DndLiveRegion-*`, rendue dans le DndContext de la
  //    section) nomme la zone survolée. « area 1 » = la carte du haut, l'état `over` que lira la
  //    dépose. On répète ArrowUp jusqu'à ce que ce survol soit confirmé : déterministe sur le
  //    résultat, et sans effet une fois la carte en haut.
  const liveRegion = section(page, "Expériences").locator('[id^="DndLiveRegion"]');
  await cards.nth(1).locator(".drag-handle").focus();
  await page.keyboard.press("Space");
  await expect(cards.nth(1)).toHaveCSS("opacity", "0.4");
  await expect(async () => {
    await page.keyboard.press("ArrowUp");
    await expect(liveRegion).toContainText("droppable area 1");
  }).toPass({ timeout: 5000 });
  await page.keyboard.press("Space");

  const experience = (await readList(page, "experience")) as { title: string }[];
  expect(experience.map((e) => e.title)).toEqual(["Beta", "Alpha"]);
});

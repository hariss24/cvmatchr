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

  // Saisir la 2e carte, la monter, déposer. dnd-kit mesure les positions sur une frame
  // d'animation après l'activation : sans un court délai entre les touches, l'ArrowUp
  // arrive avant que la mesure soit prête et ne produit aucun déplacement.
  await cards.nth(1).locator(".drag-handle").focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");

  const experience = (await readList(page, "experience")) as { title: string }[];
  expect(experience.map((e) => e.title)).toEqual(["Beta", "Alpha"]);
});

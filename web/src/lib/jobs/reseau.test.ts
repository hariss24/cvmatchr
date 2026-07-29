import { describe, it, expect, vi, afterEach } from "vitest";
import { parVagues, fetchDelai, PARALLELE } from "./reseau";

afterEach(() => vi.unstubAllGlobals());

describe("parVagues", () => {
  it("ne mène jamais plus de PARALLELE travaux de front", async () => {
    let vol = 0;
    let pic = 0;
    await parVagues([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], async (n) => {
      pic = Math.max(pic, ++vol);
      await new Promise((r) => setTimeout(r, 5));
      vol--;
      return n;
    });
    expect(pic).toBe(PARALLELE);
  });

  // L'ordre des réponses ne doit pas décider quelle offre est retenue au
  // dédoublonnage : le premier mot-clé garde la priorité, même s'il répond en dernier.
  it("rend les résultats dans l'ordre des éléments, pas des réponses", async () => {
    const out = await parVagues([30, 10, 20], async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it("ne fait rien sur une liste vide", async () => {
    const travail = vi.fn();
    expect(await parVagues([], travail)).toEqual([]);
    expect(travail).not.toHaveBeenCalled();
  });
});

describe("fetchDelai", () => {
  it("abandonne une requête restée en suspens", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_, rejeter) => init.signal.addEventListener("abort", () => rejeter(new Error("abort")))),
    ));

    const promesse = fetchDelai("https://exemple.fr");
    const verdict = expect(promesse).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_000);
    await verdict;
    vi.useRealTimers();
  });

  it("laisse passer une réponse normale", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    expect((await fetchDelai("https://exemple.fr")).ok).toBe(true);
  });
});

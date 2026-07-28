import { describe, it, expect } from "vitest";
import { GET } from "./route";

function req(q: string) {
  return new Request(`http://x/api/jobs/metiers?q=${encodeURIComponent(q)}`);
}

describe("GET /api/jobs/metiers", () => {
  it("retourne [] si q trop court", async () => {
    const res = await GET(req("a"));
    expect((await res.json()).results).toEqual([]);
  });

  it("trouve une appellation ROME (insensible casse/accents) avec son code", async () => {
    const res = await GET(req("referenceur"));
    const { results } = await res.json();
    expect(results.length).toBeGreaterThan(0);
    expect(results).toContainEqual({ label: "Référenceur / Référenceuse SEO", rome: "E1405" });
    // Code ROME au bon format.
    for (const r of results) expect(r.rome).toMatch(/^[A-Z]\d{4}$/);
  });

  it("limite à 10 résultats et priorise les débuts d'intitulé", async () => {
    const res = await GET(req("dev"));
    const { results } = await res.json();
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it("gère les requêtes multi-mots malgré la forme « Masculin / Féminin »", async () => {
    // « Chargé / Chargée de communication digitale » : les mots ne sont pas contigus.
    const res = await GET(req("chargé de communication"));
    const labels = (await res.json()).results.map((r: { label: string }) => r.label);
    expect(labels).toContain("Chargé / Chargée de communication digitale");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { searchAdzuna } from "./adzuna";
import { parseProfile } from "./profileSchema";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";

afterEach(() => vi.unstubAllGlobals());

const creds = { appId: "id", appKey: "key" };

function stub(results: unknown[]) {
  const m = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ results }) }));
  vi.stubGlobal("fetch", m);
  return m;
}

describe("searchAdzuna", () => {
  it("normalise une offre", async () => {
    stub([{
      id: "42", title: "Webmaster", description: "Une description",
      company: { display_name: "ACME" },
      location: { display_name: "Paris, Ile-de-France" },
      redirect_url: "https://www.adzuna.fr/details/42",
      created: "2026-07-20T12:34:41Z",
      salary_min: 33000, salary_max: 36000,
      contract_type: "permanent", contract_time: "full_time",
    }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    const { offers, calls } = await searchAdzuna(p, creds);
    expect(calls).toBe(1);
    expect(offers[0]).toMatchObject({
      id: "adzuna-42", source: "adzuna", title: "Webmaster", company: "ACME",
      location: "Paris, Ile-de-France", boardDomain: "www.adzuna.fr",
      boardName: "Adzuna", contractLabel: "CDI · Plein temps",
      salaryLabel: "33–36 k€ / an", logoUrl: "",
    });
  });

  it("n'envoie aucun filtre de contrat quand CDI et CDD sont cochés", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: ["x"], contractTypes: ["CDI", "CDD"] });
    await searchAdzuna(p, creds);
    expect(String(m.mock.calls[0][0])).not.toContain("permanent=");
  });

  it("envoie permanent=1 quand CDI est le seul type coché", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: ["x"], contractTypes: ["CDI"] });
    await searchAdzuna(p, creds);
    expect(String(m.mock.calls[0][0])).toContain("permanent=1");
  });

  it("passe le lieu en clair et le rayon pour une commune", async () => {
    const m = stub([]);
    const p = parseProfile({
      ...hariss, keywords: ["x"],
      location: { kind: "commune", code: "75056", label: "Paris (75001)", radiusKm: 20 },
    });
    await searchAdzuna(p, creds);
    const url = String(m.mock.calls[0][0]);
    expect(url).toContain("where=Paris");   // le code postal entre parenthèses est retiré
    expect(url).toContain("distance=20");
  });

  it("écarte les stages/alternances via excludedWords", async () => {
    stub([{ id: "1", title: "Webmaster en alternance", description: "" }]);
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchAdzuna(p, creds)).offers).toHaveLength(0);
  });

  it("renvoie [] sans jeter si l'API échoue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchAdzuna(p, creds)).offers).toEqual([]);
  });

  it("renvoie 0 offre et 0 appel sans mot-clé", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: [] });
    expect(await searchAdzuna(p, creds)).toEqual({ offers: [], calls: 0 });
    expect(m).not.toHaveBeenCalled();
  });
});

describe("adzuna — coordonnées", () => {
  it("reporte latitude et longitude quand elles sont présentes", async () => {
    const brut = {
      id: "12",
      title: "Webmaster",
      description: "Mission.",
      redirect_url: "https://ex.fr/12",
      company: { display_name: "ACME" },
      location: { display_name: "Paris" },
      latitude: 48.86,
      longitude: 2.35,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [brut] }),
    }) as unknown as typeof fetch;

    const { offers } = await searchAdzuna(
      parseProfile({ ...hariss, keywords: ["webmaster"] }),
      { appId: "a", appKey: "b" },
    );
    expect(offers[0].lat).toBe(48.86);
    expect(offers[0].lng).toBe(2.35);
  });

  it("laisse les coordonnées absentes sur les 12 % d'offres sans GPS", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: "13", title: "X", redirect_url: "https://ex.fr/13" }],
      }),
    }) as unknown as typeof fetch;

    const { offers } = await searchAdzuna(
      parseProfile({ ...hariss, keywords: ["x"] }),
      { appId: "a", appKey: "b" },
    );
    expect(offers[0].lat).toBeUndefined();
    expect(offers[0].lng).toBeUndefined();
  });
});

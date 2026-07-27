import { describe, it, expect, vi, afterEach } from "vitest";
import { searchJSearch, datePosted } from "./jsearch";
import { parseProfile } from "./profileSchema";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";

afterEach(() => vi.unstubAllGlobals());

const creds = { apiKey: "ak_test" };

function stub(jobs: unknown[]) {
  const m = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { jobs } }) }));
  vi.stubGlobal("fetch", m);
  return m;
}

describe("datePosted", () => {
  it("prend le plus grand palier ne dépassant pas maxAgeDays", () => {
    expect(datePosted(30)).toBe("month");
    expect(datePosted(7)).toBe("week");
    expect(datePosted(5)).toBe("3days");
    expect(datePosted(3)).toBe("3days");
    expect(datePosted(1)).toBe("today");
  });
});

describe("searchJSearch", () => {
  it("normalise une offre avec logo et jobboard réel", async () => {
    stub([{
      job_id: "abc", job_title: "Webmaster F/H",
      employer_name: "Médecins sans Frontières France",
      employer_logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:X&s=0",
      job_location: "Paris", job_description: "Une description",
      job_employment_type: "À plein temps",
      job_publisher: "Jobs That Make Sense",
      job_apply_link: "https://jobs.makesense.org/fr/jobs/msf",
      job_posted_at_datetime_utc: "2026-07-23T00:00:00.000Z",
      job_min_salary: null, job_max_salary: null,
    }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    const { offers, calls } = await searchJSearch(p, creds);
    expect(calls).toBe(1);
    expect(offers[0]).toMatchObject({
      id: "jsearch-abc", source: "jsearch",
      company: "Médecins sans Frontières France",
      logoUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:X&s=0",
      boardDomain: "jobs.makesense.org",
      boardName: "Jobs That Make Sense",
      contractLabel: "À plein temps",
      salaryLabel: "",
    });
  });

  it("laisse logoUrl vide quand l'API n'en fournit pas", async () => {
    stub([{ job_id: "x", job_title: "Webmaster", employer_logo: null, job_description: "" }]);
    const p = parseProfile({ ...hariss, keywords: ["Webmaster"] });
    expect((await searchJSearch(p, creds)).offers[0].logoUrl).toBe("");
  });

  it("injecte le lieu dans la requête et envoie la clé en en-tête", async () => {
    const m = stub([]);
    const p = parseProfile({
      ...hariss, keywords: ["Webmaster"],
      location: { kind: "commune", code: "75056", label: "Paris (75001)", radiusKm: 20 },
    });
    await searchJSearch(p, creds);
    const [url, init] = m.mock.calls[0] as unknown as [string, RequestInit];
    expect(decodeURIComponent(String(url).replace(/\+/g, " "))).toContain("query=Webmaster en Paris");
    expect(String(url)).toContain("country=fr");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("ak_test");
  });

  it("écarte les stages/alternances via excludedWords", async () => {
    stub([{ job_id: "1", job_title: "Webmaster en alternance", job_description: "" }]);
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchJSearch(p, creds)).offers).toHaveLength(0);
  });

  it("renvoie [] sans jeter si l'API échoue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
    const p = parseProfile({ ...hariss, keywords: ["x"] });
    expect((await searchJSearch(p, creds)).offers).toEqual([]);
  });

  it("renvoie 0 offre et 0 appel sans mot-clé", async () => {
    const m = stub([]);
    const p = parseProfile({ ...hariss, keywords: [] });
    expect(await searchJSearch(p, creds)).toEqual({ offers: [], calls: 0 });
    expect(m).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import hariss from "../../../../../tests/fixtures/job_profile_hariss.json";

const ft = vi.hoisted(() => vi.fn());
const adz = vi.hoisted(() => vi.fn());
const js = vi.hoisted(() => vi.fn());

vi.mock("@/lib/jobs/francetravail", async (orig) => ({
  ...(await orig<typeof import("@/lib/jobs/francetravail")>()),
  search: ft,
}));
vi.mock("@/lib/jobs/adzuna", () => ({ searchAdzuna: adz }));
vi.mock("@/lib/jobs/jsearch", () => ({ searchJSearch: js }));

import { POST } from "./route";

function offer(id: string, source: string, extra: Record<string, unknown> = {}) {
  return {
    id, source, title: `Poste ${id}`, company: `Boite ${id}`,
    location: "", commuteDestination: "", url: "", jobText: "mot", publishedAt: "",
    logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "",
    ...extra,
  };
}

function req(profile: Record<string, unknown>) {
  return new Request("http://x/api/jobs/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FT_CLIENT_ID = "id";
  process.env.FT_CLIENT_SECRET = "secret";
  process.env.ADZUNA_APP_ID = "aid";
  process.env.ADZUNA_APP_KEY = "akey";
  process.env.JSEARCH_API_KEY = "jkey";
  ft.mockResolvedValue({ offers: [], calls: 0 });
  adz.mockResolvedValue({ offers: [], calls: 0 });
  js.mockResolvedValue({ offers: [], calls: 0 });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/jobs/search", () => {
  it("n'interroge que les sources activées", async () => {
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: false, jsearch: false } }));
    expect(res.status).toBe(200);
    expect(ft).toHaveBeenCalledTimes(1);
    expect(adz).not.toHaveBeenCalled();
    expect(js).not.toHaveBeenCalled();
  });

  it("interroge les trois quand elles sont activées", async () => {
    await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: true, jsearch: true } }));
    expect(ft).toHaveBeenCalledTimes(1);
    expect(adz).toHaveBeenCalledTimes(1);
    expect(js).toHaveBeenCalledTimes(1);
  });

  it("une source en échec n'empêche pas les autres", async () => {
    ft.mockRejectedValue(new Error("FT HS"));
    js.mockResolvedValue({ offers: [offer("1", "jsearch")], calls: 1 });
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: false, jsearch: true } }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.offers).toHaveLength(1);
    expect(data.failed).toEqual(["francetravail"]);
  });

  it("remonte le nombre d'appels par source", async () => {
    ft.mockResolvedValue({ offers: [], calls: 2 });
    js.mockResolvedValue({ offers: [], calls: 3 });
    const res = await POST(req({ ...hariss, keywords: ["a", "b"],
      sources: { francetravail: true, adzuna: false, jsearch: true } }));
    const data = await res.json();
    expect(data.calls).toEqual({ francetravail: 2, adzuna: 0, jsearch: 3 });
  });

  it("dédoublonne entre sources", async () => {
    ft.mockResolvedValue({ offers: [offer("a", "francetravail",
      { company: "ACME", title: "Webmaster" })], calls: 1 });
    js.mockResolvedValue({ offers: [offer("b", "jsearch",
      { company: "ACME", title: "Webmaster" })], calls: 1 });
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: true, adzuna: false, jsearch: true } }));
    const data = await res.json();
    expect(data.offers).toHaveLength(1);
    expect(data.offers[0].source).toBe("francetravail");
  });

  it("400 config si les clés d'une source activée manquent", async () => {
    delete process.env.JSEARCH_API_KEY;
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: false, adzuna: false, jsearch: true } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("config");
  });

  it("400 config si aucune source n'est activée", async () => {
    const res = await POST(req({ ...hariss, keywords: ["x"],
      sources: { francetravail: false, adzuna: false, jsearch: false } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("config");
  });

  it("applique le filtre includeKeywords", async () => {
    ft.mockResolvedValue({ offers: [
      offer("1", "francetravail", { title: "Avec wordpress" }),
      offer("2", "francetravail", { title: "Sans rien", jobText: "" }),
    ], calls: 1 });
    const res = await POST(req({ ...hariss, keywords: ["x"], includeKeywords: ["wordpress"],
      sources: { francetravail: true, adzuna: false, jsearch: false } }));
    const data = await res.json();
    expect(data.offers).toHaveLength(1);
    expect(data.offers[0].title).toBe("Avec wordpress");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

function req(q: string) {
  return new Request(`http://x/api/jobs/locations?q=${encodeURIComponent(q)}`);
}

describe("GET /api/jobs/locations", () => {
  it("retourne [] si q trop court", async () => {
    const res = await GET(req("a"));
    expect((await res.json()).results).toEqual([]);
  });

  it("fusionne communes (avec code postal) et régions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/communes")) {
        return { ok: true, json: async () => ([{ nom: "Nantes", code: "44109", codesPostaux: ["44000", "44300"] }]) };
      }
      return { ok: true, json: async () => ([{ nom: "Île-de-France", code: "11" }]) };
    }));
    const res = await GET(req("nan"));
    const { results } = await res.json();
    expect(results).toContainEqual({ kind: "commune", code: "44109", label: "Nantes (44000)" });
    expect(results).toContainEqual({ kind: "region", code: "11", label: "Île-de-France" });
  });

  it("convertit Paris/Lyon/Marseille en département (FT rejette leur code commune agrégé)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/communes")) {
        return { ok: true, json: async () => ([{ nom: "Paris", code: "75056", codesPostaux: ["75001", "75012"] }]) };
      }
      return { ok: true, json: async () => ([]) };
    }));
    const res = await GET(req("par"));
    const { results } = await res.json();
    expect(results).toContainEqual({ kind: "departement", code: "75", label: "Paris (75001)" });
  });

  it("tolère une panne de geo.api.gouv.fr (retourne [])", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500, json: async () => ([]) }));
    const res = await GET(req("paris"));
    expect((await res.json()).results).toEqual([]);
  });
});

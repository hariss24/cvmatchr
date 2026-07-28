import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const req = (body: unknown) =>
  new Request("http://localhost/api/jobs/commute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/jobs/commute", () => {
  const OLD = process.env.GOOGLE_MAPS_API_KEY;
  beforeEach(() => { process.env.GOOGLE_MAPS_API_KEY = "cle-test"; });
  afterEach(() => { process.env.GOOGLE_MAPS_API_KEY = OLD; vi.restoreAllMocks(); });

  it("refuse un corps JSON invalide", async () => {
    const r = await POST(new Request("http://localhost/api/jobs/commute", { method: "POST", body: "{" }));
    expect(r.status).toBe(400);
  });

  it("refuse une destination manquante", async () => {
    const r = await POST(req({ profile: {} }));
    expect(r.status).toBe(400);
  });

  it("signale l'absence de clé Maps sans planter", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const r = await POST(req({ destination: "48.86,2.35", profile: {} }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe("config");
  });

  it("renvoie le résumé de trajet", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [{ elements: [{ status: "OK", duration: { text: "22 min" } }] }] }),
    }) as unknown as typeof fetch;

    const r = await POST(req({
      destination: "48.86,2.35",
      profile: { homeAddress: "Paris", commuteModes: ["transit"] },
    }));
    expect(r.status).toBe(200);
    expect((await r.json()).commuteText).toContain("22 min");
  });
});

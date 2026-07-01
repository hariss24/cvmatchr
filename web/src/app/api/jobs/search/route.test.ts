import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { POST } from "./route";

const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
  vi.unstubAllGlobals();
});
beforeEach(() => {
  process.env.FT_CLIENT_ID = "id";
  process.env.FT_CLIENT_SECRET = "secret";
});

function req(body: unknown = {}) {
  return new Request("http://x/api/jobs/search", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/jobs/search", () => {
  it("400 config si les clés France Travail manquent", async () => {
    delete process.env.FT_CLIENT_ID;
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("config");
  });

  it("agrège, filtre les stages/alternances et dédoublonne", async () => {
    // token puis, pour chaque mot-clé, la même liste (2 offres dont 1 alternance).
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("access_token")) return { ok: true, json: async () => ({ access_token: "tok" }) };
        return {
          status: 200,
          json: async () => ({
            resultats: [
              { id: "1", intitule: "Webmaster", description: "CDI", entreprise: { nom: "ACME" } },
              { id: "2", intitule: "Dev", alternance: true },
            ],
          }),
        };
      }),
    );
    const res = await POST(req());
    expect(res.status).toBe(200);
    const { offers } = await res.json();
    expect(offers).toHaveLength(1); // id "2" (alternance) exclu, id "1" dédoublonné
    expect(offers[0]).toMatchObject({ id: "1", title: "Webmaster", company: "ACME" });
  });

  it("502 si France Travail échoue", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const res = await POST(req());
    expect(res.status).toBe(502);
  });
});

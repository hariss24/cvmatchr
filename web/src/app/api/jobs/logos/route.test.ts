import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/jobs/logos", () => ({ logoUrlsFor: vi.fn() }));
import { logoUrlsFor } from "@/lib/jobs/logos";
import { POST } from "./route";

const mockLogos = vi.mocked(logoUrlsFor);

function req(body: unknown): Request {
  return new Request("http://localhost/api/jobs/logos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockLogos.mockReset();
  mockLogos.mockResolvedValue({});
});

describe("POST /api/jobs/logos", () => {
  it("renvoie les logos résolus", async () => {
    mockLogos.mockResolvedValue({ Acme: "https://logo/acme.png" });
    const res = await POST(req({ companies: ["Acme"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ logos: { Acme: "https://logo/acme.png" } });
  });

  // Une liste de scan répète la même entreprise sur plusieurs offres : la
  // dédoublonner ici évite d'envoyer 50 noms pour 20 entreprises distinctes.
  it("dédoublonne et écarte les noms vides", async () => {
    await POST(req({ companies: ["Acme", "Acme", "  ", "Beta", 42] }));
    expect(mockLogos.mock.calls[0][0]).toEqual(["Acme", "Beta"]);
  });

  it("plafonne la liste pour ne pas résoudre un scan entier", async () => {
    const noms = Array.from({ length: 200 }, (_, i) => `E${i}`);
    await POST(req({ companies: noms }));
    expect(mockLogos.mock.calls[0][0]).toHaveLength(120);
  });

  it("refuse un corps sans liste d'entreprises", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect(mockLogos).not.toHaveBeenCalled();
  });
});

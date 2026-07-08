import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/extract-meta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockComplete.mockReset());

describe("POST /api/extract-meta", () => {
  it("renvoie company/role extraits", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ company: "ACME", role: "Dev" }));
    const res = await POST(req({ job_desc: "offre de dev chez ACME" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ company: "ACME", role: "Dev" });
  });

  it("normalise en chaînes vides les champs absents", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({}));
    const res = await POST(req({ job_desc: "texte" }));
    expect(await res.json()).toEqual({ company: "", role: "" });
  });

  it("400 si offre manquante", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});

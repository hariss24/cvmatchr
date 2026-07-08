import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/adapt-letter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockComplete.mockReset());

describe("POST /api/adapt-letter", () => {
  it("renvoie le corps adapté et transmet lettre + offre + CV", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ body: "corps adapté" }));
    const res = await POST(
      req({ letter_body: "mon modèle", job_desc: "offre", cv_json: { name: "x" }, company: "ACME", role: "Dev" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("corps adapté");

    const content = mockComplete.mock.calls[0][0][0].content;
    expect(content).toContain("mon modèle");
    expect(content).toContain("offre");
    expect(content).toContain("Entreprise visée : ACME");
  });

  it("400 si lettre ou offre manquante", async () => {
    const res = await POST(req({ letter_body: "", job_desc: "offre" }));
    expect(res.status).toBe(400);
  });

  it("502 si la réponse IA n'a pas de body", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ autre: 1 }));
    const res = await POST(req({ letter_body: "modèle", job_desc: "offre" }));
    expect(res.status).toBe(502);
  });
});

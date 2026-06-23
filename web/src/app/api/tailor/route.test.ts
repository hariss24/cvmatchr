import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({
  streamCompletion: vi.fn(),
  requireKey: vi.fn(() => "key"),
}));
import { streamCompletion, requireKey } from "@/lib/ai/clients";
import { POST } from "./route";

const mockStream = vi.mocked(streamCompletion);
const mockRequireKey = vi.mocked(requireKey);

async function* gen(values: string[]): AsyncGenerator<string> {
  for (const v of values) yield v;
}

function req(body: unknown): Request {
  return new Request("http://localhost/api/tailor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockStream.mockReset();
  mockRequireKey.mockReset().mockReturnValue("key");
});

describe("POST /api/tailor", () => {
  it("streame le HTML adapté et construit le prompt attendu", async () => {
    mockStream.mockReturnValue(gen(["<div>"]));
    const res = await POST(req({ html: "<p>cv</p>", job_desc: "offre", level: "adapte" }));
    const text = await res.text();
    expect(text).toBe('data: "<div>"\n\ndata: [DONE]\n\n');
    const [prompt, system] = mockStream.mock.calls[0];
    expect(prompt).toContain("CV HTML :");
    expect(prompt).toContain("offre");
    expect(system).toContain("RÈGLES TECHNIQUES STRICTES");
  });

  it("active l'élagage en mode is_master", async () => {
    mockStream.mockReturnValue(gen(["x"]));
    await POST(req({ html: "<p>cv</p>", job_desc: "offre", level: "hyper", is_master: true }));
    expect(mockStream.mock.calls[0][1]).toContain("RÈGLE DE SÉLECTION (CV MAÎTRE)");
  });

  it("exige HTML et offre", async () => {
    const res = await POST(req({ html: "", job_desc: "offre" }));
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });
});

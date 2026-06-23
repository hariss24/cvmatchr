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
  return new Request("http://localhost/api/text-to-html", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockStream.mockReset();
  mockRequireKey.mockReset().mockReturnValue("key");
});

describe("POST /api/text-to-html", () => {
  it("streame le HTML en SSE et choisit le système CV par défaut", async () => {
    mockStream.mockReturnValue(gen(["<h", "tml>"]));
    const res = await POST(req({ text: "mon cv" }));
    const text = await res.text();
    expect(text).toBe('data: "<h"\n\ndata: "tml>"\n\ndata: [DONE]\n\n');
    expect(mockStream.mock.calls[0][1]).toContain("Remplis ce squelette HTML");
  });

  it("choisit le système Lettre quand doc_type=Lettre", async () => {
    mockStream.mockReturnValue(gen(["x"]));
    await POST(req({ text: "ma lettre", doc_type: "Lettre" }));
    expect(mockStream.mock.calls[0][1]).toContain("lettre de motivation");
  });

  it("refuse un texte vide", async () => {
    const res = await POST(req({ text: "" }));
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("renvoie 400 si aucune clé (échec tôt, hors stream)", async () => {
    mockRequireKey.mockImplementation(() => {
      throw new Error("Aucune clé API configurée.");
    });
    const res = await POST(req({ text: "cv" }));
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });
});

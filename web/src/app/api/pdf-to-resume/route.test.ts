import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ streamCompletion: vi.fn() }));
import { streamCompletion } from "@/lib/ai/clients";
import { POST } from "./route";

const mockStream = vi.mocked(streamCompletion);

async function* gen(values: string[]): AsyncGenerator<string> {
  for (const v of values) yield v;
}

const PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

function req(body: unknown): Request {
  return new Request("http://localhost/api/pdf-to-resume", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockStream.mockReset());

describe("POST /api/pdf-to-resume", () => {
  it("assemble les chunks JSON et renvoie un CV normalisé", async () => {
    mockStream.mockReturnValue(gen(['{"name":"Zoé"', ',"experience":[]}']));
    const res = await POST(req({ images: [`data:image/png;base64,${PNG_B64}`, PNG_B64] }));
    expect(res.status).toBe(200);
    const { resume } = await res.json();
    expect(resume.name).toBe("Zoé");

    // streamCompletion reçoit les images décodées + un prompt mentionnant 2 pages.
    const [prompt, , opts] = mockStream.mock.calls[0];
    expect(prompt).toContain("2 pages");
    expect(opts?.images).toHaveLength(2);
    expect(opts?.images?.[0]).toBeInstanceOf(Uint8Array);
  });

  it("refuse une liste vide", async () => {
    const res = await POST(req({ images: [] }));
    expect(res.status).toBe(400);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("refuse trop de pages", async () => {
    const res = await POST(req({ images: Array(11).fill(PNG_B64) }));
    expect(res.status).toBe(413);
  });

  it("propage l'erreur clé Anthropic+images en 502", async () => {
    // Le vrai streamCompletion est un async generator : il lève au premier next(),
    // pas à l'appel. On reproduit ce comportement fidèlement.
    mockStream.mockImplementation(async function* () {
      throw new Error("La clé Anthropic ne supporte pas la conversion PDF.");
    });
    const res = await POST(req({ images: [PNG_B64] }));
    expect(res.status).toBe(502);
  });
});

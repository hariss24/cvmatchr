import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ testConnection: vi.fn() }));
import { testConnection } from "@/lib/ai/clients";
import { POST } from "./route";

const mockTestConnection = vi.mocked(testConnection);

function req(body: unknown): Request {
  return new Request("http://localhost/api/test-model", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockTestConnection.mockReset();
  delete process.env.GEMINI_API_KEY;
});

describe("POST /api/test-model", () => {
  it("refuse un modèle Gemini sans clé, même si GEMINI_API_KEY est défini côté serveur", async () => {
    process.env.GEMINI_API_KEY = "server-secret-key";
    const res = await POST(req({ model: "gemini-2.5-flash" }));
    expect(res.status).toBe(400);
    expect(mockTestConnection).not.toHaveBeenCalled();
  });

  it("teste avec la clé fournie par l'appelant, jamais celle du serveur", async () => {
    process.env.GEMINI_API_KEY = "server-secret-key";
    mockTestConnection.mockResolvedValue(undefined);
    await POST(req({ model: "gemini-2.5-flash", key: "clé-utilisateur" }));
    expect(mockTestConnection).toHaveBeenCalledWith("gemini", "gemini-2.5-flash", "clé-utilisateur");
  });
});

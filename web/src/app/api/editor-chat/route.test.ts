import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/editor-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => mockComplete.mockReset());

describe("POST /api/editor-chat", () => {
  it("injecte le contexte JSON et renvoie reply + proposals", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        reply: "Voici une amélioration.",
        proposals: [
          { id: "p1", title: "Nouveau", summary: "s", json: { sender_name: "NEW" } },
        ],
      }),
    );

    const res = await POST(
      req({ messages: [{ role: "user", content: "améliore" }], doc_json: { sender_name: "OLD" } }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Voici une amélioration.");
    expect(data.proposals).toHaveLength(1);
    expect(data.proposals[0].json.sender_name).toBe("NEW");

    // Le contexte (JSON courant) est injecté en tête de la conversation.
    const sent = mockComplete.mock.calls[0][0];
    expect(sent[0].role).toBe("user");
    expect(sent[0].content).toContain('"sender_name": "OLD"');
    expect(sent[1].role).toBe("assistant");
  });

  it("exige au moins un message", async () => {
    const res = await POST(req({ messages: [], doc_json: {} }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

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
  it("injecte le contexte et renvoie reply + proposals filtrées", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        reply: "Voici une amélioration.",
        proposals: [
          { id: "p1", title: "Nouveau", summary: "s", html: "<p>NEW</p>", css: "" },
          // identique au document courant → doit être filtrée
          { id: "p2", title: "Idem", summary: "s", html: "<p>OLD</p>", css: "old{}" },
        ],
      }),
    );

    const res = await POST(
      req({ messages: [{ role: "user", content: "améliore" }], html: "<p>OLD</p>", css: "old{}" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Voici une amélioration.");
    expect(data.proposals).toHaveLength(1);
    expect(data.proposals[0].html).toBe("<p>NEW</p>");

    // Le contexte (HTML courant) est injecté en tête de la conversation.
    const sent = mockComplete.mock.calls[0][0];
    expect(sent[0].role).toBe("user");
    expect(sent[0].content).toContain("<p>OLD</p>");
    expect(sent[1].role).toBe("assistant");
  });

  it("exige au moins un message", async () => {
    const res = await POST(req({ messages: [], html: "<p>x</p>" }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

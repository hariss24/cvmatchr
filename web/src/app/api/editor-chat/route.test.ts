import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/editor-chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "test-key" },
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
          {
            id: "p1",
            title: "Nouveau",
            summary: "s",
            json: { sender_name: "NEW", body: "Corps modifié" },
          },
        ],
      }),
    );

    const res = await POST(
      req({
        messages: [{ role: "user", content: "améliore" }],
        doc_json: { sender_name: "OLD", body: "Corps existant" },
        doc_type: "Lettre",
      }),
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

  // Le modèle décroche de l'enveloppe JSON dès qu'une demande n'appelle aucune retouche
  // (« qu'est-ce que j'écris dans ce champ ? ») : il répond en prose. C'est une réponse
  // utile mal emballée, pas une panne — l'afficher vaut mieux que « JSON malformé ».
  it("rend la prose telle quelle quand la réponse n'est pas du JSON", async () => {
    mockComplete.mockResolvedValue("Pour répondre à cette question, mets en avant ton pilotage de projet.");

    const res = await POST(req({ messages: [{ role: "user", content: "j'écris quoi ?" }], doc_json: {} }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe("Pour répondre à cette question, mets en avant ton pilotage de projet.");
    expect(data.proposals).toEqual([]);
  });

  it("récupère le JSON même noyé dans du texte", async () => {
    mockComplete.mockResolvedValue(
      'Voici ma proposition :\n{"reply":"Fait.","proposals":[]}\nDis-moi si ça convient.',
    );

    const res = await POST(req({ messages: [{ role: "user", content: "améliore" }], doc_json: {} }));

    const data = await res.json();
    expect(data.reply).toBe("Fait.");
  });

  it("exige au moins un message", async () => {
    const res = await POST(req({ messages: [], doc_json: {} }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

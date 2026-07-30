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

  it("relance une fois quand l'IA laisse un trou, puis renvoie la version propre", async () => {
    mockComplete
      .mockResolvedValueOnce(JSON.stringify({ body: "en tant que Poste occupé chez ACME" }))
      .mockResolvedValueOnce(JSON.stringify({ body: "en tant que webmaster chez ACME" }));
    const res = await POST(req({ letter_body: "modèle", job_desc: "offre" }));
    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("en tant que webmaster chez ACME");
    expect(mockComplete).toHaveBeenCalledTimes(2);
    expect(mockComplete.mock.calls[1][0][0].content).toContain("Poste occupé");
  });

  it("échoue plutôt que de renvoyer une lettre à trous après la relance", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ body: "j'ai notamment [votre réalisation]" }));
    const res = await POST(req({ letter_body: "modèle", job_desc: "offre" }));
    expect(res.status).toBe(502);
    expect(mockComplete).toHaveBeenCalledTimes(2);
  });

  // Le squelette d'usine est fait de consignes entre crochets : il n'y a pas de voix à
  // conserver, l'IA doit rédiger. C'est ce qui produisait la lettre scolaire du 24/07.
  it("bascule en mode rédaction quand le corps est un squelette à trous", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ body: "corps" }));
    await POST(req({ letter_body: "[Accroche : présentez-vous.]", job_desc: "offre" }));
    expect(mockComplete.mock.calls[0][1]).toContain("écrire le corps de la lettre");
  });

  it("garde le mode adaptation quand le corps est une vraie lettre", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ body: "corps" }));
    await POST(req({ letter_body: "Bonjour, je vous écris car…", job_desc: "offre" }));
    expect(mockComplete.mock.calls[0][1]).toContain("Garde ses idées");
  });

  it("applique le registre demandé, et retombe sur le défaut si la valeur est invalide", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ body: "corps" }));
    await POST(req({ letter_body: "ma lettre", job_desc: "offre", tone: "factuel" }));
    expect(mockComplete.mock.calls[0][1]).toContain("FACTUEL ET CONCRET");

    await POST(req({ letter_body: "ma lettre", job_desc: "offre", tone: "n'importe quoi" }));
    expect(mockComplete.mock.calls[1][1]).toContain("AUTHENTIQUE, PERSONNEL ET HUMAIN");
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

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));
import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

function req(body: unknown): Request {
  return new Request("http://localhost/api/ats-score", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ok = { resume_text: "Développeur React", job_desc: "offre" };

beforeEach(() => mockComplete.mockReset());

describe("POST /api/ats-score", () => {
  it("normalise les exigences renvoyées par l'IA", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        job_title: "Développeur front",
        requirements: [
          { term: "React", kind: "hard", present: true, evidence: "Développeur React" },
          { term: "react", kind: "hard", present: false, evidence: "" }, // doublon
          { term: "Go", kind: "bizarre", present: "oui" }, // types douteux
        ],
        priorities: [{ title: "Prouvez Go", problem: "absent", fix: "…", example: "…", zone: "Expériences" }],
      }),
    );
    const res = await POST(req(ok));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.job_title).toBe("Développeur front");
    expect(data.requirements).toHaveLength(2); // doublon écarté
    expect(data.requirements[0]).toEqual({
      term: "React",
      kind: "hard",
      present: true,
      evidence: "Développeur React",
    });
    // kind inconnu → 'hard' ; present non booléen → false
    expect(data.requirements[1].kind).toBe("hard");
    expect(data.requirements[1].present).toBe(false);
    expect(data.priorities).toHaveLength(1);
  });

  it("exige le CV et l'offre", async () => {
    const res = await POST(req({ resume_text: "", job_desc: "offre" }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("transmet l'intitulé du poste à l'IA quand il est fourni", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({ requirements: [{ term: "React", kind: "hard", present: true }] }),
    );
    await POST(req({ ...ok, role: "Développeur front" }));
    const [messages] = mockComplete.mock.calls[0];
    expect(messages[0].content).toContain("Intitulé du poste visé : Développeur front");
  });

  it("renvoie 502 si l'IA ne fournit aucune exigence exploitable", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ requirements: [] }));
    const res = await POST(req(ok));
    expect(res.status).toBe(502);
  });
});

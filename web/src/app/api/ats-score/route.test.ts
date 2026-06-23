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

beforeEach(() => mockComplete.mockReset());

describe("POST /api/ats-score", () => {
  it("borne le score et normalise les listes", async () => {
    mockComplete.mockResolvedValue(
      JSON.stringify({
        score: 142,
        matched_skills: ["JS", "js"],
        missing_hard_skills: ["Go"],
        missing_nice_to_have: [],
      }),
    );
    const res = await POST(req({ cv_html: "<p>cv</p>", job_desc: "offre" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(100); // borné
    expect(data.matched_skills).toEqual(["JS"]); // dédupliqué
    expect(data.missing_hard_skills).toEqual(["Go"]);
  });

  it("exige CV et offre", async () => {
    const res = await POST(req({ cv_html: "", job_desc: "offre" }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("renvoie 502 si la réponse IA n'a pas de score", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({ foo: 1 }));
    const res = await POST(req({ cv_html: "<p>cv</p>", job_desc: "offre" }));
    expect(res.status).toBe(502);
  });
});

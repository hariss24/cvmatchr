import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Mocks des modules jobs (le calcul réel est testé unitairement ailleurs).
const getCommuteTimes = vi.fn();
const scoreOffer = vi.fn();
vi.mock("@/lib/jobs/maps", () => ({
  getCommuteTimes: (...a: unknown[]) => getCommuteTimes(...a),
  commuteSummary: () => "TC: 25 min",
}));
vi.mock("@/lib/jobs/score", () => ({ scoreOffer: (...a: unknown[]) => scoreOffer(...a) }));

import { POST } from "./route";

const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
  vi.clearAllMocks();
});
beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = "maps-key";
});

function req(body: unknown) {
  return new Request("http://x/api/jobs/score", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/jobs/score", () => {
  it("400 si l'offre manque", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("400 config si GOOGLE_MAPS_API_KEY manque", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const res = await POST(req({ offer: { intitule: "x" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("config");
  });

  it("renvoie score + breakdown + trajet", async () => {
    getCommuteTimes.mockResolvedValue({ transit: "25 min" });
    scoreOffer.mockResolvedValue({ total_score: 84, score_tech: 35, red_flags_reasons: [] });
    const res = await POST(req({ offer: { intitule: "Webmaster" } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(84);
    expect(data.commuteText).toBe("TC: 25 min");
  });

  it("429 si quota Gemini épuisé (arrêt propre côté client)", async () => {
    getCommuteTimes.mockResolvedValue({ transit: "25 min" });
    scoreOffer.mockRejectedValue(new Error("Quota Gemini épuisé (gemini-3.1-flash-lite)."));
    const res = await POST(req({ offer: { intitule: "x" } }));
    expect(res.status).toBe(429);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { getCommuteTimes, commuteSummary } from "./maps";
import type { JobSearchProfile } from "./profile";
import type { RawOffer } from "./francetravail";

afterEach(() => vi.unstubAllGlobals());

const profile = {
  homeAddress: "Home",
  commuteModes: ["transit", "bicycling"],
} as unknown as JobSearchProfile;

function okMatrix(text: string) {
  return { ok: true, json: async () => ({ rows: [{ elements: [{ status: "OK", duration: { text } }] }] }) };
}

describe("getCommuteTimes", () => {
  it("utilise les coordonnées si présentes et renvoie la durée par mode", async () => {
    const fetchMock = vi.fn(async () => okMatrix("25 min"));
    vi.stubGlobal("fetch", fetchMock);
    const offer: RawOffer = { lieuTravail: { latitude: 48.8, longitude: 2.3, libelle: "Paris" } };
    const out = await getCommuteTimes(offer, profile, "KEY");
    expect(out).toEqual({ transit: "25 min", bicycling: "25 min" });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("destinations=48.8%2C2.3");
    expect(url).toContain("origins=Home");
  });

  it("retombe sur le libellé sans coordonnées", async () => {
    const fetchMock = vi.fn(async () => okMatrix("10 min"));
    vi.stubGlobal("fetch", fetchMock);
    await getCommuteTimes({ lieuTravail: { libelle: "75 - Paris" } }, profile, "KEY");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("destinations=75+-+Paris");
  });

  it("renvoie N/A partout si l'offre n'a pas de lieu exploitable", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await getCommuteTimes({}, profile, "KEY")).toEqual({ transit: "N/A", bicycling: "N/A" });
  });

  it("N/A si l'élément Maps n'est pas OK", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ rows: [{ elements: [{ status: "ZERO_RESULTS" }] }] }) }));
    const out = await getCommuteTimes({ lieuTravail: { libelle: "X" } }, profile, "KEY");
    expect(out).toEqual({ transit: "N/A", bicycling: "N/A" });
  });
});

describe("commuteSummary", () => {
  it("formate TC + Vélo dans l'ordre attendu", () => {
    expect(commuteSummary({ transit: "25 min", bicycling: "40 min" })).toBe("TC: 25 min | Vélo: 40 min");
  });
});

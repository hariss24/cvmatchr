import { describe, it, expect, vi, afterEach } from "vitest";
import { search, isExcluded, mapOffer, type RawOffer } from "./francetravail";
import { parseProfile } from "./profileSchema";
import hariss from "../../../tests/fixtures/job_profile_hariss.json";
const DEFAULT_PROFILE = parseProfile(hariss);

afterEach(() => vi.unstubAllGlobals());

describe("isExcluded", () => {
  const ex = DEFAULT_PROFILE.excludedWords;

  it("exclut via le drapeau alternance", () => {
    expect(isExcluded({ alternance: true, intitule: "Webmaster" }, ex)).toBe(true);
  });

  it("exclut un mot interdit dans la description", () => {
    expect(isExcluded({ intitule: "Dev", description: "contrat d'apprentissage" }, ex)).toBe(true);
  });

  it("exclut « stage » en mot isolé (tirets = séparateurs)", () => {
    expect(isExcluded({ intitule: "Offre de stage-web" }, ex)).toBe(true);
  });

  it("n'exclut pas un mot contenant « stage » (ex. stagecoach)", () => {
    expect(isExcluded({ intitule: "Webmaster stagecoach" }, ex)).toBe(false);
  });

  it("garde une offre CDI normale", () => {
    expect(isExcluded({ intitule: "Webmaster", description: "CDI", typeContratLibelle: "CDI" }, ex)).toBe(false);
  });
});

describe("mapOffer", () => {
  it("normalise, tronque et déduit la destination (coordonnées prioritaires)", () => {
    const raw: RawOffer = {
      id: "42",
      intitule: "Webmaster",
      description: "x".repeat(5000),
      entreprise: { nom: "ACME" },
      lieuTravail: { libelle: "75 - Paris", latitude: 48.8, longitude: 2.3 },
      origineOffre: { urlOrigine: "https://ex.fr/42" },
      dateCreation: "2026-06-30T10:00:00Z",
    };
    const out = mapOffer(raw, 3000);
    expect(out).toMatchObject({ id: "42", title: "Webmaster", company: "ACME", location: "75 - Paris", url: "https://ex.fr/42", commuteDestination: "48.8,2.3", publishedAt: "2026-06-30T10:00:00Z" });
    expect(out.jobText).toHaveLength(3000);
  });

  it("destination = libellé sans coordonnées", () => {
    expect(mapOffer({ lieuTravail: { libelle: "75 - Paris" } }, 3000).commuteDestination).toBe("75 - Paris");
  });

  it("tolère les champs manquants", () => {
    expect(mapOffer({}, 3000)).toMatchObject({
      id: "", title: "", company: "", location: "",
      commuteDestination: "", url: "", jobText: "", publishedAt: "",
      source: "francetravail", logoUrl: "",
    });
  });
});

describe("search", () => {
  const creds = { clientId: "id", clientSecret: "secret" };

  it("renvoie [] immédiatement si la source est désactivée", async () => {
    const p = parseProfile({ ...hariss, sources: { francetravail: false } });
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await search(p, creds)).toEqual({ offers: [], calls: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("renvoie [] si pas d'identifiants", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await search(DEFAULT_PROFILE, { clientId: "", clientSecret: "" })).toEqual({ offers: [], calls: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("gère l'erreur d'authentification sans planter", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 401, json: async () => ({}) }));
    expect(await search(DEFAULT_PROFILE, creds)).toEqual({ offers: [], calls: 0 });
  });

  it("boucle sur les mots-clés et dédoublonne", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = url.toString();
      if (u.includes("token")) return { ok: true, json: async () => ({ access_token: "tok" }) };
      // 1er mot clé renvoie id:1 et id:2
      if (u.includes("motsCles=A")) return { status: 200, json: async () => ({ resultats: [{ id: "1" }, { id: "2" }] }) };
      // 2e mot clé renvoie id:2 (doublon) et id:3
      if (u.includes("motsCles=B")) return { status: 200, json: async () => ({ resultats: [{ id: "2" }, { id: "3" }] }) };
      return { status: 200, json: async () => ({ resultats: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const p = parseProfile({ ...hariss, keywords: ["A", "B"] });
    const out = await search(p, creds);
    expect(out.offers).toHaveLength(3);
    expect(out.offers.map(o => o.id)).toEqual(["1", "2", "3"]);
    expect(out.calls).toBe(2);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { getToken, fetchOffers, isExcluded, mapOffer, type RawOffer } from "./francetravail";
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
    expect(mapOffer({}, 3000)).toEqual({ id: "", title: "", company: "", location: "", commuteDestination: "", url: "", jobText: "", publishedAt: "" });
  });
});

describe("getToken", () => {
  it("renvoie l'access_token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ access_token: "tok" }) })));
    expect(await getToken("id", "secret")).toBe("tok");
  });

  it("lève si la réponse n'est pas ok", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(getToken("id", "secret")).rejects.toThrow(/France Travail/);
  });
});

describe("fetchOffers", () => {
  it("renvoie resultats sur 200", async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [{ id: "1" }] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchOffers("tok", "SEO", DEFAULT_PROFILE);
    expect(out).toEqual([{ id: "1" }]);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("offresdemploi/v2/offres/search");
    expect(url).toContain("motsCles=SEO");
    expect(url).toContain("minCreationDate=");
    expect(url).toContain("maxCreationDate=");
  });

  it("renvoie [] sur un statut inattendu", async () => {
    vi.stubGlobal("fetch", async () => ({ status: 500, json: async () => ({}) }));
    expect(await fetchOffers("tok", "SEO", DEFAULT_PROFILE)).toEqual([]);
  });

  it("construit les paramètres géo commune + rayon", async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const p = parseProfile({ ...hariss, location: { kind: "commune", code: "75112", label: "", radiusKm: 15 } });
    await fetchOffers("tok", "SEO", p);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("commune=75112");
    expect(url).toContain("distance=15");
    expect(url).not.toContain("region=");
  });

  it("construit region quand kind=region", async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const p = parseProfile({ ...hariss, location: { kind: "region", code: "11", label: "", radiusKm: 10 } });
    await fetchOffers("tok", "SEO", p);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("region=11");
    expect(url).not.toContain("commune=");
  });

  it("ajoute experienceExige=D si débutant accepté, sinon absent", async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchOffers("tok", "SEO", parseProfile({ ...hariss, debutantAccepte: true }));
    await fetchOffers("tok", "SEO", parseProfile({ ...hariss, debutantAccepte: false }));
    const [u1] = fetchMock.mock.calls[0] as unknown as [string];
    const [u2] = fetchMock.mock.calls[1] as unknown as [string];
    expect(u1).toContain("experienceExige=D");
    expect(u2).not.toContain("experienceExige");
  });

  it("ajoute salaireMin + periodeSalaire quand défini", async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, json: async () => ({ resultats: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const p = parseProfile({ ...hariss, salaireMin: 30000, periodeSalaire: "A" });
    await fetchOffers("tok", "SEO", p);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("salaireMin=30000");
    expect(url).toContain("periodeSalaire=A");
  });
});

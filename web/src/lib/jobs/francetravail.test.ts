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

describe("search", () => {
  // Le `try` de `search` englobe toute la source : sans rattrapage par mot-clé, une
  // seule requête en échec emporterait les résultats de tous les autres.
  it("garde les résultats des mots-clés qui aboutissent malgré un échec", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("connexion")) return { ok: true, json: async () => ({ access_token: "t" }) };
      if (url.includes("motsCles=bloque")) throw new Error("panne réseau");
      return {
        status: 200,
        json: async () => ({ resultats: [{ id: "42", intitule: "Webmaster", typeContratLibelle: "CDI" }] }),
      };
    }));

    const profile = parseProfile({ ...hariss, keywords: ["bloque", "webmaster"] });
    const { offers, calls } = await search(profile, { clientId: "id", clientSecret: "s" });

    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe("Webmaster");
    expect(calls).toBe(2);
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

describe("mapOffer — champs structurés", () => {
  const brut = {
    id: "77",
    intitule: "Développeur web",
    description: "Mission.",
    dateCreation: "2026-07-01T09:00:00Z",
    entreprise: { nom: "ACME", logo: "https://ex.fr/logo.png" },
    lieuTravail: { libelle: "75 - Paris", latitude: 48.86, longitude: 2.35 },
    origineOffre: { urlOrigine: "https://ex.fr/77" },
    romeCode: "M1855",
    competences: [
      { code: "100341", libelle: "Procédures", exigence: "E" },
      { code: "300374", libelle: "Valoriser", exigence: "S" },
    ],
    experienceExige: "E",
    experienceLibelle: "3 An(s)",
    typeContratLibelle: "CDI",
    salaire: { libelle: "Annuel de 34000.0 Euros sur 12 mois" },
  };

  it("reporte le code ROME et les compétences codifiées", () => {
    const o = mapOffer(brut, 3000);
    expect(o.romeCode).toBe("M1855");
    expect(o.competences).toEqual([
      { code: "100341", exigence: "E" },
      { code: "300374", exigence: "S" },
    ]);
  });

  it("extrait les coordonnées et le logo d'entreprise", () => {
    const o = mapOffer(brut, 3000);
    expect(o.lat).toBe(48.86);
    expect(o.lng).toBe(2.35);
    expect(o.logoUrl).toBe("https://ex.fr/logo.png");
  });

  it("reporte l'expérience et en extrait le nombre d'années", () => {
    const o = mapOffer(brut, 3000);
    expect(o.experienceExige).toBe("E");
    expect(o.experienceYears).toBe(3);
  });

  it("remplit contrat et salaire, jusqu'ici toujours vides", () => {
    const o = mapOffer(brut, 3000);
    expect(o.contractLabel).toBe("CDI");
    expect(o.salaryLabel).toBe("Annuel de 34000.0 Euros sur 12 mois");
  });

  // 13 % des offres n'ont pas de compétences, 4 % pas de salaire (spec §2.1).
  it("survit à une offre dépourvue de champs structurés", () => {
    const o = mapOffer({ id: "8", intitule: "X" }, 3000);
    expect(o.romeCode).toBeUndefined();
    expect(o.competences).toBeUndefined();
    expect(o.lat).toBeUndefined();
    expect(o.logoUrl).toBe("");
    expect(o.experienceYears).toBeUndefined();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeCompany, pickBrand, logoUrlFor, withCompanyLogos } from "./logos";

const offre = (company: string, logoUrl = "") => ({ company, logoUrl });

describe("normalizeCompany", () => {
  it("ramène les graphies d'une même entreprise à une seule clé", () => {
    expect(normalizeCompany("ACME SAS")).toBe(normalizeCompany("Acme"));
    expect(normalizeCompany("Fed  Group")).toBe("fed group");
  });
});

describe("pickBrand", () => {
  // Brandfetch classe par popularité : sans contrôle du nom, chercher « Skolae »
  // remonterait « Campus Skolae Tours » et afficherait son logo à sa place.
  it("refuse une marque dont le nom ne correspond pas", () => {
    expect(pickBrand([{ name: "Campus Skolae Tours", domain: "cefim.eu" }], "Skolae")).toBe("");
  });

  it("retient la correspondance exacte", () => {
    const res = [
      { name: "Autre", domain: "autre.com" },
      { name: "Nexton", domain: "nexton.fr" },
    ];
    expect(pickBrand(res, "NEXTON")).toBe("nexton.fr");
  });

  it("préfère une fiche revendiquée par son propriétaire", () => {
    const res = [
      { name: "Acme", domain: "acme.io" },
      { name: "Acme", domain: "acme.com", claimed: true },
    ];
    expect(pickBrand(res, "Acme")).toBe("acme.com");
  });

  it("ignore une marque sans domaine", () => {
    expect(pickBrand([{ name: "Acme" }], "Acme")).toBe("");
  });
});

describe("logoUrlFor", () => {
  // L'image doit être chargée par le navigateur : Brandfetch redirige toute
  // requête sans `Referer` vers ses conditions d'usage.
  it("construit une URL de CDN portant le client ID", () => {
    expect(logoUrlFor("acme.com", "cid")).toBe(
      "https://cdn.brandfetch.io/acme.com/w/128/h/128?c=cid",
    );
  });
});

describe("withCompanyLogos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ne touche à rien sans clé configurée", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await withCompanyLogos([offre("Acme")], undefined);
    expect(out[0].logoUrl).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("n'interroge qu'une fois par entreprise, quel que soit le nombre d'offres", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ name: "Acme", domain: "acme.com" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const attendu = logoUrlFor("acme.com", "cid");
    const out = await withCompanyLogos([offre("Acme"), offre("ACME SAS"), offre("Acme")], "cid");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.map((o) => o.logoUrl)).toEqual([attendu, attendu, attendu]);
  });

  it("laisse intact le logo déjà fourni par la source", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await withCompanyLogos([offre("Acme", "https://source/logo.png")], "cid");
    expect(out[0].logoUrl).toBe("https://source/logo.png");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Un logo manquant ne doit jamais faire échouer une recherche.
  it("avale une panne de l'annuaire", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    const out = await withCompanyLogos([offre("Acme")], "cid");
    expect(out[0].logoUrl).toBe("");
  });
});

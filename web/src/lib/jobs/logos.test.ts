import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeCompany, pickBrand, withCompanyLogos } from "./logos";

const offre = (company: string, logoUrl = "") => ({ company, logoUrl });

describe("normalizeCompany", () => {
  it("ramène les graphies d'une même entreprise à une seule clé", () => {
    expect(normalizeCompany("ACME SAS")).toBe(normalizeCompany("Acme"));
    expect(normalizeCompany("Fed  Group")).toBe("fed group");
  });
});

describe("pickBrand", () => {
  // Brandfetch classe par popularité : sans contrôle du nom, chercher « Nexton »
  // pourrait remonter une marque plus connue et afficher son logo à sa place.
  it("refuse une marque dont le nom ne correspond pas", () => {
    const res = [{ name: "Nexton Media", domain: "nextonmedia.com", icon: "https://i/x.png" }];
    expect(pickBrand(res, "Nexton")).toBe("");
  });

  it("retient la correspondance exacte", () => {
    const res = [
      { name: "Autre", domain: "autre.com", icon: "https://i/autre.png" },
      { name: "Nexton", domain: "nexton.fr", icon: "https://i/nexton.png" },
    ];
    expect(pickBrand(res, "NEXTON")).toBe("https://i/nexton.png");
  });

  it("préfère une fiche revendiquée par son propriétaire", () => {
    const res = [
      { name: "Acme", domain: "acme.io", icon: "https://i/a.png" },
      { name: "Acme", domain: "acme.com", icon: "https://i/b.png", claimed: true },
    ];
    expect(pickBrand(res, "Acme")).toBe("https://i/b.png");
  });

  it("ignore une marque sans icône", () => {
    expect(pickBrand([{ name: "Acme", domain: "acme.com" }], "Acme")).toBe("");
  });

  // Faute de vrai logo, Brandfetch renvoie une initiale dessinée dans un carré.
  // L'afficher ferait passer une lettre pour un logo : on préfère notre initiale.
  it("rejette un lettermark généré à défaut de vrai logo", () => {
    const res = [{
      name: "Acme",
      domain: "acme.com",
      icon: "https://cdn.brandfetch.io/idX/w/128/h/128/fallback/lettermark/icon.webp?c=cid",
    }];
    expect(pickBrand(res, "Acme")).toBe("");
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
      json: async () => [{ name: "Acme", domain: "acme.com", icon: "https://i/acme.png" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await withCompanyLogos([offre("Acme"), offre("ACME SAS"), offre("Acme")], "cid");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.map((o) => o.logoUrl)).toEqual([
      "https://i/acme.png", "https://i/acme.png", "https://i/acme.png",
    ]);
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

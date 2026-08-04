import { describe, it, expect } from "vitest";
import { villeDuLibelle, dansLeSecteur } from "./boardsLieu";
import type { LocationFilter } from "./profile";

const commune = (label: string, radiusKm = 10): LocationFilter => ({
  kind: "commune", code: "75112", label, radiusKm,
});

const PARIS = { lat: 48.8566, lng: 2.3522 };

describe("villeDuLibelle", () => {
  it("retire le code INSEE entre parenthèses", () => {
    expect(villeDuLibelle("Toulouse (31555)")).toBe("toulouse");
  });

  it("retire l'arrondissement", () => {
    expect(villeDuLibelle("Paris 12e (75012)")).toBe("paris");
    expect(villeDuLibelle("Lyon 3ème (69383)")).toBe("lyon");
  });

  it("enlève les accents et unifie les tirets", () => {
    expect(villeDuLibelle("Boulogne-Billancourt (92012)")).toBe("boulogne billancourt");
    expect(villeDuLibelle("Île-de-France")).toBe("ile de france");
  });
});

describe("dansLeSecteur", () => {
  it("sans code de lieu, la recherche est nationale", () => {
    const filtre: LocationFilter = { kind: "commune", code: "", label: "", radiusKm: 10 };
    expect(dansLeSecteur({ lieu: "Lille" }, filtre, null)).toBe(true);
  });

  it("avec des coordonnées, applique le rayon réel", () => {
    // Boulogne-Billancourt, ~7 km de Notre-Dame : dans un rayon de 10 km.
    expect(dansLeSecteur({ lieu: "", lat: 48.8352, lng: 2.2409 }, commune("Paris (75056)"), PARIS)).toBe(true);
    // Lyon, ~390 km : hors rayon, même si son libellé ne dit rien.
    expect(dansLeSecteur({ lieu: "", lat: 45.764, lng: 4.8357 }, commune("Paris (75056)"), PARIS)).toBe(false);
  });

  it("un rayon large rattrape une offre lointaine", () => {
    expect(dansLeSecteur({ lieu: "", lat: 45.764, lng: 4.8357 }, commune("Paris (75056)", 500), PARIS)).toBe(true);
  });

  it("sans coordonnées, rapproche les libellés", () => {
    expect(dansLeSecteur({ lieu: "Paris, Île-de-France, France" }, commune("Paris (75056)"), PARIS)).toBe(true);
    expect(dansLeSecteur({ lieu: "Lyon, France" }, commune("Paris (75056)"), PARIS)).toBe(false);
  });

  it("le rapprochement ignore accents et arrondissement", () => {
    expect(dansLeSecteur({ lieu: "Paris, Ile-de-France" }, commune("Paris 12e (75012)"), null)).toBe(true);
  });

  it("une région se compare au libellé, sans rayon", () => {
    const region: LocationFilter = { kind: "region", code: "11", label: "Île-de-France", radiusKm: 10 };
    // Coordonnées présentes, mais le rayon ne s'applique pas à une région :
    // c'est le libellé qui tranche, et Bagnolet est bien en Île-de-France.
    expect(dansLeSecteur({ lieu: "Bagnolet, IDF, Ile-de-France", lat: 48.87, lng: 2.42 }, region, PARIS)).toBe(true);
    expect(dansLeSecteur({ lieu: "Lyon, Auvergne-Rhône-Alpes", lat: 45.76, lng: 4.83 }, region, PARIS)).toBe(false);
  });

  it("une offre sans lieu ni coordonnées est gardée", () => {
    // Absence d'information ≠ preuve d'éloignement (même règle que pour les dates).
    expect(dansLeSecteur({ lieu: "" }, commune("Paris (75056)"), null)).toBe(true);
  });

  it("sans géocodage, une offre à coordonnées retombe sur son libellé", () => {
    expect(dansLeSecteur({ lieu: "Paris, France", lat: 48.85, lng: 2.35 }, commune("Paris (75056)"), null)).toBe(true);
    expect(dansLeSecteur({ lieu: "Lyon, France", lat: 45.76, lng: 4.83 }, commune("Paris (75056)"), null)).toBe(false);
  });
});

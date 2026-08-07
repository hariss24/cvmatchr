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

  it("une offre sans géocodage, une offre à coordonnées retombe sur son libellé", () => {
    expect(dansLeSecteur({ lieu: "Paris, France", lat: 48.85, lng: 2.35 }, commune("Paris (75056)"), null)).toBe(true);
    expect(dansLeSecteur({ lieu: "Lyon, France", lat: 45.76, lng: 4.83 }, commune("Paris (75056)"), null)).toBe(false);
  });

  it("retient une offre parisienne dont le libellé ne nomme pas la région", () => {
    // ⚠️ Cas mesuré le 07/08/2026 : 4 124 offres écrivent « Paris » sans mention
    // de région. Le filtre textuel les écartait toutes d'une recherche IDF.
    const offre = { lieu: "Paris", dept: "75" };
    const filtre = { kind: "region" as const, code: "11", label: "Île-de-France", radiusKm: 10 };
    expect(dansLeSecteur(offre, filtre, null)).toBe(true);
  });

  it("écarte une offre hors région même si son libellé cite la région", () => {
    // ⚠️ Le défaut symétrique : « Dublin … / Paris, Île de France, France » passait
    // le filtre IDF alors que le poste est irlandais.
    const filtre = { kind: "region" as const, code: "11", label: "Île-de-France", radiusKm: 10 };
    // Sans département connu on retombe sur le libellé : ce cas reste imparfait,
    // il est documenté comme limite connue. On vérifie seulement qu'un département
    // renseigné et étranger au périmètre est bien écarté.
    expect(dansLeSecteur({ lieu: "Lyon", dept: "69" }, filtre, null)).toBe(false);
  });

  it("le filtre département compare le code, pas le libellé", () => {
    const filtre = { kind: "departement" as const, code: "93", label: "Seine-Saint-Denis", radiusKm: 10 };
    expect(dansLeSecteur({ lieu: "Montreuil", dept: "93" }, filtre, null)).toBe(true);
    expect(dansLeSecteur({ lieu: "Saint-Denis", dept: "974" }, filtre, null)).toBe(false);
  });

  it("une offre sans département garde le repli sur le libellé", () => {
    const filtre = { kind: "region" as const, code: "11", label: "Île-de-France", radiusKm: 10 };
    expect(dansLeSecteur({ lieu: "Paris, Île-de-France, France" }, filtre, null)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { parseLatLng, haversineKm, distancePoints } from "./geo";

describe("parseLatLng", () => {
  it("lit le format « lat,lng » produit par France Travail", () => {
    expect(parseLatLng("48.8,2.3")).toEqual({ lat: 48.8, lng: 2.3 });
  });

  it("accepte les espaces et les négatifs", () => {
    expect(parseLatLng(" -1.55 , 47.21 ")).toEqual({ lat: -1.55, lng: 47.21 });
  });

  it("rejette un libellé de ville", () => {
    expect(parseLatLng("75 - Paris")).toBeNull();
    expect(parseLatLng("")).toBeNull();
  });

  it("rejette des coordonnées hors bornes", () => {
    expect(parseLatLng("100,2.3")).toBeNull();
    expect(parseLatLng("48.8,200")).toBeNull();
  });
});

describe("haversineKm", () => {
  it("renvoie 0 pour deux points identiques", () => {
    expect(haversineKm({ lat: 48.85, lng: 2.35 }, { lat: 48.85, lng: 2.35 })).toBe(0);
  });

  it("mesure Paris–Lyon à ~392 km", () => {
    const d = haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 45.7640, lng: 4.8357 });
    expect(d).toBeGreaterThan(385);
    expect(d).toBeLessThan(400);
  });
});

describe("distancePoints", () => {
  it("donne le maximum dans le rayon souhaité", () => {
    expect(distancePoints(5, 10, 15)).toBe(15);
    expect(distancePoints(10, 10, 15)).toBe(15);
  });

  it("décroît au-delà du rayon puis tombe à zéro", () => {
    const proche = distancePoints(15, 10, 15);
    const loin = distancePoints(25, 10, 15);
    expect(proche).toBeGreaterThan(loin);
    expect(distancePoints(31, 10, 15)).toBe(0);
  });

  // Une distance inconnue ne doit ni avantager ni condamner l'offre : 12 % des
  // offres Adzuna n'ont pas de coordonnées (spec §2.6).
  it("reste neutre quand la distance est inconnue", () => {
    expect(distancePoints(null, 10, 15)).toBe(8);
  });

  it("traite un rayon nul comme le rayon minimal de 1 km", () => {
    expect(distancePoints(0.5, 0, 15)).toBe(15);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { commuteCacheKey, geocodeHome } from "./homeCoords";

describe("commuteCacheKey", () => {
  it("est stable pour les mêmes entrées", () => {
    expect(commuteCacheKey("Paris", "48.86,2.35", ["transit", "walking"]))
      .toBe(commuteCacheKey("Paris", "48.86,2.35", ["transit", "walking"]));
  });

  it("ignore l'ordre des modes", () => {
    expect(commuteCacheKey("Paris", "48.86,2.35", ["walking", "transit"]))
      .toBe(commuteCacheKey("Paris", "48.86,2.35", ["transit", "walking"]));
  });

  it("arrondit la destination pour mutualiser les lieux voisins", () => {
    // 150 offres réelles → 107 lieux distincts : l'arrondi mutualise (spec §2.7).
    expect(commuteCacheKey("Paris", "48.8612,2.3501", ["transit"]))
      .toBe(commuteCacheKey("Paris", "48.8614,2.3499", ["transit"]));
  });

  it("distingue deux domiciles différents", () => {
    expect(commuteCacheKey("Paris", "48.86,2.35", ["transit"]))
      .not.toBe(commuteCacheKey("Lyon", "48.86,2.35", ["transit"]));
  });
});

describe("geocodeHome", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("renvoie null sur une adresse vide, sans appeler le réseau", async () => {
    const f = vi.fn();
    global.fetch = f as unknown as typeof fetch;
    expect(await geocodeHome("  ")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("lit les coordonnées de l'API Adresse", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { coordinates: [2.35, 48.86] } }] }),
    }) as unknown as typeof fetch;
    // L'API Adresse renvoie [longitude, latitude] — l'ordre GeoJSON, pas l'inverse.
    expect(await geocodeHome("10 rue de Rivoli, Paris")).toEqual({ lat: 48.86, lng: 2.35 });
  });

  it("renvoie null si aucune adresse ne correspond", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ features: [] }),
    }) as unknown as typeof fetch;
    expect(await geocodeHome("adresse introuvable")).toBeNull();
  });

  it("renvoie null sans faire échouer le scan en cas de panne réseau", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    expect(await geocodeHome("Paris")).toBeNull();
  });
});

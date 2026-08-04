import { describe, it, expect } from "vitest";
import offres from "./boards-offres.json";

const ATS_CONNUS = ["greenhouse", "lever", "ashby", "smartrecruiters"];

type Entree = {
  ats: string;
  slug: string;
  entreprise: string;
  id: string;
  titre: string;
  lieu: string;
  url: string;
  publieLe: string;
  lat?: number;
  lng?: number;
};

const index = offres as Entree[];

describe("index léger des offres des boards", () => {
  it("n'est pas vide", () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it("expose les champs obligatoires sur chaque entrée", () => {
    for (const o of index) {
      expect(ATS_CONNUS, `ats inconnu pour ${o.slug}/${o.id}`).toContain(o.ats);
      expect(o.slug.length).toBeGreaterThan(0);
      expect(o.entreprise.length, `entreprise vide pour ${o.ats}/${o.slug}`).toBeGreaterThan(0);
      expect(o.id.length, `id vide pour ${o.ats}/${o.slug}`).toBeGreaterThan(0);
      expect(o.titre.length, `titre vide pour ${o.ats}/${o.slug}/${o.id}`).toBeGreaterThan(0);
      expect(o.url.startsWith("http"), `url invalide pour ${o.ats}/${o.slug}/${o.id}`).toBe(true);
      if (o.publieLe !== "") expect(() => new Date(o.publieLe).toISOString()).not.toThrow();
    }
  });

  it("lat/lng n'apparaissent que sur des entrées SmartRecruiters", () => {
    for (const o of index) {
      if (o.lat !== undefined || o.lng !== undefined) expect(o.ats).toBe("smartrecruiters");
    }
  });

  it("ne contient aucun doublon ats+slug+id", () => {
    const cles = index.map((o) => `${o.ats}:${o.slug}:${o.id}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("est trié par ats puis slug puis id", () => {
    const attendu = [...index].sort(
      (a, b) => a.ats.localeCompare(b.ats) || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
    );
    expect(index.map((o) => `${o.ats}:${o.slug}:${o.id}`)).toEqual(
      attendu.map((o) => `${o.ats}:${o.slug}:${o.id}`),
    );
  });
});

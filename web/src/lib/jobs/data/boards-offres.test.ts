import { describe, it, expect } from "vitest";
import offres from "./boards-offres.json";

const ATS_CONNUS = ["greenhouse", "lever", "ashby", "smartrecruiters", "workday"];

type Entree = {
  ats: string;
  slug: string;
  entreprise: string;
  id: string;
  titre: string;
  lieu: string;
  url: string;
  publieLe: string;
  decouverteLe: string;
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
      expect(o.decouverteLe, `decouverteLe invalide pour ${o.ats}/${o.slug}/${o.id}`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    }
  });

  it("lat et lng vont par paire et tombent en France", () => {
    // ⚠️ Ce test exigeait auparavant que seules les entrées SmartRecruiters
    // portent des coordonnées — c'était vrai tant qu'aucun autre ATS n'en
    // fournissait. Depuis le 06/08/2026, `scripts/boards/geo.mjs` géocode les
    // libellés de tous les ATS à la construction de l'index : le filtre par
    // rayon ne pouvait sinon travailler que sur 31 % des offres, et manquait
    // 884 offres de banlieue sur cinq agglomérations (82 à Villeurbanne pour
    // une recherche lyonnaise). Ce qui doit rester vrai, c'est la cohérence
    // des coordonnées elles-mêmes.
    for (const o of index) {
      expect(o.lat === undefined, `lat sans lng pour ${o.ats}/${o.slug}/${o.id}`)
        .toBe(o.lng === undefined);
      if (o.lat === undefined) continue;
      // Métropole et outre-mer compris, bornes larges.
      expect(o.lat, `latitude hors de France pour ${o.ats}/${o.slug}/${o.id}`).toBeGreaterThan(-25);
      expect(o.lat).toBeLessThan(52);
      expect(o.lng, `longitude hors de France pour ${o.ats}/${o.slug}/${o.id}`).toBeGreaterThan(-64);
      expect(o.lng).toBeLessThan(56);
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

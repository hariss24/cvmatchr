import { describe, it, expect } from "vitest";
import boards from "./boards-fr.json";

const ATS_CONNUS = ["greenhouse", "lever", "ashby", "smartrecruiters"];

type Entree = {
  nom: string;
  ats: string;
  slug: string;
  offresFR: number;
  siren: string | null;
  vuLe: string;
};

const index = boards as Entree[];

describe("index des boards français", () => {
  it("n'est pas vide", () => {
    expect(index.length).toBeGreaterThan(0);
  });

  it("expose les six champs sur chaque entrée", () => {
    for (const e of index) {
      expect(typeof e.nom, `nom de ${e.slug}`).toBe("string");
      expect(e.nom.length, `nom vide pour ${e.slug}`).toBeGreaterThan(0);
      expect(typeof e.slug).toBe("string");
      expect(ATS_CONNUS, `ats inconnu pour ${e.slug}`).toContain(e.ats);
      expect(e.siren === null || typeof e.siren === "string").toBe(true);
      expect(e.vuLe, `date mal formée pour ${e.slug}`).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  // Un zéro dans l'index est le symptôme d'une suppression manquée (spec §5) :
  // ce fichier ne doit contenir que des boards qui mènent quelque part.
  it("ne contient aucun board sans offre française", () => {
    for (const e of index) {
      expect(Number.isInteger(e.offresFR), `offresFR non entier pour ${e.slug}`).toBe(true);
      expect(e.offresFR, `${e.slug} est dans l'index avec 0 offre`).toBeGreaterThanOrEqual(1);
    }
  });

  it("ne contient aucun doublon ats+slug", () => {
    const cles = index.map((e) => `${e.ats}:${e.slug}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  // L'ordre doit être déterministe, sinon chaque rafraîchissement produit un
  // diff illisible et la contrainte globale tombe.
  it("est trié par nom puis par ats", () => {
    const attendu = [...index].sort(
      (a, b) => a.nom.localeCompare(b.nom, "fr") || a.ats.localeCompare(b.ats),
    );
    expect(index.map((e) => `${e.nom}/${e.ats}`)).toEqual(attendu.map((e) => `${e.nom}/${e.ats}`));
  });
});

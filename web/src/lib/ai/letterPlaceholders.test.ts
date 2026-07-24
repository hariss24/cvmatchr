import { describe, it, expect } from "vitest";
import { findLetterPlaceholder } from "./letterPlaceholders";

describe("findLetterPlaceholder", () => {
  it("repère les trous en clair réellement produits par l'IA", () => {
    expect(
      findLetterPlaceholder("Lors de mon parcours en tant que Poste occupé chez Entreprise, j'ai appris…"),
    ).toBe("Poste occupé");
    expect(findLetterPlaceholder("j'ai notamment Réalisation marquante avec métrique chiffrée.")).toBe(
      "Réalisation marquante",
    );
    expect(findLetterPlaceholder("J'ai augmenté le trafic de XX %.")).toBe("XX %");
  });

  it("repère les crochets", () => {
    expect(findLetterPlaceholder("mon app [nom du projet] m'a permis…")).toBe("[nom du projet]");
  });

  // Les variables de modèle sont remplies par l'app : les signaler bloquerait toute adaptation.
  it("laisse passer les variables de modèle et un texte propre", () => {
    expect(findLetterPlaceholder("Bonjour {M/Mme Nom}, ma candidature chez {Entreprise} en tant que {Poste}.")).toBeNull();
    expect(findLetterPlaceholder("J'ai piloté la refonte du site chez Nickel, avec 70 % de trafic en plus.")).toBeNull();
  });
});

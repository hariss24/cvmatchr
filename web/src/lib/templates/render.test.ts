import { describe, it, expect } from "vitest";
import { renderTemplate, TEMPLATE_VARIABLES } from "./render";

describe("renderTemplate", () => {
  it("remplace les variables connues", () => {
    expect(
      renderTemplate("un poste de {Poste} au sein de {Entreprise}", {
        Poste: "Développeur",
        Entreprise: "ACME",
      }),
    ).toBe("un poste de Développeur au sein de ACME");
  });

  it("utilise le repli quand la valeur est vide", () => {
    expect(renderTemplate("{M/Mme Nom|Madame, Monsieur},", { "M/Mme Nom": "" }))
      .toBe("Madame, Monsieur,");
    expect(renderTemplate("{M/Mme Nom|Madame, Monsieur},", { "M/Mme Nom": "Madame Dupont" }))
      .toBe("Madame Dupont,");
  });

  it("supprime proprement une variable vide sans repli (ponctuation nettoyée)", () => {
    expect(renderTemplate("Bonjour {M/Mme Nom},", { "M/Mme Nom": "" })).toBe("Bonjour,");
  });

  it("laisse intactes les variables inconnues", () => {
    expect(renderTemplate("texte {Inconnu} ici", {})).toBe("texte {Inconnu} ici");
  });

  it("ne casse pas les sauts de ligne lors du nettoyage", () => {
    expect(renderTemplate("ligne 1 {X}\n\nligne 2", { X: "" })).toBe("ligne 1\n\nligne 2");
  });

  it("expose les 6 variables officielles", () => {
    expect(TEMPLATE_VARIABLES).toEqual([
      "Entreprise", "Poste", "M/Mme Nom", "Prénom", "Nom", "Date",
    ]);
  });
});

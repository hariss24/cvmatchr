import { describe, it, expect } from "vitest";
import { slug, buildPdfFilename } from "./filename";

describe("slug", () => {
  it("réduit accents et ponctuation à de l'ASCII", () => {
    expect(slug("Chargé de projet (H/F)")).toBe("Charge_de_projet_H_F");
    expect(slug("  Développeur  Web  ")).toBe("Developpeur_Web");
  });
});

describe("buildPdfFilename", () => {
  it("nomme le fichier par le type et le poste", () => {
    expect(buildPdfFilename("CV", "Chef de projet digital", false)).toBe(
      "CV_Chef_de_projet_digital",
    );
  });

  it("ajoute la date seulement si elle est demandée", () => {
    const avec = buildPdfFilename("CV", "Webmaster", true);
    expect(avec).toMatch(/^CV_Webmaster_\d{4}-\d{2}-\d{2}$/);
  });

  // Le nom du candidat est déjà dans le document, l'entreprise sert au suivi de
  // candidature : le fichier ne les répète pas.
  it("ne retient ni le nom du candidat ni l'entreprise", () => {
    const nom = buildPdfFilename("CV", "Webmaster", false);
    expect(nom).not.toMatch(/hariss|sharkninja/i);
  });

  it("se contente du type quand le poste manque", () => {
    expect(buildPdfFilename("Lettre", "", false)).toBe("Lettre");
    expect(buildPdfFilename("Lettre", "   ", false)).toBe("Lettre");
  });
});

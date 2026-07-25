import { describe, it, expect } from "vitest";
import { normKey } from "./normKey";

describe("normKey", () => {
  it("ignore la casse et les accents", () => {
    expect(normKey("Société Générale", "Chargé d'Études")).toBe(
      normKey("societe generale", "charge d etudes"),
    );
  });

  it("ignore la ponctuation et les espaces multiples", () => {
    expect(normKey("Leroy-Merlin", "Chef   de projet !")).toBe(
      normKey("Leroy Merlin", "chef de projet"),
    );
  });

  it("sépare entreprise et poste pour éviter les collisions", () => {
    expect(normKey("Alpha", "Beta")).not.toBe(normKey("Beta", "Alpha"));
  });

  it("retourne une clé vide quand entreprise et poste sont vides", () => {
    expect(normKey("", "")).toBe("");
    expect(normKey("   ", "  ")).toBe("");
  });

  it("retourne une clé non vide si un seul des deux champs est rempli", () => {
    expect(normKey("Manpower", "")).not.toBe("");
    expect(normKey("", "Cariste")).not.toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { shouldRenderCompact } from "./primitives";

describe("shouldRenderCompact", () => {
  it("compacte une liste dont tous les éléments sont courts", () => {
    expect(shouldRenderCompact(["Git", "AWS", "Docker", "4G"])).toBe(true);
  });

  it("ne compacte pas dès qu'un seul élément est long", () => {
    expect(
      shouldRenderCompact(["Git", "Configuration des connecteurs d'alerte d'urgence"]),
    ).toBe(false);
  });

  it("ne compacte pas une liste au format « Catégorie — éléments »", () => {
    // Ces lignes sont longues par nature : elles doivent garder une ligne chacune.
    expect(
      shouldRenderCompact([
        "Réseau — TCP/IP, DNS, TLS, firewalls",
        "Cloud — Docker, Kubernetes, AWS",
      ]),
    ).toBe(false);
  });

  it("ne compacte pas une liste d'un seul élément (aucun gain de place)", () => {
    expect(shouldRenderCompact(["Git"])).toBe(false);
  });

  it("ignore les éléments vides pour décider", () => {
    expect(shouldRenderCompact(["Git", "   ", "AWS"])).toBe(true);
  });

  it("ne compacte pas une liste vide", () => {
    expect(shouldRenderCompact([])).toBe(false);
    expect(shouldRenderCompact(["  "])).toBe(false);
  });

  it("accepte un élément pile au seuil de 20 caractères", () => {
    expect("Développement web12".length).toBe(19);
    expect(shouldRenderCompact(["Développement web12", "Git"])).toBe(true);
    expect(shouldRenderCompact(["Développement web123456", "Git"])).toBe(false);
  });
});

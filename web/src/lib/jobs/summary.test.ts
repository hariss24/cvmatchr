import { describe, it, expect } from "vitest";
import { summarizeProfile } from "./summary";
import { parseProfile } from "./profileSchema";

describe("summarizeProfile", () => {
  it("liste postes, lieu avec rayon et contrats", () => {
    const p = parseProfile({
      keywords: ["Webmaster", "Intégrateur web"],
      location: { kind: "commune", code: "75056", label: "Paris (75001)", radiusKm: 20 },
      contractTypes: ["CDI", "CDD"],
    });
    expect(summarizeProfile(p)).toEqual(["Webmaster", "Intégrateur web", "Paris (75001) + 20 km", "CDI, CDD"]);
  });

  it("omet le rayon hors commune", () => {
    const p = parseProfile({
      keywords: ["Webmaster"],
      location: { kind: "region", code: "11", label: "Île-de-France", radiusKm: 20 },
      contractTypes: ["CDI"],
    });
    expect(summarizeProfile(p)).toEqual(["Webmaster", "Île-de-France", "CDI"]);
  });

  it("annonce une recherche nationale sans lieu", () => {
    const p = parseProfile({ keywords: ["Webmaster"], location: { kind: "commune", code: "", label: "", radiusKm: 10 }, contractTypes: [] });
    expect(summarizeProfile(p)).toEqual(["Webmaster", "Toute la France"]);
  });

  it("invite à renseigner un poste quand il n'y en a pas", () => {
    const p = parseProfile({ keywords: [], contractTypes: [] });
    expect(summarizeProfile(p)).toEqual(["Aucun poste renseigné", "Toute la France"]);
  });
});

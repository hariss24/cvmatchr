import { describe, it, expect } from "vitest";
import { atsSlugs } from "./ats";

describe("atsSlugs", () => {
  it("met en minuscules et retire les accents", () => {
    expect(atsSlugs("Société Générale")).toContain("societe-generale");
  });

  it("propose la variante collée en plus de la variante tiretée", () => {
    expect(atsSlugs("Groupe SEB")).toEqual(["groupe-seb", "groupeseb"]);
  });

  it("ne propose qu'un slug quand les deux variantes sont identiques", () => {
    expect(atsSlugs("Doctolib")).toEqual(["doctolib"]);
  });

  it("retire les apostrophes et la ponctuation", () => {
    expect(atsSlugs("L'Oréal S.A.")).toEqual(["l-oreal-s-a", "lorealsa"]);
  });

  it("ne renvoie rien pour un nom vide ou sans lettre", () => {
    expect(atsSlugs("")).toEqual([]);
    expect(atsSlugs("   ")).toEqual([]);
    expect(atsSlugs("---")).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { buildAutofillPackage } from "./autofillPackage";
import { DEFAULT_RESUME } from "@/lib/resume/defaults";

describe("buildAutofillPackage", () => {
  it("mappe l'identité résolue (prénom/nom + champs du CV fusionné)", () => {
    const pkg = buildAutofillPackage({
      identity: {
        prenom: "Hariss",
        nom: "Hafeji",
        cv: { ...DEFAULT_RESUME, email: "h@example.com", phone: "0600000000", location: "Paris", linkedin: "linkedin.com/in/hariss" },
      },
      company: "  SharkNinja  ",
      role: "  Chef de projet  ",
      coverLetterText: "Corps de la lettre.",
      resumeFilename: "CV_Chef_de_projet.pdf",
      resumeBase64: "QkFTRTY0",
      now: 1735689600000,
    });

    expect(pkg).toEqual({
      createdAt: 1735689600000,
      company: "SharkNinja",
      role: "Chef de projet",
      identity: {
        firstName: "Hariss",
        lastName: "Hafeji",
        email: "h@example.com",
        phone: "0600000000",
        location: "Paris",
        linkedin: "linkedin.com/in/hariss",
      },
      coverLetterText: "Corps de la lettre.",
      resume: {
        filename: "CV_Chef_de_projet.pdf",
        mimeType: "application/pdf",
        base64: "QkFTRTY0",
      },
    });
  });

  it("découpe company/role (trim) sans toucher aux autres champs", () => {
    const pkg = buildAutofillPackage({
      identity: { prenom: "", nom: "", cv: DEFAULT_RESUME },
      company: "",
      role: "",
      coverLetterText: "",
      resumeFilename: "CV.pdf",
      resumeBase64: "",
      now: 0,
    });
    expect(pkg.company).toBe("");
    expect(pkg.role).toBe("");
    expect(pkg.identity.firstName).toBe("");
  });
});

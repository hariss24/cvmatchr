import { describe, it, expect } from "vitest";
import { applyProfileToResume, resolveLetterIdentity, EMPTY_PROFILE } from "./profile";
import { DEFAULT_RESUME, type Resume } from "@/lib/resume/schema";

const profile = {
  ...EMPTY_PROFILE,
  prenom: "Jean",
  nom: "Dupont",
  email: "jean@ex.fr",
  telephone: "0600000000",
  ville: "Lyon",
  linkedin: "linkedin.com/in/jd",
};

describe("applyProfileToResume", () => {
  it("remplit les champs placeholder du CV par défaut", () => {
    const r = applyProfileToResume(structuredClone(DEFAULT_RESUME), profile);
    expect(r.name).toBe("Jean Dupont");
    expect(r.email).toBe("jean@ex.fr");
    expect(r.phone).toBe("0600000000");
    expect(r.location).toBe("Lyon");
    expect(r.linkedin).toBe("linkedin.com/in/jd");
  });

  it("n'écrase pas une saisie réelle mais complète les champs restés placeholder", () => {
    const real: Resume = { ...DEFAULT_RESUME, name: "Alice Réel", email: "alice@vrai.fr" };
    const r = applyProfileToResume(real, profile);
    expect(r.name).toBe("Alice Réel");
    expect(r.email).toBe("alice@vrai.fr");
    expect(r.location).toBe("Lyon"); // resté placeholder → rempli
  });

  it("retourne le CV inchangé si le profil est null", () => {
    const r = applyProfileToResume(structuredClone(DEFAULT_RESUME), null);
    expect(r.name).toBe(DEFAULT_RESUME.name);
  });
});

describe("resolveLetterIdentity", () => {
  it("le profil est prioritaire sur le CV chargé", () => {
    const cv: Resume = { ...DEFAULT_RESUME, name: "Alice Réel", email: "alice@vrai.fr", location: "Paris" };
    const id = resolveLetterIdentity(cv, profile);
    expect(id.prenom).toBe("Jean");
    expect(id.nom).toBe("Dupont");
    expect(id.cv.name).toBe("Jean Dupont");
    expect(id.cv.email).toBe("jean@ex.fr");
    expect(id.cv.location).toBe("Lyon");
  });

  it("fallback sur le CV (nom redécoupé) quand le profil est vide", () => {
    const cv: Resume = { ...DEFAULT_RESUME, name: "Alice Martin" };
    const id = resolveLetterIdentity(cv, null);
    expect(id.prenom).toBe("Alice");
    expect(id.nom).toBe("Martin");
    expect(id.cv).toBe(cv);
  });
});

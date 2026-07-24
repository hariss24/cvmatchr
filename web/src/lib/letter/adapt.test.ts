import { describe, it, expect } from "vitest";
import { resolveMeta, buildAdaptedLetter } from "./adapt";
import { DEFAULT_LETTER, DEFAULT_RESUME, type Letter, type Resume } from "@/lib/resume/schema";

const master: Resume = {
  ...DEFAULT_RESUME,
  name: "Hariss Tahet",
  location: "Paris, France",
  email: "hariss@exemple.fr",
  phone: "+33 6 12 34 56 78",
};

/** La lettre telle qu'elle était au moment du bug : en-tête d'une candidature précédente. */
const previousLetter: Letter = {
  ...DEFAULT_LETTER,
  recipient_name: "Darwin Microfluidics",
  recipient_address: "16 rue de l'ancienne boîte, Paris",
  subject: "Candidature au poste de Webmaster chargé de diffusion scientifique",
};

describe("resolveMeta", () => {
  it("l'offre l'emporte sur ce que la barre meta avait gardé", () => {
    const out = resolveMeta(
      { company: "Ministère de l'Intérieur", role: "Chargé de communication" },
      { company: "Darwin Microfluidics", role: "Webmaster" },
    );
    expect(out).toEqual({ company: "Ministère de l'Intérieur", role: "Chargé de communication" });
  });

  it("garde la saisie manuelle quand l'extraction échoue ou revient vide", () => {
    const current = { company: "ACME", role: "Dev" };
    expect(resolveMeta(null, current)).toEqual(current);
    expect(resolveMeta({ company: "", role: "" }, current)).toEqual(current);
  });
});

describe("buildAdaptedLetter", () => {
  const today = "24 juillet 2026";
  const run = (letter: Letter, body = "Corps adapté.", m: Resume | null = master) =>
    buildAdaptedLetter({
      letter,
      body,
      master: m,
      meta: { company: "Ministère de l'Intérieur", role: "Chargé de communication" },
      today,
    });

  it("aligne l'en-tête sur l'offre et oublie la candidature précédente", () => {
    const out = run(previousLetter);
    expect(out.recipient_name).toBe("Ministère de l'Intérieur");
    expect(out.subject).toBe("Candidature au poste de Chargé de communication");
    // L'adresse appartenait à Darwin : la garder afficherait une adresse fausse.
    expect(out.recipient_address).toBe("");
  });

  it("renseigne l'expéditeur depuis le CV Maître", () => {
    const out = run(previousLetter);
    expect(out.sender_name).toBe("Hariss Tahet");
    expect(out.sender_address).toBe("Paris, France");
    expect(out.sender_contact).toBe("hariss@exemple.fr · +33 6 12 34 56 78");
    expect(out.signature).toBe("Hariss Tahet");
    expect(out.date).toBe("Paris, le 24 juillet 2026");
  });

  it("ne piétine pas un expéditeur saisi à la main", () => {
    const out = run({ ...previousLetter, sender_name: "H. T.", sender_contact: "perso@exemple.fr" });
    expect(out.sender_name).toBe("H. T.");
    expect(out.sender_contact).toBe("perso@exemple.fr");
  });

  it("substitue les variables du corps avec les valeurs de l'offre", () => {
    const out = run(previousLetter, "Ma candidature chez {Entreprise} en tant que {Poste}. {Prénom} {Nom}");
    expect(out.body).toBe(
      "Ma candidature chez Ministère de l'Intérieur en tant que Chargé de communication. Hariss Tahet",
    );
  });

  // Sans CV Maître, {Prénom} valait « Prénom » (la valeur d'usine de la signature) et
  // atterrissait tel quel dans la lettre.
  it("n'injecte jamais le « Prénom Nom » d'usine dans le corps", () => {
    const out = run(DEFAULT_LETTER, "Cordialement, {Prénom} {Nom}", null);
    expect(out.body).toBe("Cordialement,");
    expect(out.body).not.toContain("Prénom");
  });

  // Le PDF rendait « Madame, Monsieur, » puis « Bonjour Madame, Monsieur, », et deux
  // formules de politesse à la suite : le corps du modèle porte déjà les siennes.
  it("efface les formules du cadre quand le corps les contient déjà", () => {
    const body = "Bonjour Madame, Monsieur,\n\nMa candidature.\n\nBien cordialement,\n\nHariss Tahet";
    const out = run(previousLetter, body);
    expect(out.greeting).toBe("");
    expect(out.signoff).toBe("");
    expect(out.signature).toBe("");
    expect(out.body).toContain("Bonjour Madame, Monsieur,");
  });

  it("garde les formules du cadre quand le corps n'en a pas", () => {
    const out = run(previousLetter, "Ma candidature, sans appel ni politesse.");
    expect(out.greeting).toBe(DEFAULT_LETTER.greeting);
    expect(out.signoff).toBe(DEFAULT_LETTER.signoff);
    expect(out.signature).toBe("Hariss Tahet");
  });

  it("sans entreprise ni poste résolus, garde l'en-tête existant plutôt que de le vider", () => {
    const out = buildAdaptedLetter({
      letter: previousLetter,
      body: "Corps.",
      master,
      meta: { company: "", role: "" },
      today,
    });
    expect(out.recipient_name).toBe("Darwin Microfluidics");
    expect(out.subject).toBe("Candidature au poste de Webmaster chargé de diffusion scientifique");
    expect(out.recipient_address).toBe("16 rue de l'ancienne boîte, Paris");
  });
});

import { describe, it, expect } from "vitest";
import { DEFAULT_TEMPLATES } from "./defaults";
import { buildLetterFromTemplate } from "./build";
import { DEFAULT_RESUME } from "@/lib/resume/schema";

describe("modèle de départ", () => {
  it("fournit 1 modèle avec un id stable", () => {
    expect(DEFAULT_TEMPLATES.map((t) => t.id)).toEqual(["default-candidature"]);
  });

  it("le corps mentionne l'entreprise, le poste et un repli sur la formule d'appel", () => {
    const t = DEFAULT_TEMPLATES[0];
    expect(t.letterBody).toContain("{Entreprise|vous}");
    expect(t.letterBody).toContain("{Poste|membre de votre équipe}");
    expect(t.letterBody).toContain("{M/Mme Nom|Madame, Monsieur}");
  });
});

describe("buildLetterFromTemplate", () => {
  const tpl = DEFAULT_TEMPLATES[0];
  const cv = { ...DEFAULT_RESUME, name: "Hariss Tahet", location: "Paris, France", email: "h@x.fr", phone: "06" };
  const vars = { Entreprise: "ACME", Poste: "Chef de projet", "M/Mme Nom": "", "Prénom": "Hariss", Nom: "Tahet", Date: "8 juillet 2026" };

  it("assemble une Letter complète depuis le CV et les variables", () => {
    const letter = buildLetterFromTemplate(tpl, vars, cv, "8 juillet 2026");
    expect(letter.sender_name).toBe("Hariss Tahet");
    expect(letter.sender_contact).toBe("h@x.fr · 06");
    expect(letter.date).toBe("Paris, le 8 juillet 2026");
    expect(letter.recipient_name).toBe("ACME");
    expect(letter.subject).toContain("Chef de projet");
    // Le corps porte tout : formule d'appel (repli), texte et signature.
    expect(letter.body).toContain("Madame, Monsieur,");
    expect(letter.body).toContain("ACME");
    expect(letter.body).not.toContain("{Entreprise}");
    expect(letter.body).toContain("Hariss Tahet".split(" ")[0]);
    // greeting/signoff/signature vides : tout est dans le corps.
    expect(letter.greeting).toBe("");
    expect(letter.signoff).toBe("");
    expect(letter.signature).toBe("");
  });

  it("replis corrects quand entreprise inconnue", () => {
    const letter = buildLetterFromTemplate(tpl, { ...vars, Entreprise: "" }, cv, "8 juillet 2026");
    expect(letter.recipient_name).toBe("À l'attention du responsable du recrutement");
  });
});

import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { letterSchema } from "@/lib/resume/schema";
import { DEFAULT_LETTER } from "@/lib/resume/defaults";
import { LetterDocument } from "./LetterDocument";
import { extractPdfText } from "./extractText";

async function textOf(letter = DEFAULT_LETTER): Promise<string> {
  const buf = await renderToBuffer(<LetterDocument letter={letter} />);
  expect(Buffer.from(buf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  const pages = await extractPdfText(new Uint8Array(buf));
  return pages.join("\n");
}

describe("LetterDocument", () => {
  it("rend la lettre par défaut : en-têtes, objet, corps, signature", async () => {
    const text = await textOf();

    // Bloc destinataire (gauche) et expéditeur (droite).
    expect(text).toContain("Nom de l'entreprise");
    expect(text).toContain("Service Recrutement");
    expect(text).toContain("Prénom Nom");
    expect(text).toContain("Adresse, Ville");
    expect(text).toContain("Ville, le JJ/MM/AAAA");

    // Objet en gras (l'extraction voit le texte), salutation, les 3 paragraphes du corps.
    expect(text).toContain("Objet : Candidature au poste de [Intitulé du poste]");
    expect(text).toContain("Madame, Monsieur,");
    expect(text).toContain("[Accroche");
    expect(text).toContain("[Argumentaire");
    expect(text).toContain("[Conclusion");

    // Formule de politesse et signature. Le libellé exact est dérivé du modèle : ce test
    // vérifie que le champ `signoff` est bien rendu, pas quelle politesse on a choisie.
    expect(text).toContain(DEFAULT_LETTER.signoff);
    expect(text).toContain("Prénom Nom");
  });



  it("filtre les lignes vides du corps et tolère une lettre minimale", async () => {
    const text = await textOf(
      letterSchema.parse({
        sender_name: "Jean Test",
        body: "Premier paragraphe.\n\n\nDeuxième paragraphe.",
        signature: "Jean Test",
      }),
    );
    expect(text).toContain("Jean Test");
    expect(text).toContain("Premier paragraphe.");
    expect(text).toContain("Deuxième paragraphe.");
    // Champs vides : pas de libellé fantôme.
    expect(text).not.toContain("Objet :");
  });
});

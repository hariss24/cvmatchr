import { describe, it, expect } from "vitest";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { extractPdfText } from "./extractText";

describe("fondations react-pdf", () => {
  it("rend un PDF valide en Node avec Roboto et le français couvert", async () => {
    registerPdfFonts();
    const buf = await renderToBuffer(
      <Document>
        <Page size="A4">
          <Text style={{ fontFamily: "Roboto", fontWeight: 700 }}>
            Vérification typographique : é à ç œ — « guillemets »
          </Text>
          <Text style={{ fontFamily: "Inter" }}>Lettre de motivation</Text>
        </Page>
      </Document>,
    );

    // Signature PDF réelle, générée sans Chromium.
    expect(Buffer.from(buf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");

    // Le texte (accents et ligatures inclus) est bien encodé dans le PDF.
    const pages = await extractPdfText(new Uint8Array(buf));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain("Vérification typographique");
    expect(pages[0]).toContain("é à ç œ");
    expect(pages[0]).toContain("Lettre de motivation");
  });
});

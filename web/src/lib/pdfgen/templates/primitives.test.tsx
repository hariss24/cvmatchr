import { describe, it, expect } from "vitest";
import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { shouldRenderCompact, SectionContent } from "./primitives";
import { extractPdfText } from "../extractText";

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

  it("accepte un élément pile au seuil de 20 caractères, refuse à 21", () => {
    const pile = "a".repeat(20);
    const troplong = "a".repeat(21);
    expect(pile.length).toBe(20);
    expect(troplong.length).toBe(21);
    expect(shouldRenderCompact([pile, "Git"])).toBe(true);
    expect(shouldRenderCompact([troplong, "Git"])).toBe(false);
  });
});

describe("SectionContent (mode compact) — rendu réel", () => {
  it("n'émet aucune puce orpheline pour un élément vide de la liste", async () => {
    // `shouldRenderCompact` ignore les éléments vides pour DÉCIDER (ci-dessus), mais la
    // branche de rendu doit elle aussi les ignorer pour AFFICHER, sous peine de puce
    // orpheline ("• " sans texte) pour l'entrée blanche.
    const items = ["Git", "   ", "AWS"];
    const buf = await renderToBuffer(
      <Document>
        <Page size="A4">
          <SectionContent
            section={{ id: "s", title: "Compétences", kind: "list", items }}
            compact
          />
        </Page>
      </Document>,
    );
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");

    // Autant de puces que d'éléments NON vides — pas une de plus pour l'entrée blanche.
    const nbPuces = (text.match(/•/g) ?? []).length;
    expect(nbPuces).toBe(items.filter((i) => i.trim()).length);
    expect(text).toContain("Git");
    expect(text).toContain("AWS");
  });
});

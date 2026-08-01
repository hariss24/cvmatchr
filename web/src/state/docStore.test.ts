import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore } from "./docStore";
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
import * as pdfGen from "@/lib/pdfgen/generatePdf";

// Réinitialise le store avant chaque test (CV / sobre / défaut).
beforeEach(() => {
  useDocStore.getState().setDocType("CV");
  useDocStore.getState().setTemplate("sobre");
});

describe("useDocStore", () => {
  it("démarre sur un CV sobre rendu depuis DEFAULT_RESUME", () => {
    const s = useDocStore.getState();
    expect(s.docType).toBe("CV");
    expect(s.templateId).toBe("sobre");
  });

  it("setJson met à jour json", () => {
    useDocStore.getState().setJson({ ...DEFAULT_RESUME, name: "Zoé Test" });
    const s = useDocStore.getState();
    expect((s.json as { name: string }).name).toBe("Zoé Test");
  });

  it("setDocType bascule vers Lettre", () => {
    useDocStore.getState().setDocType("Lettre");
    const s = useDocStore.getState();
    expect(s.docType).toBe("Lettre");
  });

  it("setTemplate change le templateId du document", () => {
    useDocStore.getState().setTemplate("graphique");
    const s = useDocStore.getState();
    expect(s.templateId).toBe("graphique");
  });
});

describe("generatePdf", () => {
  it("exporte generateLetterPdfBlob", () => {
    expect(pdfGen.generateLetterPdfBlob).toBeDefined();
  });
});

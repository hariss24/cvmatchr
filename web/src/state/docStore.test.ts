import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore, docEngine } from "./docStore";
import { DEFAULT_RESUME } from "@/lib/resume/schema";
import { TEMPLATES } from "@/lib/resume/templates";

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
    expect(s.html).toContain(DEFAULT_RESUME.name);
    expect(s.css).toBe(TEMPLATES.sobre.css);
  });

  it("setJson met à jour json ET re-rend le html", () => {
    useDocStore.getState().setJson({ ...DEFAULT_RESUME, name: "Zoé Test" });
    const s = useDocStore.getState();
    expect((s.json as { name: string }).name).toBe("Zoé Test");
    expect(s.html).toContain("Zoé Test");
  });

  it("setDocType bascule vers Lettre et rend le markup de lettre", () => {
    useDocStore.getState().setDocType("Lettre");
    const s = useDocStore.getState();
    expect(s.docType).toBe("Lettre");
    expect(s.html).toContain("Objet :");
  });

  it("setTemplate change le css du document", () => {
    useDocStore.getState().setTemplate("moderne");
    const s = useDocStore.getState();
    expect(s.templateId).toBe("moderne");
    expect(s.css).toBe(TEMPLATES.moderne.css);
  });

  it("setHtml et setCss écrasent directement (mode expert)", () => {
    useDocStore.getState().setHtml("<p>direct</p>");
    useDocStore.getState().setCss("body{color:red}");
    const s = useDocStore.getState();
    expect(s.html).toBe("<p>direct</p>");
    expect(s.css).toBe("body{color:red}");
  });

  it("setHtml marque le HTML comme source de vérité ; setJson et setDocType la rendent au JSON (C1)", () => {
    expect(useDocStore.getState().htmlSource).toBe(false);
    useDocStore.getState().setHtml("<p>expert</p>");
    expect(useDocStore.getState().htmlSource).toBe(true);
    useDocStore.getState().setJson({ ...DEFAULT_RESUME, name: "Retour Formulaire" });
    expect(useDocStore.getState().htmlSource).toBe(false);
    useDocStore.getState().setHtml("<p>expert 2</p>");
    useDocStore.getState().setDocType("Lettre");
    expect(useDocStore.getState().htmlSource).toBe(false);
  });
});

describe("docEngine", () => {
  it("choisit react-pdf pour un CV en template graphique (json fiable)", () => {
    expect(docEngine({ docType: "CV", templateId: "graphique", htmlSource: false })).toBe("pdf");
    expect(docEngine({ docType: "Maître", templateId: "graphique", htmlSource: false })).toBe("pdf");
  });

  it("reste en HTML pour la Lettre, les templates non portés et le mode expert", () => {
    expect(docEngine({ docType: "Lettre", templateId: "graphique", htmlSource: false })).toBe("html");
    expect(docEngine({ docType: "CV", templateId: "sobre", htmlSource: false })).toBe("html");
    // htmlSource : le HTML a été édité directement → json périmé, on n'en rend pas un PDF.
    expect(docEngine({ docType: "CV", templateId: "graphique", htmlSource: true })).toBe("html");
  });
});

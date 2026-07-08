import { describe, it, expect } from "vitest";
import { TEMPLATES, TEMPLATE_IDS } from "./templates";

describe("TEMPLATES", () => {
  it("expose les 4 modèles attendus", () => {
    expect(TEMPLATE_IDS.sort()).toEqual(
      ["graphique", "kakuna", "marine", "sobre"],
    );
  });

  it("chaque modèle a un html et un css non vides", () => {
    for (const id of TEMPLATE_IDS) {
      expect(typeof TEMPLATES[id].html).toBe("string");
      expect(TEMPLATES[id].html.length).toBeGreaterThan(0);
      expect(typeof TEMPLATES[id].css).toBe("string");
      expect(TEMPLATES[id].css.length).toBeGreaterThan(0);
    }
  });

  it("le modèle sobre rend la structure resume-template-1", () => {
    expect(TEMPLATES.sobre.html).toContain("resume-template-1 resume-template-renderer");
    expect(TEMPLATES.sobre.css).toContain("@page");
  });
});

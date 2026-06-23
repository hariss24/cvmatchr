import { describe, it, expect } from "vitest";
import { mergeHtml } from "./mergeHtml";

describe("mergeHtml", () => {
  it("retourne le HTML brut si le CSS est vide", () => {
    expect(mergeHtml("<p>hi</p>", "   ")).toBe("<p>hi</p>");
  });

  it("enveloppe un fragment dans un document complet avec le <style>", () => {
    const out = mergeHtml("<p>hi</p>", "p{color:red}");
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain("<style>");
    expect(out).toContain("p{color:red}");
    expect(out).toContain("<p>hi</p>");
  });

  it("injecte le <style> avant </head> si le HTML a déjà un head", () => {
    const out = mergeHtml("<html><head></head><body>x</body></html>", "a{}");
    expect(out).toContain("<style>\na{}\n</style>\n</head>");
    expect(out.match(/<!DOCTYPE/i)).toBeNull();
  });

  it("neutralise une fermeture prématurée de </style>", () => {
    const out = mergeHtml("<p>x</p>", "p::before{content:'</style>'}");
    expect(out).not.toContain("'</style>'");
    expect(out).toContain("<\\/style>");
  });
});

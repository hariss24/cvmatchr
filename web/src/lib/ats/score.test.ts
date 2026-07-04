import { describe, it, expect } from "vitest";
import { extractKeywords, detectSections, analyzeAts, applyAtsBoost } from "./score";

describe("extractKeywords", () => {
  it("ignore les stop-words, les balises et les mots < 3 caractères", () => {
    const kw = extractKeywords("<p>Nous recherchons un développeur React et Python</p>");
    expect(kw).toContain("developpeur");
    expect(kw).toContain("react");
    expect(kw).toContain("python");
    expect(kw).not.toContain("nous");
    expect(kw).not.toContain("recherchons");
    expect(kw).not.toContain("un");
    expect(kw).not.toContain("et");
  });

  it("normalise les composés (machine learning → machine-learning)", () => {
    expect(extractKeywords("expert en machine learning")).toContain("machine-learning");
    expect(extractKeywords("maîtrise de next js")).toContain("nextjs");
  });

  it("déduplique et retire les accents", () => {
    const kw = extractKeywords("Développeur développeur DÉVELOPPEUR");
    expect(kw.filter((w) => w === "developpeur")).toHaveLength(1);
  });
});

describe("detectSections", () => {
  it("repère les sections par leurs titres", () => {
    const html = "<h2>Expériences</h2><h2>Compétences</h2>";
    const s = detectSections(html);
    expect(s["Expériences"]).toBe(true);
    expect(s["Compétences"]).toBe(true);
    expect(s["Langues"]).toBe(false);
  });
});

describe("analyzeAts", () => {
  it("calcule un score = ratio de mots-clés présents", () => {
    const job = "React Python Docker Kubernetes";
    const cv = "<p>Développeur React et Python</p>";
    const a = analyzeAts(cv, job);
    // 4 mots-clés offre, 2 présents → 50.
    expect(a.score).toBe(50);
    expect(a.matched).toContain("react");
    expect(a.matched).toContain("python");
    expect(a.missing).toContain("docker");
    expect(a.missing).toContain("kubernetes");
  });

  it("matche les pluriels simples (> 4 lettres : tests → test)", () => {
    const a = analyzeAts("<p>écriture de test unitaire</p>", "tests");
    expect(a.matched).toContain("tests");
  });

  it("matche les composés dans le CV (« Power BI » ↔ mot-clé « powerbi »)", () => {
    const a = analyzeAts("<p>Dashboards Power BI et Machine Learning</p>", "Power BI machine learning");
    expect(a.matched).toContain("powerbi");
    expect(a.matched).toContain("machine-learning");
    expect(a.missing).toHaveLength(0);
  });

  it("boostKeywords remplace les tirets par des espaces", () => {
    const a = analyzeAts("<p>rien</p>", "machine learning");
    expect(a.boostKeywords).toContain("machine learning");
  });

  it("score 0 si l'offre n'a aucun mot-clé", () => {
    expect(analyzeAts("<p>x</p>", "le la les de").score).toBe(0);
  });
});

describe("applyAtsBoost", () => {
  it("renvoie le HTML inchangé sans mots-clés", () => {
    expect(applyAtsBoost("<body>x</body>", [])).toBe("<body>x</body>");
  });

  it("injecte un span invisible juste avant </body>", () => {
    const out = applyAtsBoost("<html><body><p>cv</p></body></html>", ["docker", "kubernetes"]);
    expect(out).toContain('font-size:1px;color:#ffffff');
    expect(out).toContain("docker kubernetes");
    expect(out).toMatch(/docker kubernetes<\/span><\/body>/);
  });

  it("ajoute en fin de document si pas de </body>", () => {
    const out = applyAtsBoost("<p>cv</p>", ["react"]);
    expect(out.endsWith("</span>")).toBe(true);
  });

  it("échappe les caractères HTML des mots-clés", () => {
    const out = applyAtsBoost("<body></body>", ["c++ & <go>"]);
    expect(out).toContain("c++ &amp; &lt;go&gt;");
  });
});

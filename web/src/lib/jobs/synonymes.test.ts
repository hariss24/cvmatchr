import { describe, it, expect } from "vitest";
import {
  construireCriteres,
  satisfait,
  meilleurCritere,
} from "./synonymes";

describe("Critères conjonctifs (synonymes)", () => {
  it("ne remplace jamais un mot-clé précis par le terme générique qui l'a déclenché", () => {
    const criteres = construireCriteres(["chef de projet marketing"]);
    // Le piège : « chef de projet » seul atteint 380 titres de l'index,
    // « chef de projet marketing » en atteint 7. Mesuré le 18/08/2026.
    expect(criteres.some((c) => c.termes.length === 1 && c.termes[0] === "chef de projet")).toBe(false);
    expect(satisfait("CDD - Chef de projet Achats - Parfums Beaute", criteres[0])).toBe(false);
    expect(criteres.some((c) => satisfait("Marketing Project Manager", c))).toBe(true);
  });

  it("laisse intact un mot-clé générique", () => {
    const criteres = construireCriteres(["developpeur"]);
    expect(criteres.some((c) => satisfait("Software Engineer - Paris", c))).toBe(true);
  });

  it("ramène l'intitulé anglais d'un métier cherché en français", () => {
    // Équivalent critères du test historique : « développeur » produit des critères
    // contenant « software engineer » et « developer ».
    const criteres = construireCriteres(["développeur"]);
    expect(criteres.some((c) => c.termes.includes("software engineer"))).toBe(true);
    expect(criteres.some((c) => c.termes.includes("developer"))).toBe(true);
  });

  it("garde les mots-clés d'origine comme critères littéraux, en tête", () => {
    // Un élargissement ne doit jamais faire perdre un résultat que la recherche littérale aurait trouvé.
    const criteres = construireCriteres(["ingénieur", "aéronautique"]);
    expect(criteres[0].litteral).toBe(true);
    expect(criteres[0].termes).toEqual(["ingenieur"]);
    expect(criteres[1].litteral).toBe(true);
    expect(criteres[1].termes).toEqual(["aeronautique"]);
    expect(criteres.some((c) => c.termes.includes("engineer"))).toBe(true);
  });

  it("fonctionne dans les deux sens : un mot anglais ramène le français", () => {
    const criteresIng = construireCriteres(["engineer"]);
    expect(criteresIng.some((c) => c.termes.includes("ingenieur"))).toBe(true);
    const criteresSales = construireCriteres(["sales"]);
    expect(criteresSales.some((c) => c.termes.includes("commercial"))).toBe(true);
  });

  it("reconnaît le métier à l'intérieur d'un intitulé plus long", () => {
    // « responsable marketing » déclenche le groupe marketing et produit « marketing manager »
    const criteres = construireCriteres(["responsable marketing"]);
    expect(criteres.some((c) => c.termes.includes("marketing manager"))).toBe(true);
    expect(criteres.some((c) => c.termes.includes("head of marketing"))).toBe(true);
  });

  it("un niveau hiérarchique seul ne ramène aucun équivalent", () => {
    // « responsable », « manager », etc. ne déclenchent aucun groupe
    expect(construireCriteres(["responsable"])).toHaveLength(1);
    expect(construireCriteres(["responsable"])[0].termes).toEqual(["responsable"]);
    expect(construireCriteres(["manager"])).toHaveLength(1);
    expect(construireCriteres(["directeur"])).toHaveLength(1);
    expect(construireCriteres(["head of"])).toHaveLength(1);
  });

  it("« growth » seul ne ramène pas des postes de marketing", () => {
    const criteres = construireCriteres(["marketing digital"]);
    expect(criteres.some((c) => c.termes.length === 1 && c.termes[0] === "growth")).toBe(false);
    expect(criteres.some((c) => c.termes.includes("growth marketing"))).toBe(true);
  });

  it("n'ajoute rien pour un mot-clé sans équivalent connu", () => {
    const criteres = construireCriteres(["soudeur"]);
    expect(criteres).toHaveLength(1);
    expect(criteres[0].termes).toEqual(["soudeur"]);
    expect(construireCriteres([])).toEqual([]);
  });

  it("ne rend aucun doublon, quelle que soit la casse ou l'accent", () => {
    const criteres = construireCriteres(["Ingénieur", "ingenieur", "INGENIEUR"]);
    const signatures = criteres.map((c) => c.termes.slice().sort().join("|"));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("un mot-clé très court ne déclenche pas tous les groupes", () => {
    expect(construireCriteres(["a"])).toHaveLength(1);
    expect(construireCriteres(["de"])).toHaveLength(1);
  });

  it("« chef » seul ne ramène pas des postes d'encadrement, ni l'inverse", () => {
    expect(construireCriteres(["chef"])).toHaveLength(1);
    const criteresChefProjet = construireCriteres(["chef de projet"]);
    expect(criteresChefProjet.some((c) => c.termes.includes("project manager"))).toBe(true);
    expect(criteresChefProjet.some((c) => c.termes.includes("cook"))).toBe(false);
  });

  it("les termes composés sont préservés tels quels pour rester précis", () => {
    const criteres = construireCriteres(["commercial"]);
    expect(criteres.some((c) => c.termes.includes("account executive"))).toBe(true);
    expect(criteres.some((c) => c.termes.includes("account"))).toBe(false);
  });

  it("« sécurité informatique » ne ramène pas de postes HSE", () => {
    const criteres = construireCriteres(["sécurité informatique"]);
    expect(criteres.some((c) => c.termes.includes("cybersecurity"))).toBe(true);
    expect(criteres.some((c) => c.termes.includes("hse"))).toBe(false);
    expect(criteres.some((c) => c.termes.includes("safety"))).toBe(false);
  });

  it("« données » ne ramène pas le mot « data » seul", () => {
    const criteres = construireCriteres(["données"]);
    expect(criteres.some((c) => c.termes.length === 1 && c.termes[0] === "data")).toBe(false);
    expect(criteres.some((c) => c.termes.includes("data analyst"))).toBe(true);
  });

  describe("meilleurCritere", () => {
    it("privilégie le critère littéral sur un critère élargi", () => {
      const criteres = construireCriteres(["marketing digital"]);
      const titre = "Responsable Marketing Digital et Growth";
      const meilleur = meilleurCritere(titre, criteres);
      expect(meilleur).not.toBeNull();
      expect(meilleur?.litteral).toBe(true);
      expect(meilleur?.origine).toBe("marketing digital");
    });

    it("retourne le premier critère élargi satisfait si aucun littéral ne matche", () => {
      const criteres = construireCriteres(["marketing digital"]);
      const titre = "Senior Digital Marketing Manager";
      const meilleur = meilleurCritere(titre, criteres);
      expect(meilleur).not.toBeNull();
      expect(meilleur?.litteral).toBe(false);
      expect(meilleur?.termes).toContain("digital marketing");
    });

    it("retourne null si aucun critère n'est satisfait", () => {
      const criteres = construireCriteres(["marketing digital"]);
      const titre = "Chef de projet HVAC";
      expect(meilleurCritere(titre, criteres)).toBeNull();
    });
  });
});

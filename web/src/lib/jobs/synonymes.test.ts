import { describe, it, expect } from "vitest";
import { elargirMotsCles } from "./synonymes";

describe("elargirMotsCles", () => {
  it("ramène l'intitulé anglais d'un métier cherché en français", () => {
    // ⚠️ Cas mesuré le 06/08/2026 : « développeur » trouvait 293 offres et en
    // laissait 434 invisibles, toutes intitulées en anglais.
    const r = elargirMotsCles(["développeur"]);
    expect(r).toContain("software engineer");
    expect(r).toContain("developer");
  });

  it("garde les mots-clés d'origine, en tête", () => {
    // Un élargissement ne doit jamais faire perdre un résultat que la recherche
    // littérale aurait trouvé.
    const r = elargirMotsCles(["ingénieur", "aéronautique"]);
    expect(r[0]).toBe("ingénieur");
    expect(r[1]).toBe("aéronautique");
    expect(r).toContain("engineer");
  });

  it("fonctionne dans les deux sens : un mot anglais ramène le français", () => {
    expect(elargirMotsCles(["engineer"])).toContain("ingenieur");
    expect(elargirMotsCles(["sales"])).toContain("commercial");
  });

  it("reconnaît le métier à l'intérieur d'un intitulé plus long", () => {
    const r = elargirMotsCles(["responsable marketing"]);
    expect(r).toContain("manager");
    expect(r).toContain("head of");
  });

  it("n'ajoute rien pour un mot-clé sans équivalent connu", () => {
    expect(elargirMotsCles(["soudeur"])).toEqual(["soudeur"]);
    expect(elargirMotsCles([])).toEqual([]);
  });

  it("ne rend aucun doublon, quelle que soit la casse ou l'accent", () => {
    const r = elargirMotsCles(["Ingénieur", "ingenieur", "INGENIEUR"]);
    const vus = r.map((m) => m.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
    expect(new Set(vus).size).toBe(vus.length);
  });

  it("un mot-clé très court ne déclenche pas tous les groupes", () => {
    // ⚠️ Sans plancher, « a » est contenu dans « sales », « data », « manager »
    // et la recherche rendrait n'importe quoi.
    expect(elargirMotsCles(["a"])).toEqual(["a"]);
    expect(elargirMotsCles(["de"])).toEqual(["de"]);
  });

  it("« chef » seul ne ramène pas des postes d'encadrement, ni l'inverse", () => {
    // ⚠️ « chef » désigne un responsable en français et un cuisinier en
    // anglais. Les groupes n'emploient que des expressions pour ce mot.
    expect(elargirMotsCles(["chef"])).toEqual(["chef"]);
    expect(elargirMotsCles(["chef de projet"])).toContain("project manager");
    expect(elargirMotsCles(["chef de projet"])).not.toContain("cook");
  });

  it("les termes composés sont préservés tels quels pour rester précis", () => {
    // « account executive » comme mot-clé cherche l'expression entière dans le
    // titre : c'est ce qui évite qu'« account » ramène « accounting ».
    const r = elargirMotsCles(["commercial"]);
    expect(r).toContain("account executive");
    expect(r).not.toContain("account");
  });
});

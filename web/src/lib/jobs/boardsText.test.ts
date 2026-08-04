import { describe, it, expect } from "vitest";
import { obtenirTextes, texteBrut, type FetchLike } from "./boardsText";
import type { OffreLegere } from "./boardsFr";

function offre(partial: Partial<OffreLegere>): OffreLegere {
  return {
    ats: "greenhouse",
    slug: "onrunning",
    entreprise: "On Running",
    id: "1",
    titre: "T",
    lieu: "Paris",
    url: "https://x",
    publieLe: "",
    decouverteLe: "2026-08-04",
    ...partial,
  };
}

/** `fetch` factice : une réponse par fragment d'URL. */
function fauxFetch(reponses: Record<string, unknown>): FetchLike {
  return async (url: string) => {
    const cle = Object.keys(reponses).find((k) => url.includes(k));
    if (!cle) return new Response("", { status: 404 });
    return new Response(JSON.stringify(reponses[cle]), { status: 200 });
  };
}

describe("texteBrut", () => {
  it("décode le HTML encodé en entités de Greenhouse", () => {
    // Forme réelle vérifiée en direct le 04/08/2026 sur capfigroupe.
    const brut = "&lt;p&gt;&lt;span style=&quot;font-weight: 400;&quot;&gt;CAPFI est une ESN&lt;/span&gt;&lt;/p&gt;";
    expect(texteBrut(brut)).toBe("CAPFI est une ESN");
  });

  it("retire les balises du HTML direct de SmartRecruiters", () => {
    expect(texteBrut('<p>ALTEN joue un rôle dans <a href="https://x">les secteurs</a>.</p>'))
      .toBe("ALTEN joue un rôle dans les secteurs .");
  });

  it("garde les sauts de ligne des listes et des paragraphes", () => {
    expect(texteBrut("<ul><li>Java</li><li>Angular</li></ul>")).toBe("Java\nAngular");
  });

  it("traite les entités révélées par le premier décodage", () => {
    // Chez Greenhouse tout est encodé une fois : les balises comme les entités
    // qu'elles contiennent. `&amp;nbsp;` ne redevient `&nbsp;` qu'au 1er passage,
    // et n'est donc traitable qu'au second.
    expect(texteBrut("&lt;p&gt;R&amp;D&amp;nbsp;&lt;/p&gt;")).toBe("R&D");
  });

  it("décode les entités numériques", () => {
    expect(texteBrut("R&#38;D et l&#39;équipe")).toBe("R&D et l'équipe");
  });

  it("ne laisse pas passer le contenu d'un script", () => {
    expect(texteBrut("<p>Poste</p><script>alert(1)</script>")).toBe("Poste");
  });

  it("un texte déjà propre traverse sans dommage", () => {
    expect(texteBrut("Ingénieur logiciel — Paris")).toBe("Ingénieur logiciel — Paris");
  });
});

describe("obtenirTextes", () => {
  it("Greenhouse : un appel par offre, endpoint par id avec content=true", async () => {
    let appels = 0;
    const f: FetchLike = async (url) => {
      appels += 1;
      expect(url).toContain("jobs/1?content=true");
      return new Response(JSON.stringify({ content: "<p>Description complète</p>" }), { status: 200 });
    };
    const r = await obtenirTextes([offre({ ats: "greenhouse", id: "1" })], f);
    expect(r.get("greenhouse:onrunning:1")).toContain("Description complète");
    expect(appels).toBe(1);
  });

  it("SmartRecruiters : un appel par offre, sections concaténées", async () => {
    const f = fauxFetch({
      "postings/1": {
        jobAd: {
          sections: {
            companyDescription: { text: "À propos" },
            jobDescription: { text: "Le poste" },
            qualifications: { text: "Profil" },
          },
        },
      },
    });
    const r = await obtenirTextes([offre({ ats: "smartrecruiters", slug: "accor", id: "1" })], f);
    const texte = r.get("smartrecruiters:accor:1") ?? "";
    expect(texte).toContain("À propos");
    expect(texte).toContain("Le poste");
    expect(texte).toContain("Profil");
  });

  it("Lever : un seul appel pour deux offres du même board", async () => {
    let appels = 0;
    const f: FetchLike = async () => {
      appels += 1;
      return new Response(
        JSON.stringify([
          { id: "a", descriptionPlain: "Texte A" },
          { id: "b", descriptionPlain: "Texte B" },
        ]),
        { status: 200 },
      );
    };
    const r = await obtenirTextes(
      [
        offre({ ats: "lever", slug: "contentsquare", id: "a" }),
        offre({ ats: "lever", slug: "contentsquare", id: "b" }),
      ],
      f,
    );
    expect(r.get("lever:contentsquare:a")).toBe("Texte A");
    expect(r.get("lever:contentsquare:b")).toBe("Texte B");
    expect(appels).toBe(1);
  });

  it("Ashby : un seul appel pour deux offres du même board", async () => {
    let appels = 0;
    const f: FetchLike = async () => {
      appels += 1;
      return new Response(
        JSON.stringify({
          jobs: [
            { id: "x", descriptionPlain: "Texte X" },
            { id: "y", descriptionPlain: "Texte Y" },
          ],
        }),
        { status: 200 },
      );
    };
    const r = await obtenirTextes(
      [offre({ ats: "ashby", slug: "alan", id: "x" }), offre({ ats: "ashby", slug: "alan", id: "y" })],
      f,
    );
    expect(r.get("ashby:alan:x")).toBe("Texte X");
    expect(r.get("ashby:alan:y")).toBe("Texte Y");
    expect(appels).toBe(1);
  });

  it("une offre en échec réseau est absente du résultat, les autres restent servies", async () => {
    const f: FetchLike = async (url) => {
      if (url.includes("greenhouse")) throw new Error("ECONNRESET");
      return new Response(JSON.stringify({ jobAd: { sections: { jobDescription: { text: "OK" } } } }), {
        status: 200,
      });
    };
    const r = await obtenirTextes(
      [offre({ ats: "greenhouse", id: "1" }), offre({ ats: "smartrecruiters", slug: "accor", id: "2" })],
      f,
    );
    expect(r.has("greenhouse:onrunning:1")).toBe(false);
    expect(r.get("smartrecruiters:accor:2")).toContain("OK");
  });
});

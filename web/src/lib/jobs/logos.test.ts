import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeCompany, tldPlausible, domaineProche, domainCandidates, titreConfirme,
  logoUrlFor, resolveDomain, withCompanyLogos,
} from "./logos";

const offre = (company: string, logoUrl = "") => ({ company, logoUrl });

/**
 * Sert de faux internet : une page par domaine, tout le reste injoignable.
 * `null` en guise de page = un serveur qui répond mais refuse de la livrer (403).
 */
function stubWeb(sites: Record<string, string | null>, annuaire: Record<string, unknown[]> = {}) {
  const appels: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    appels.push(url);
    const marques = Object.entries(annuaire).find(([n]) => url.includes(encodeURIComponent(n)));
    if (url.startsWith("https://api.brandfetch.io")) {
      return { ok: true, json: async () => marques?.[1] ?? [] };
    }
    const domaine = url.replace("https://", "").replace(/\/$/, "");
    const html = sites[domaine];
    if (html === undefined) throw new Error("injoignable");
    if (html === null) return { ok: false, text: async () => "" };
    return { ok: true, text: async () => html };
  }));
  return appels;
}

describe("normalizeCompany", () => {
  it("ramène les graphies d'une même entreprise à une seule clé", () => {
    expect(normalizeCompany("ACME SAS")).toBe(normalizeCompany("Acme"));
    expect(normalizeCompany("Fed  Group")).toBe("fed group");
  });
});

describe("tldPlausible", () => {
  // Le cas qui a produit un faux logo en production : « Nexton » existe aussi au
  // Pakistan et au Japon. Une offre parisienne ne renvoie pas vers ces sites.
  it("écarte les extensions de pays étrangers", () => {
    expect(tldPlausible("nexton.com.pk")).toBe(false);
    expect(tldPlausible("nexton-net.jp")).toBe(false);
    expect(tldPlausible("skolae-formacao.pt")).toBe(false);
  });

  it("accepte les extensions du marché visé", () => {
    for (const d of ["skolae.fr", "nexton-group.com", "escp.eu", "collective.work"]) {
      expect(tldPlausible(d)).toBe(true);
    }
  });
});

describe("domaineProche", () => {
  // Cas réel : l'annuaire propose le blog d'ESCP, dont le logo n'est pas celui
  // de l'école. Le nom y figure pourtant bien.
  it("écarte une annexe dont le domaine noie le nom", () => {
    expect(domaineProche("escpbachelorblog.com", "ESCP Business School")).toBe(false);
  });

  it("accepte un domaine plus court que le nom", () => {
    expect(domaineProche("covea.com", "Groupe Covéa")).toBe(true);
  });

  it("tolère un suffixe court et les tirets", () => {
    expect(domaineProche("fed-group.fr", "Fed Group")).toBe(true);
    expect(domaineProche("nexton-group.com", "Nexton")).toBe(true);
  });
});

describe("domainCandidates", () => {
  it("essaie le nom collé puis tireté, en .fr d'abord", () => {
    expect(domainCandidates("Fed Group")).toEqual([
      "fedgroup.fr", "fedgroup.com", "fed-group.fr", "fed-group.com",
    ]);
  });

  it("reconnaît une raison sociale qui est déjà un domaine", () => {
    expect(domainCandidates("Collective.work")[0]).toBe("collective.work");
  });

  it("ne propose rien d'exploitable pour un nom trop court", () => {
    expect(domainCandidates("AB")).toEqual([]);
  });
});

describe("titreConfirme", () => {
  it("reconnaît le nom malgré les espaces et la casse", () => {
    expect(titreConfirme("Teaminside : 100% digitale", "TEAM INSIDE")).toBe(true);
    expect(titreConfirme("Taga Médical – agences", "Taga Médical")).toBe(true);
  });

  it("accepte un premier mot distinctif quand le nom entier manque", () => {
    expect(titreConfirme("L'agent de sourcing IA | Collective", "Collective.work")).toBe(true);
  });

  it("refuse un mot trop banal pour valoir preuve", () => {
    expect(titreConfirme("Le Bon Coin", "Le Groupe")).toBe(false);
  });

  it("refuse un site sans rapport", () => {
    expect(titreConfirme("Bienvenue chez Dupont SA", "Skolae")).toBe(false);
  });
});

describe("resolveDomain", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retient le domaine deviné que le site confirme", async () => {
    stubWeb({ "skolae.fr": "<title>Skolae</title>" });
    expect(await resolveDomain("SKOLAE", "cid")).toBe("skolae.fr");
  });

  it("retient une suggestion d'annuaire indevinable", async () => {
    stubWeb(
      { "covea.com": '<html lang="fr"><title>Groupe Covéa - Mutualiser nos forces</title>' },
      { "Groupe Covéa": [{ name: "Groupe Covéa", domain: "covea.com" }] },
    );
    expect(await resolveDomain("Groupe Covéa", "cid")).toBe("covea.com");
  });

  // `thea.com` s'affiche en anglais, `decathlon.fr` répond 403 : exiger une visite
  // de la page d'accueil privait de logo des marques que l'annuaire connaît par
  // leur nom exact — et qui ont donc, elles, un logo au CDN.
  it("retient un domaine d'annuaire sans visiter son site", async () => {
    const appels = stubWeb({}, { "Laboratoires Théa": [{ name: "Laboratoires Théa", domain: "thea.com" }] });
    expect(await resolveDomain("Laboratoires Théa", "cid")).toBe("thea.com");
    expect(appels).not.toContain("https://thea.com");
  });

  // Deux homonymes réels que l'extension ne peut pas départager : `nexton.com`
  // est un quartier résidentiel américain, `fabgroup.com` un fabricant italien.
  // Leur titre parle bien de l'entreprise cherchée ; seule la langue les trahit.
  it("écarte un homonyme en .com dont le site ne vise pas la France", async () => {
    stubWeb({
      "nexton.com": '<html lang="en"><title>Nexton | Master-Planned Community in Summerville, SC</title>',
      "fabgroup.com": '<html lang="it-IT"><title>FAB Group - Componenti per industria del mobile</title>',
    });
    expect(await resolveDomain("Nexton", "cid")).toBe("");
    expect(await resolveDomain("Fab Group", "cid")).toBe("");
  });

  it("dispense un .fr de prouver sa langue", async () => {
    stubWeb({ "teaminside.fr": "<title>Teaminside : 100% digitale</title>" });
    expect(await resolveDomain("TEAM INSIDE", "cid")).toBe("teaminside.fr");
  });

  // Le scénario complet du faux logo : l'annuaire propose l'homonyme pakistanais,
  // dont le site parle bel et bien de « Nexton ». Seul le filtre d'extension le
  // barre — et le vrai domaine, lui, n'est pas devinable depuis « Nexton ».
  it("préfère aucun logo à celui d'un homonyme étranger", async () => {
    const appels = stubWeb(
      { "nexton.com.pk": "<title>Baby &amp; kids Products in Pakistan | Nexton®</title>" },
      { Nexton: [{ name: "Nexton", domain: "nexton.com.pk" }] },
    );
    expect(await resolveDomain("Nexton", "cid")).toBe("");
    expect(appels.some((u) => u.includes("nexton.com.pk"))).toBe(false);
  });

  it("ne retient pas un domaine dont le site ne parle pas de l'entreprise", async () => {
    stubWeb({ "acme.fr": "<title>Domaine à vendre</title>" });
    expect(await resolveDomain("Acme", "cid")).toBe("");
  });

  // Un `.fr` au nom de l'entreprise qui répond 403 est une enseigne qui se protège
  // des robots, pas un domaine parké : ceux-là servent leur page de vente en 200.
  it("accepte un .fr qui bloque les robots", async () => {
    stubWeb({ "decathlon.fr": null });
    expect(await resolveDomain("Decathlon", "cid")).toBe("decathlon.fr");
  });

  it("n'accorde pas la même indulgence à un .com muet", async () => {
    stubWeb({ "nexton.com": null });
    expect(await resolveDomain("Nexton", "cid")).toBe("");
  });

  // L'annuaire ne tranche pas les homonymes : pour « Fab Group », il donne le
  // fabricant de meubles italien. Un site français au bon nom passe donc devant.
  it("préfère un site français confirmé à la suggestion de l'annuaire", async () => {
    stubWeb(
      { "fab-group.fr": "<title>Fab Group, agence conseil</title>" },
      { "Fab Group": [{ name: "Fab Group", domain: "fabgroup.com" }] },
    );
    expect(await resolveDomain("Fab Group", "cid")).toBe("fab-group.fr");
  });
});

describe("withCompanyLogos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ne touche à rien sans clé configurée", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await withCompanyLogos([offre("Acme")], undefined);
    expect(out[0].logoUrl).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("laisse intact le logo déjà fourni par la source", async () => {
    const appels = stubWeb({});
    const out = await withCompanyLogos([offre("Acme", "https://source/logo.png")], "cid");
    expect(out[0].logoUrl).toBe("https://source/logo.png");
    expect(appels).toHaveLength(0);
  });

  it("construit l'URL du CDN pour un domaine confirmé", async () => {
    stubWeb({ "skolae.fr": '<html lang="fr-FR"><title>Skolae</title>' });
    const out = await withCompanyLogos([offre("SKOLAE"), offre("Skolae SAS")], "cid");
    expect(out[0].logoUrl).toBe(logoUrlFor("skolae.fr", "cid"));
    expect(out[1].logoUrl).toBe(logoUrlFor("skolae.fr", "cid"));
  });

  it("laisse l'offre sans logo quand rien n'est confirmé", async () => {
    stubWeb({});
    const out = await withCompanyLogos([offre("Introuvable SARL")], "cid");
    expect(out[0].logoUrl).toBe("");
  });
});

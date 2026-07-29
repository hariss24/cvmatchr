import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeCompany, tldPlausible, domaineProche, domainCandidates, titreConfirme,
  logoUrlFor, resolveDomain, logoUrlsFor,
} from "./logos";

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

  // `h3campusgroupe.fr` n'existe pas, `h3campus.fr` oui. Une raison sociale porte
  // son mot de queue, son domaine presque jamais.
  it("réessaie sans le mot de queue générique", () => {
    expect(domainCandidates("H3 CAMPUS GROUPE")).toContain("h3campus.fr");
    expect(domainCandidates("PEPSICO FRANCE")).toContain("pepsico.fr");
  });

  // Élagué, « Fed Group » donne « fed » — trop court pour désigner quiconque.
  it("n'élague pas jusqu'à un reste banal", () => {
    expect(domainCandidates("Fed Group")).not.toContain("fed.fr");
    expect(domainCandidates("POP France")).not.toContain("pop.fr");
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

  it("reconnaît le nom privé de son mot de queue", () => {
    expect(titreConfirme("H3 Campus — école supérieure", "H3 CAMPUS GROUPE")).toBe(true);
  });
});

describe("resolveDomain", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retient le domaine deviné que le site confirme", async () => {
    stubWeb({ "skolae.fr": "<title>Skolae</title>" });
    expect((await resolveDomain("SKOLAE", "cid")).domain).toBe("skolae.fr");
  });

  it("retient une suggestion d'annuaire indevinable", async () => {
    stubWeb(
      { "covea.com": '<html lang="fr"><title>Groupe Covéa - Mutualiser nos forces</title>' },
      { "Groupe Covéa": [{ name: "Groupe Covéa", domain: "covea.com" }] },
    );
    expect((await resolveDomain("Groupe Covéa", "cid")).domain).toBe("covea.com");
  });

  // `thea.com` s'affiche en anglais, `decathlon.fr` répond 403 : exiger une visite
  // de la page d'accueil privait de logo des marques que l'annuaire connaît par
  // leur nom exact — et qui ont donc, elles, un logo au CDN.
  it("retient un domaine d'annuaire sans visiter son site", async () => {
    const appels = stubWeb({}, { "Laboratoires Théa": [{ name: "Laboratoires Théa", domain: "thea.com" }] });
    expect((await resolveDomain("Laboratoires Théa", "cid")).domain).toBe("thea.com");
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
    expect((await resolveDomain("Nexton", "cid")).domain).toBe("");
    expect((await resolveDomain("Fab Group", "cid")).domain).toBe("");
  });

  it("dispense un .fr de prouver sa langue", async () => {
    stubWeb({ "teaminside.fr": "<title>Teaminside : 100% digitale</title>" });
    expect((await resolveDomain("TEAM INSIDE", "cid")).domain).toBe("teaminside.fr");
  });

  // Le scénario complet du faux logo : l'annuaire propose l'homonyme pakistanais,
  // dont le site parle bel et bien de « Nexton ». Seul le filtre d'extension le
  // barre — et le vrai domaine, lui, n'est pas devinable depuis « Nexton ».
  it("préfère aucun logo à celui d'un homonyme étranger", async () => {
    const appels = stubWeb(
      { "nexton.com.pk": "<title>Baby &amp; kids Products in Pakistan | Nexton®</title>" },
      { Nexton: [{ name: "Nexton", domain: "nexton.com.pk" }] },
    );
    expect((await resolveDomain("Nexton", "cid")).domain).toBe("");
    expect(appels.some((u) => u.includes("nexton.com.pk"))).toBe(false);
  });

  it("ne retient pas un domaine dont le site ne parle pas de l'entreprise", async () => {
    stubWeb({ "acme.fr": "<title>Domaine à vendre</title>" });
    expect((await resolveDomain("Acme", "cid")).domain).toBe("");
  });

  // Un `.fr` au nom de l'entreprise qui répond 403 est une enseigne qui se protège
  // des robots, pas un domaine parké : ceux-là servent leur page de vente en 200.
  it("accepte un .fr qui bloque les robots", async () => {
    stubWeb({ "decathlon.fr": null });
    expect((await resolveDomain("Decathlon", "cid")).domain).toBe("decathlon.fr");
  });

  it("n'accorde pas la même indulgence à un .com muet", async () => {
    stubWeb({ "nexton.com": null });
    expect((await resolveDomain("Nexton", "cid")).domain).toBe("");
  });

  // L'annuaire ne tranche pas les homonymes : pour « Fab Group », il donne le
  // fabricant de meubles italien. Un site français au bon nom passe donc devant.
  it("préfère un site français confirmé à la suggestion de l'annuaire", async () => {
    stubWeb(
      { "fab-group.fr": "<title>Fab Group, agence conseil</title>" },
      { "Fab Group": [{ name: "Fab Group", domain: "fabgroup.com" }] },
    );
    expect((await resolveDomain("Fab Group", "cid")).domain).toBe("fab-group.fr");
  });
});

describe("logoUrlFor", () => {
  // Brandfetch sert une image *vide*, jamais 404, pour un domaine qu'il ignore :
  // le repli sur l'initiale ne peut pas se déclencher et la carte reste blanche.
  // Le service de favicons, lui, répond 404 — et couvre les PME que Brandfetch
  // ignore (`primark.fr`, `h3campus.fr`). D'où le fournisseur choisi selon la
  // provenance du domaine.
  it("prend Brandfetch pour un domaine que l'annuaire a nommé", () => {
    expect(logoUrlFor("thea.com", "cid", true)).toContain("cdn.brandfetch.io/thea.com");
  });

  it("prend le favicon pour un domaine deviné puis vérifié", () => {
    const url = logoUrlFor("primark.fr", "cid", false);
    expect(url).toContain("google.com/s2/favicons");
    expect(url).toContain("primark.fr");
  });
});

describe("logoUrlsFor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ne résout rien sans clé configurée", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await logoUrlsFor(["Acme"], undefined)).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne résout qu'une fois deux graphies d'une même entreprise", async () => {
    stubWeb({ "skolae.fr": '<html lang="fr-FR"><title>Skolae</title>' });
    const logos = await logoUrlsFor(["SKOLAE", "Skolae SAS"], "cid");
    expect(logos["SKOLAE"]).toBe(logoUrlFor("skolae.fr", "cid", false));
    expect(logos["Skolae SAS"]).toBe(logos["SKOLAE"]);
  });

  it("omet l'entreprise dont rien n'est confirmé", async () => {
    stubWeb({});
    expect(await logoUrlsFor(["Introuvable SARL"], "cid")).toEqual({});
  });
});

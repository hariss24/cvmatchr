import { describe, it, expect } from "vitest";
import { atsSlugs } from "./ats";

describe("atsSlugs", () => {
  it("met en minuscules et retire les accents", () => {
    expect(atsSlugs("SociÃ©tÃ© GÃ©nÃ©rale")).toContain("societe-generale");
  });

  it("propose la variante collÃ©e en plus de la variante tiretÃ©e", () => {
    expect(atsSlugs("Groupe SEB")).toEqual(["groupe-seb", "groupeseb"]);
  });

  it("ne propose qu'un slug quand les deux variantes sont identiques", () => {
    expect(atsSlugs("Doctolib")).toEqual(["doctolib"]);
  });

  it("retire les apostrophes et la ponctuation", () => {
    expect(atsSlugs("L'OrÃ©al S.A.")).toEqual(["l-oreal-s-a", "lorealsa"]);
  });

  it("ne renvoie rien pour un nom vide ou sans lettre", () => {
    expect(atsSlugs("")).toEqual([]);
    expect(atsSlugs("   ")).toEqual([]);
    expect(atsSlugs("---")).toEqual([]);
  });
});

import { resolveAts, NO_ATS } from "./ats";

/** `fetch` factice : renvoie une réponse par URL, 404 pour tout le reste. */
function fauxFetch(reponses: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const cle = Object.keys(reponses).find((k) => url.includes(k));
    if (!cle) return new Response("", { status: 404 });
    return new Response(JSON.stringify(reponses[cle]), { status: 200 });
  }) as typeof fetch;
}

describe("resolveAts", () => {
  it("retient Greenhouse quand le board existe et a des offres", async () => {
    const f = fauxFetch({ "boards-api.greenhouse.io/v1/boards/doctolib": { jobs: [{ id: 1 }] } });
    expect(await resolveAts("Doctolib", f)).toEqual({ ats: "greenhouse", slug: "doctolib" });
  });

  it("retient Lever quand Greenhouse ne connaît pas l'entreprise", async () => {
    const f = fauxFetch({ "api.lever.co/v0/postings/leboncoin": [{ id: "a" }] });
    expect(await resolveAts("Leboncoin", f)).toEqual({ ats: "lever", slug: "leboncoin" });
  });

  // Un board vide mène à une page sans offre : le lien serait une impasse.
  it("ignore un board qui répond 200 mais sans aucune offre", async () => {
    const f = fauxFetch({ "boards-api.greenhouse.io/v1/boards/doctolib": { jobs: [] } });
    expect(await resolveAts("Doctolib", f)).toEqual(NO_ATS);
  });

  it("essaie la variante collée quand la variante tiretée échoue", async () => {
    const f = fauxFetch({ "api.lever.co/v0/postings/groupeseb": [{ id: "a" }] });
    expect(await resolveAts("Groupe SEB", f)).toEqual({ ats: "lever", slug: "groupeseb" });
  });

  it("renvoie none quand aucun candidat ne matche", async () => {
    expect(await resolveAts("Boulangerie Durand", fauxFetch({}))).toEqual(NO_ATS);
  });

  // Une panne réseau ne doit jamais remonter comme une exception à l'appelant.
  it("traite une erreur réseau comme un non-match", async () => {
    const f = (async () => { throw new Error("ECONNRESET"); }) as typeof fetch;
    expect(await resolveAts("Doctolib", f)).toEqual(NO_ATS);
  });

  it("renvoie none pour un nom vide sans appeler le réseau", async () => {
    let appels = 0;
    const f = (async () => { appels++; return new Response("", { status: 404 }); }) as typeof fetch;
    expect(await resolveAts("   ", f)).toEqual(NO_ATS);
    expect(appels).toBe(0);
  });
});

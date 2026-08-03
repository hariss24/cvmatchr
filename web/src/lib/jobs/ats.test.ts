import { describe, it, expect } from "vitest";
import { atsSlugs, resolveAts, boardUrl, NO_ATS } from "./ats";

describe("atsSlugs", () => {
  it("met en minuscules et retire les accents", () => {
    expect(atsSlugs("Société Générale")).toContain("societe-generale");
  });

  it("propose la variante collée en plus de la variante tiretée", () => {
    expect(atsSlugs("Groupe SEB")).toEqual(["groupe-seb", "groupeseb"]);
  });

  it("ne propose qu'un slug quand les deux variantes sont identiques", () => {
    expect(atsSlugs("Doctolib")).toEqual(["doctolib"]);
  });

  it("retire les apostrophes et la ponctuation", () => {
    expect(atsSlugs("L'Oréal S.A.")).toEqual(["l-oreal-s-a", "lorealsa"]);
  });

  it("ne renvoie rien pour un nom vide ou sans lettre", () => {
    expect(atsSlugs("")).toEqual([]);
    expect(atsSlugs("   ")).toEqual([]);
    expect(atsSlugs("---")).toEqual([]);
  });
});

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

  it("retient Ashby", async () => {
    const f = fauxFetch({ "api.ashbyhq.com/posting-api/job-board/alan": { jobs: [{ id: "x" }] } });
    expect(await resolveAts("Alan", f)).toEqual({ ats: "ashby", slug: "alan" });
  });

  // SmartRecruiters ne renvoie pas les offres mais un compteur `totalFound` :
  // c'est le seul ATS dont la présence se lit sur un nombre, pas sur un tableau.
  it("retient SmartRecruiters en lisant totalFound", async () => {
    const f = fauxFetch({ "api.smartrecruiters.com/v1/companies/nexton": { totalFound: 137, content: [] } });
    expect(await resolveAts("Nexton", f)).toEqual({ ats: "smartrecruiters", slug: "nexton" });
  });

  it("ignore un totalFound à zéro", async () => {
    const f = fauxFetch({ "api.smartrecruiters.com/v1/companies/ubisoft": { totalFound: 0, content: [] } });
    expect(await resolveAts("Ubisoft", f)).toEqual(NO_ATS);
  });

  // Un board vide mène à une page sans offre : le lien serait une impasse.
  it("ignore un board qui répond 200 mais sans aucune offre", async () => {
    const f = fauxFetch({ "boards-api.greenhouse.io/v1/boards/doctolib": { jobs: [] } });
    expect(await resolveAts("Doctolib", f)).toEqual(NO_ATS);
  });

  // Doctolib est réellement sur Greenhouse ET sur Ashby : l'ordre de PROVIDERS
  // doit trancher de façon stable, sans dépendre de qui répond le plus vite.
  it("tranche par l'ordre de PROVIDERS quand deux ATS répondent", async () => {
    const f = fauxFetch({
      "boards-api.greenhouse.io/v1/boards/doctolib": { jobs: [{ id: 1 }] },
      "api.ashbyhq.com/posting-api/job-board/doctolib": { jobs: [{ id: "x" }] },
    });
    expect(await resolveAts("Doctolib", f)).toEqual({ ats: "ashby", slug: "doctolib" });
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

describe("boardUrl", () => {
  it("donne la page carrières de chaque ATS", () => {
    expect(boardUrl({ ats: "greenhouse", slug: "doctolib" })).toBe("https://job-boards.greenhouse.io/doctolib");
    expect(boardUrl({ ats: "lever", slug: "swile" })).toBe("https://jobs.lever.co/swile");
    expect(boardUrl({ ats: "ashby", slug: "alan" })).toBe("https://jobs.ashbyhq.com/alan");
    expect(boardUrl({ ats: "smartrecruiters", slug: "nexton" })).toBe("https://careers.smartrecruiters.com/nexton");
  });

  it("ne donne aucune adresse quand rien n'a été détecté", () => {
    expect(boardUrl(NO_ATS)).toBe("");
  });
});

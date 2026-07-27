import { describe, it, expect } from "vitest";
import { hostnameOf, domainCandidates } from "./board";

describe("hostnameOf", () => {
  it("extrait l'hôte d'une URL", () => {
    expect(hostnameOf("https://fr.linkedin.com/jobs/view/123")).toBe("fr.linkedin.com");
  });

  it("renvoie « » sur une URL invalide ou vide", () => {
    expect(hostnameOf("pas une url")).toBe("");
    expect(hostnameOf("")).toBe("");
  });
});

describe("domainCandidates", () => {
  it("descend d'un label à chaque échec", () => {
    expect(domainCandidates("candidat.francetravail.fr"))
      .toEqual(["candidat.francetravail.fr", "francetravail.fr"]);
  });

  it("gère un suffixe composé sans Public Suffix List", () => {
    // Cas réel vu dans une réponse JSearch. Une règle « 2 derniers labels »
    // donnerait "co.uk", un suffixe public sans favicon.
    expect(domainCandidates("jobs.lilylifestyle.co.uk"))
      .toEqual(["jobs.lilylifestyle.co.uk", "lilylifestyle.co.uk", "co.uk"]);
  });

  it("ne descend jamais sous deux labels", () => {
    expect(domainCandidates("adzuna.fr")).toEqual(["adzuna.fr"]);
  });

  it("renvoie [] sur une entrée vide ou sans point", () => {
    expect(domainCandidates("")).toEqual([]);
    expect(domainCandidates("localhost")).toEqual([]);
  });
});

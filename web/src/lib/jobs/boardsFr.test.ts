import { describe, it, expect, vi } from "vitest";
import { searchBoards } from "./boardsFr";
import { EMPTY_PROFILE } from "./profile";

vi.mock("./data/boards-offres.json", () => ({
  default: [
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "1", titre: "Ingénieur Logiciel Backend", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/1", publieLe: new Date().toISOString(), decouverteLe: "2026-08-04" },
    { ats: "lever", slug: "contentsquare", entreprise: "Contentsquare", id: "2", titre: "Alternance Marketing", lieu: "Paris", url: "https://jobs.lever.co/contentsquare/2", publieLe: new Date().toISOString(), decouverteLe: "2026-08-04" },
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "3", titre: "Comptable", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/3", publieLe: "2020-01-01T00:00:00.000Z", decouverteLe: "2026-08-04" },
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "4", titre: "Chargé de Communication", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/4", publieLe: new Date().toISOString(), decouverteLe: "2026-08-04" },
    // Les deux « Data » servent au tri par fraîcheur : la plus ancienne vient
    // avant dans l'ordre naturel de l'index (id 5 < id 6), donc si le tri
    // manque, elle sort en tête.
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "5", titre: "Data Analyst", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/5", publieLe: new Date(Date.now() - 10 * 86_400_000).toISOString(), decouverteLe: "2026-07-25" },
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "6", titre: "Data Engineer", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/6", publieLe: new Date().toISOString(), decouverteLe: "2026-08-04" },
    // Publiée « aujourd'hui » selon l'ATS, connue de nous depuis six mois.
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "7", titre: "Chargé de retouche", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/7", publieLe: new Date().toISOString(), decouverteLe: "2026-02-01" },
  ],
}));

vi.mock("./boardsText", () => ({
  obtenirTextes: vi.fn(async () => new Map([
    ["greenhouse:onrunning:1", "Nous cherchons un ingénieur backend Node.js expérimenté."],
    ["lever:contentsquare:2", "Stage de 6 mois en marketing digital."],
    // Titre propre, mais le texte revient sur un stage — doit être écarté après fetch.
    ["greenhouse:onrunning:4", "Une offre de stage de 6 mois, encadrée par un tuteur."],
    ["ashby:alan:5", "Analyse de données produit."],
    ["ashby:alan:6", "Construction de pipelines de données."],
  ])),
}));

// Aucun appel réseau en test : le géocodage échoue, `boardsLieu` retombe alors
// sur le rapprochement de libellés — c'est le chemin des 47 % d'offres sans
// coordonnées, donc celui qui mérite d'être couvert.
vi.mock("./homeCoords", () => ({ geocodeHome: vi.fn(async () => null) }));

const PARIS = { kind: "commune" as const, code: "75056", label: "Paris (75056)", radiusKm: 10 };
const LYON = { kind: "commune" as const, code: "69123", label: "Lyon (69123)", radiusKm: 10 };

describe("searchBoards", () => {
  it("aucun mot-clé → aucun appel, liste vide", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: [] });
    expect(r).toEqual({ offers: [], calls: 0 });
  });

  it("ne garde que les titres qui matchent un mot-clé du profil", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers).toHaveLength(1);
    expect(r.offers[0].title).toBe("Ingénieur Logiciel Backend");
    expect(r.offers[0].company).toBe("On Running");
    expect(r.offers[0].source).toBe("boards");
    expect(r.offers[0].jobText).toContain("Node.js");
  });

  it("exclut un titre qui contient un mot interdit avant même le fetch", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["alternance"], excludedWords: ["alternan"] });
    expect(r.offers).toHaveLength(0);
  });

  it("exclut une offre dont le texte (pas le titre) révèle un mot interdit", async () => {
    // « Chargé de Communication » (id 4) passe le pré-filtre titre sans encombre
    // (aucun mot exclu dedans) ; c'est son texte, connu seulement après fetch,
    // qui contient « stage » en mot isolé — la règle intégrée d'isExcludedText.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["communication"], excludedWords: [] });
    expect(r.offers).toHaveLength(0);
  });

  it("écarte une offre trop ancienne quand une date est connue", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["comptable"], maxAgeDays: 30 });
    expect(r.offers).toHaveLength(0);
  });

  it("id préfixé par la source, url et entreprise repris tels quels", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers[0].id).toBe("boards-greenhouse-onrunning-1");
    expect(r.offers[0].url).toBe("https://boards.greenhouse.io/onrunning/jobs/1");
  });

  it("classe les candidates de la plus récente à la plus ancienne", async () => {
    // Le plafond de 60 se prélève APRÈS ce tri : sans lui, il retiendrait les 60
    // premières de l'index, rangé par ats/slug/id — un biais alphabétique.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["data"], excludedWords: [] });
    expect(r.offers.map((o) => o.title)).toEqual(["Data Engineer", "Data Analyst"]);
  });

  it("écarte les offres hors du lieu demandé", async () => {
    // Toutes les offres de l'index de test sont à Paris.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [], location: LYON });
    expect(r.offers).toHaveLength(0);
  });

  it("garde les offres du lieu demandé", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [], location: PARIS });
    expect(r.offers).toHaveLength(1);
  });

  it("une recherche sans lieu reste nationale", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers).toHaveLength(1);
  });

  it("une retouche chez Greenhouse ne rajeunit pas une offre ancienne", async () => {
    // id 7 : publiée « aujourd'hui » d'après Greenhouse (updated_at), mais notre
    // scan la connaît depuis six mois. C'est la plus ancienne des deux qui vaut.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["retouche"], excludedWords: [], maxAgeDays: 30 });
    expect(r.offers).toHaveLength(0);
  });

  it("un mot-clé accentué matche un titre sans accent, et l'inverse", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingenieur"], excludedWords: [] });
    expect(r.offers).toHaveLength(1);
    expect(r.offers[0].title).toBe("Ingénieur Logiciel Backend");
  });
});

import { describe, it, expect, vi } from "vitest";
import { searchBoards, dateEffective, repartirParEntreprise } from "./boardsFr";
import { EMPTY_PROFILE } from "./profile";

vi.mock("./data/boards-offres.json", () => ({
  default: [
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "1", titre: "Ingénieur Logiciel Backend", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/1", publieLe: new Date().toISOString(), decouverteLe: new Date().toISOString().slice(0, 10) },
    { ats: "lever", slug: "contentsquare", entreprise: "Contentsquare", id: "2", titre: "Alternance Marketing", lieu: "Paris", url: "https://jobs.lever.co/contentsquare/2", publieLe: new Date().toISOString(), decouverteLe: new Date().toISOString().slice(0, 10) },
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "3", titre: "Comptable", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/3", publieLe: "2020-01-01T00:00:00.000Z", decouverteLe: new Date().toISOString().slice(0, 10) },
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "4", titre: "Chargé de Communication", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/4", publieLe: new Date().toISOString(), decouverteLe: new Date().toISOString().slice(0, 10) },
    // Les deux « Data » servent au tri par fraîcheur : la plus ancienne vient
    // avant dans l'ordre naturel de l'index (id 5 < id 6), donc si le tri
    // manque, elle sort en tête.
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "5", titre: "Data Analyst", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/5", publieLe: new Date(Date.now() - 10 * 86_400_000).toISOString(), decouverteLe: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10) },
    { ats: "ashby", slug: "alan", entreprise: "Alan", id: "6", titre: "Data Engineer", lieu: "Paris", url: "https://jobs.ashbyhq.com/alan/6", publieLe: new Date().toISOString(), decouverteLe: new Date().toISOString().slice(0, 10) },
    // Publiée « aujourd'hui » selon l'ATS, connue de nous depuis six mois.
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "7", titre: "Chargé de retouche", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/7", publieLe: new Date().toISOString(), decouverteLe: "2020-01-01" },
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "8", titre: "Développeur PHP", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/8", publieLe: new Date(Date.now() - 20 * 86_400_000).toISOString(), decouverteLe: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10) },
    { ats: "greenhouse", slug: "onrunning", entreprise: "On Running", id: "9", titre: "Software Engineer", lieu: "Paris", url: "https://boards.greenhouse.io/onrunning/jobs/9", publieLe: new Date().toISOString(), decouverteLe: new Date().toISOString().slice(0, 10) },
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
    ["greenhouse:onrunning:8", "Développement PHP backend."],
    ["greenhouse:onrunning:9", "Software engineering."],
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

  it("ne garde que les titres qui matchent un mot-clé du profil, synonymes compris", async () => {
    // ⚠️ Mis à jour le 07/08/2026 : « Software Engineer » s'ajoute à « Data Engineer » et « Ingénieur Logiciel Backend ».
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers.map((o) => o.title).sort()).toEqual(["Data Engineer", "Ingénieur Logiciel Backend", "Software Engineer"]);

    const ingenieur = r.offers.find((o) => o.title === "Ingénieur Logiciel Backend");
    expect(ingenieur?.company).toBe("On Running");
    expect(ingenieur?.source).toBe("boards");
    expect(ingenieur?.jobText).toContain("Node.js");
  });

  it("un intitulé sans équivalent connu ne ramène que lui-même", async () => {
    // « logiciel » ne figure dans aucune famille de synonymes : l'élargissement
    // ne doit alors rien ajouter du tout.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["logiciel"], excludedWords: [] });
    expect(r.offers.map((o) => o.title)).toEqual(["Ingénieur Logiciel Backend"]);
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
    // On cible l'offre par son titre : l'ordre entre deux offres publiées à la
    // même seconde n'est pas ce que ce test vérifie.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    const o = r.offers.find((x) => x.title === "Ingénieur Logiciel Backend");
    expect(o?.id).toBe("boards-greenhouse-onrunning-1");
    expect(o?.url).toBe("https://boards.greenhouse.io/onrunning/jobs/1");
  });

  it("classe les candidates de la plus récente à la plus ancienne", async () => {
    // Le plafond de 60 se prélève APRÈS ce tri : sans lui, il retiendrait les 60
    // premières de l'index, rangé par ats/slug/id — un biais alphabétique.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["data"], excludedWords: [] });
    expect(r.offers.map((o) => o.title)).toEqual(["Data Engineer", "Data Analyst"]);
  });

  it("une offre correspondant au mot tapé passe devant une offre plus récente amenée par un synonyme", async () => {
    // ⚠️ Défaut mesuré le 07/08/2026 : le plafond de 60 se remplissait par date
    // seule, et les offres correspondant aux intitulés tapés n'entraient jamais.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["développeur"], excludedWords: [] });
    const titles = r.offers.map((o) => o.title);
    expect(titles).toContain("Développeur PHP");
    expect(titles).toContain("Software Engineer");
    expect(titles.indexOf("Développeur PHP")).toBeLessThan(titles.indexOf("Software Engineer"));
  });

  it("écarte les offres hors du lieu demandé", async () => {
    // Toutes les offres de l'index de test sont à Paris.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [], location: LYON });
    expect(r.offers).toHaveLength(0);
  });

  it("garde les offres du lieu demandé", async () => {
    // ⚠️ Mis à jour le 07/08/2026 : 3 offres à Paris pour ingénieur.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [], location: PARIS });
    expect(r.offers).toHaveLength(3);
  });

  it("une recherche sans lieu reste nationale", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur"], excludedWords: [] });
    expect(r.offers).toHaveLength(3);
  });

  it("une retouche chez Greenhouse ne rajeunit pas une offre ancienne", async () => {
    // id 7 : publiée « aujourd'hui » d'après Greenhouse (updated_at), mais notre
    // scan la connaît depuis six mois. C'est la plus ancienne des deux qui vaut.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["retouche"], excludedWords: [], maxAgeDays: 30 });
    expect(r.offers).toHaveLength(0);
  });

  it("un mot-clé accentué matche un titre sans accent, et l'inverse", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingenieur"], excludedWords: [] });
    expect(r.offers.map((o) => o.title)).toContain("Ingénieur Logiciel Backend");
  });

  it("renseigne le champ critereEntree avec les termes du meilleur critère", async () => {
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["développeur"], excludedWords: [] });
    const dev = r.offers.find((o) => o.title === "Développeur PHP");
    expect(dev?.critereEntree).toBe("developpeur");
    const eng = r.offers.find((o) => o.title === "Software Engineer");
    expect(eng?.critereEntree).toBe("software engineer");
  });

  it("ne retient pas une offre qui ne satisfait qu'une partie d'un mot-clé composé", async () => {
    // Si le candidat cherche « ingénieur logiciel », « Ingénieur Logiciel Backend » matche
    // mais « Software Engineer » (sans mention de logiciel) ne matche pas.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["ingénieur logiciel"], excludedWords: [] });
    expect(r.offers.map((o) => o.title)).toContain("Ingénieur Logiciel Backend");
    expect(r.offers.map((o) => o.title)).not.toContain("Software Engineer");
  });

  it("sert toutes les offres littérales (niveau 2) avant d'entamer les offres élargies (niveau 1)", async () => {
    // ⚠️ Mesuré le 18/08/2026 (T3) : la répartition par employeur doit jouer à l'intérieur
    // de chaque niveau de pertinence pour éviter que la diversité d'employeurs ne dilue la pertinence.
    const r = await searchBoards({ ...EMPTY_PROFILE, keywords: ["développeur"], excludedWords: [] });
    const indexDev = r.offers.findIndex((o) => o.title === "Développeur PHP");
    const indexSoft = r.offers.findIndex((o) => o.title === "Software Engineer");
    expect(indexDev).toBeGreaterThanOrEqual(0);
    expect(indexSoft).toBeGreaterThanOrEqual(0);
    expect(indexDev).toBeLessThan(indexSoft);
  });
});



describe("dateEffective", () => {
  it("retombe sur la découverte quand l'ATS ne date pas l'offre", () => {
    expect(dateEffective({ publieLe: "2026-08-01T00:00:00.000Z", decouverteLe: "2026-08-06" }))
      .toBe("2026-08-01T00:00:00.000Z");
    expect(dateEffective({ publieLe: "", decouverteLe: "2026-08-06" })).toBe("2026-08-06");
    expect(dateEffective({ publieLe: "", decouverteLe: "" })).toBe("");
  });

  it("une offre non datée n'est pas classée comme la plus vieille de toutes", () => {
    // ⚠️ Cas réel : 7 871 des 8 538 offres Workday n'ont pas de date de
    // publication. Trier sur `publieLe` seul les renvoyait toutes après le
    // plafond de 60 — « ingénieur » retenait 0 offre Workday sur 1 770.
    const vieille = { publieLe: "2020-01-01T00:00:00.000Z", decouverteLe: "2020-01-01" };
    const recenteSansDate = { publieLe: "", decouverteLe: "2026-08-06" };
    const classees = [vieille, recenteSansDate]
      .sort((a, b) => dateEffective(b).localeCompare(dateEffective(a)));
    expect(classees[0]).toBe(recenteSansDate);
  });
});

describe("repartirParEntreprise", () => {
  const lot = (entreprise: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ entreprise, id: `${entreprise}${i}` }));

  it("empêche un employeur de manger toute la sélection", () => {
    // ⚠️ Cas réel du 06/08/2026 : « infirmier » rendait 34 offres Air Liquide
    // sur 60, « vendeur » 17 Petit-Bateau et 17 Uniqlo.
    const offres = [...lot("Air Liquide", 34), ...lot("Colisee", 10), ...lot("Korian", 10)];
    const retenues = repartirParEntreprise(offres, 12);
    expect(retenues.filter((o) => o.entreprise === "Air Liquide").length).toBe(4);
    expect(new Set(retenues.map((o) => o.entreprise)).size).toBe(3);
  });

  it("un quota fixe ne suffirait pas : les places restantes doivent aussi tourner", () => {
    // Le piège mesuré le 06/08/2026 : avec un quota de 3 puis un remplissage
    // des places libres, « infirmier » gardait ses 34 Air Liquide sur 60. Ici
    // deux employeurs seulement, dont un très gros : la dégradation doit être
    // progressive, pas un basculement.
    const offres = [...lot("Gros", 50), ...lot("Petit", 2)];
    const retenues = repartirParEntreprise(offres, 10);
    expect(retenues.filter((o) => o.entreprise === "Petit").length).toBe(2);
    expect(retenues.filter((o) => o.entreprise === "Gros").length).toBe(8);
  });

  it("un employeur seul remplit toutes les places, aucune offre perdue", () => {
    // « aide-soignant » : une seule entreprise dans l'index, treize offres.
    expect(repartirParEntreprise(lot("Colisee", 17), 13).length).toBe(13);
    expect(repartirParEntreprise(lot("Colisee", 5), 13).length).toBe(5);
  });

  it("sert la meilleure offre de chaque employeur avant la deuxième de quiconque", () => {
    const offres = [...lot("A", 3), ...lot("B", 3)];
    expect(repartirParEntreprise(offres, 4).map((o) => o.id)).toEqual(["A0", "B0", "A1", "B1"]);
  });

  it("s'arrête sans boucler quand les offres manquent pour atteindre le plafond", () => {
    expect(repartirParEntreprise([...lot("A", 1), ...lot("B", 1)], 60).length).toBe(2);
    expect(repartirParEntreprise([], 60)).toEqual([]);
  });

  it("deux offres littérales chez le même employeur et 100 offres élargies chez 100 autres : les deux littérales passent d'abord", () => {
    const niveau2 = [
      { entreprise: "EmployeurUnique", id: "lit-1" },
      { entreprise: "EmployeurUnique", id: "lit-2" },
    ];
    const niveau1 = Array.from({ length: 100 }, (_, i) => ({
      entreprise: `Autre${i}`,
      id: `elargi-${i}`,
    }));

    const gardees: { entreprise: string; id: string }[] = [];
    const PLAFOND = 60;
    for (const lot of [niveau2, niveau1]) {
      if (gardees.length >= PLAFOND) break;
      gardees.push(...repartirParEntreprise(lot, PLAFOND - gardees.length));
    }

    expect(gardees.filter((o) => o.entreprise === "EmployeurUnique").length).toBe(2);
    expect(gardees.slice(0, 2).map((o) => o.id)).toEqual(["lit-1", "lit-2"]);
    expect(gardees.length).toBe(60);
  });
});


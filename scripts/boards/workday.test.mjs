import test from "node:test";
import assert from "node:assert/strict";
import {
  decomposer, franceDansFacettes, lieuDuDetail, listerWorkdayFR, nomWorkday, FRANCE_WID,
} from "./workday.mjs";

/** Facette pays telle que Workday l'imbrique : locationMainGroup → locationCountry → valeurs. */
function facettesPays(valeurs) {
  return [{
    facetParameter: "locationMainGroup",
    values: [{ facetParameter: "locationCountry", values: valeurs }],
  }];
}

const poste = (titre, lieu, chemin) => ({
  title: titre,
  locationsText: lieu,
  externalPath: chemin,
  startDate: "2026-08-05",
});

/**
 * `fetch` factice. `liste` répond aux POST /jobs (appelée avec le corps décodé),
 * `details` associe un chemin d'offre à son corps de détail.
 */
function fauxFetch(liste, details = {}) {
  return async (url, init) => {
    if (init?.method === "POST") {
      return new Response(JSON.stringify(liste(JSON.parse(init.body))), { status: 200 });
    }
    const cle = Object.keys(details).find((k) => String(url).includes(k));
    if (!cle) return new Response("", { status: 404 });
    return new Response(JSON.stringify(details[cle]), { status: 200 });
  };
}

test("decomposer : sépare locataire, instance et site", () => {
  assert.deepEqual(decomposer("sanofi.wd3/SanofiCareers"), {
    locataire: "sanofi", wd: "wd3", site: "SanofiCareers",
  });
  assert.equal(decomposer("sanofi/SanofiCareers"), null);
  assert.equal(decomposer(""), null);
});

test("decomposer : garde la casse du site, que l'API distingue", () => {
  assert.equal(decomposer("gea.wd3/GEACareers").site, "GEACareers");
});

test("franceDansFacettes : null quand le locataire n'expose pas la facette pays", () => {
  assert.equal(franceDansFacettes({ facets: [{ facetParameter: "workerSubType", values: [] }] }), null);
  assert.equal(franceDansFacettes({}), null);
});

test("franceDansFacettes : 0 quand la facette existe sans la France", () => {
  const corps = { facets: facettesPays([{ id: "autre", descriptor: "Italy", count: 12 }]) };
  assert.equal(franceDansFacettes(corps), 0);
});

test("franceDansFacettes : le compte annoncé quand la France y figure", () => {
  const corps = { facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 83 }]) };
  assert.equal(franceDansFacettes(corps), 83);
});

test("voie A : la facette pays filtre côté serveur, y compris des communes inconnues", async () => {
  // Vitry-sur-Seine et Le Trait ne sont dans aucune liste de villes : c'est
  // précisément ce que la facette permet de récupérer.
  const f = fauxFetch((corps) => {
    if (Object.keys(corps.appliedFacets).length === 0) {
      return { total: 917, facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 2 }]) };
    }
    assert.deepEqual(corps.appliedFacets, { locationCountry: [FRANCE_WID] });
    return {
      total: 2,
      jobPostings: [
        poste("Clinical Research Director", "Vitry-sur-Seine", "/job/Vitry-sur-Seine/Clinical_R285"),
        poste("Technicien", "Le Trait", "/job/Le-Trait/Technicien_R999"),
      ],
    };
  });

  const r = await listerWorkdayFR("sanofi.wd3/SanofiCareers", f);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "Clinical_R285");
  assert.equal(r[0].lieu, "Vitry-sur-Seine");
  assert.equal(r[0].url, "https://sanofi.wd3.myworkdayjobs.com/SanofiCareers/job/Vitry-sur-Seine/Clinical_R285");
});

test("voie A : facette présente mais sans France → aucune offre, sans autre appel", async () => {
  let appels = 0;
  const f = fauxFetch(() => {
    appels++;
    return { facets: facettesPays([{ id: "autre", descriptor: "Italy", count: 30 }]) };
  });
  assert.deepEqual(await listerWorkdayFR("gea.wd3/GEACareers", f), []);
  assert.equal(appels, 1);
});

test("voie B : sans facette pays, seul le pays du détail décide", async () => {
  const f = fauxFetch(
    (corps) => {
      // La sonde interroge sans texte ; la facette pays étant absente, les
      // appels suivants passent par searchText pour dégrossir.
      assert.ok(corps.searchText === "" || corps.searchText === "France");
      return {
        facets: [{ facetParameter: "locationMainGroup", values: [{ facetParameter: "locations", values: [] }] }],
        jobPostings: [
          poste("Ingénieur", "Angers", "/job/Angers/Ingenieur_1"),
          poste("Tecnico", "Uzzano", "/job/Uzzano/Tecnico_2"),
        ],
      };
    },
    {
      "/job/Angers/Ingenieur_1": { jobPostingInfo: { country: { descriptor: "France", id: FRANCE_WID } } },
      "/job/Uzzano/Tecnico_2": { jobPostingInfo: { country: { descriptor: "Italy", id: "it-wid" } } },
    },
  );

  const r = await listerWorkdayFR("gea.wd3/GEACareers", f);
  assert.equal(r.length, 1);
  assert.equal(r[0].lieu, "Angers");
});

test("voie B : searchText remonte de l'étranger, qui doit être écarté", async () => {
  // Mesuré sur Santander : « France » rend Madrid, Singapour, Hong Kong.
  const f = fauxFetch(
    () => ({
      facets: [],
      jobPostings: [
        poste("Analyst", "Madrid", "/job/Madrid/Analyst_1"),
        poste("Analyste", "Levallois-Perret", "/job/Levallois/Analyste_2"),
      ],
    }),
    {
      "/job/Madrid/Analyst_1": { jobPostingInfo: { country: { descriptor: "Spain", id: "es-wid" } } },
      "/job/Levallois/Analyste_2": { jobPostingInfo: { country: { descriptor: "France", id: FRANCE_WID } } },
    },
  );
  const r = await listerWorkdayFR("santander.wd3/SantanderCareers", f);
  assert.deepEqual(r.map((o) => o.lieu), ["Levallois-Perret"]);
});

test("nomWorkday : le site sauve les locataires illisibles", () => {
  // Cas réels du passage du 05/08/2026 — sans cette règle, le candidat lisait
  // « Ag », « Cc », « Fina », « Alliancewd » sur la carte d'offre.
  assert.equal(nomWorkday("ag", "Airbus"), "Airbus");
  assert.equal(nomWorkday("cc", "ChanelCareers"), "Chanel");
  assert.equal(nomWorkday("fina", "DeloitteRecrute"), "Deloitte");
  assert.equal(nomWorkday("alliancewd", "renault-group-careers"), "Renault Group");
  assert.equal(nomWorkday("mouvrh", "External_Career_Site_GRAND_FRAIS"), "Grand Frais");
});

test("nomWorkday : le locataire reste quand le site n'apporte rien", () => {
  assert.equal(nomWorkday("thales", "Careers"), "Thales");
  assert.equal(nomWorkday("otis", "REC_Ext_Gateway"), "Otis");
  assert.equal(nomWorkday("mango", "Mango_Work_Your_Passion"), "Mango");
  assert.equal(nomWorkday("aggreko", "Aggreko_Careers_1"), "Aggreko");
});

test("nomWorkday : un site plus pauvre que le locataire ne l'emporte pas", () => {
  // `abercrombie` ne doit pas devenir « Anf » à cause de son site.
  assert.equal(nomWorkday("abercrombie", "anf"), "Abercrombie");
});

test("nomWorkday : un locataire suffixé est ramené à la marque", () => {
  assert.equal(nomWorkday("michelinhr", "Michelin"), "Michelin");
  assert.equal(nomWorkday("sanofi", "SanofiCareers"), "Sanofi");
});

test("nomWorkday : les sigles courts gardent leurs capitales", () => {
  assert.equal(nomWorkday("ratp", "RATP_Externe"), "RATP");
  assert.equal(nomWorkday("gea", "GEACareers"), "GEA");
  assert.equal(nomWorkday("kiongroup", "KIONGroup"), "KION Group");
});

test("lieuDuDetail : site principal puis sites secondaires", () => {
  assert.equal(lieuDuDetail({ location: "Gentilly", additionalLocations: ["Lyon"] }), "Gentilly / Lyon");
  assert.equal(lieuDuDetail({ location: "Angers" }), "Angers");
  assert.equal(lieuDuDetail({ location: "  ", additionalLocations: [] }), "");
  assert.equal(lieuDuDetail(null), "");
});

test("voie A : « 2 Locations » est remplacé par les villes du détail", async () => {
  const f = fauxFetch(
    (corps) => (Object.keys(corps.appliedFacets).length === 0
      ? { facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 2 }]) }
      : {
        jobPostings: [
          poste("Expert Qualité", "2 Locations", "/job/Gentilly/Expert_R1"),
          poste("Technicien", "Angers", "/job/Angers/Tech_R2"),
        ],
      }),
    { "/job/Gentilly/Expert_R1": { jobPostingInfo: { location: "Gentilly", additionalLocations: ["Lyon"] } } },
  );

  const r = await listerWorkdayFR("sanofi.wd3/SanofiCareers", f);
  assert.deepEqual(r.map((o) => o.lieu), ["Gentilly / Lyon", "Angers"]);
});

test("voie A : un lieu ABSENT est cherché dans le détail, comme un lieu masqué", async () => {
  // Accenture n'expose pas `locationsText` : sans cette règle, ses 200 offres
  // françaises entraient sans ville et sortaient de toute recherche par rayon.
  const f = fauxFetch(
    (corps) => (Object.keys(corps.appliedFacets).length === 0
      ? { facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 1 }]) }
      : {
        jobPostings: [{
          title: "Sales Operations Manager",
          externalPath: "/job/Paris/Sales_R003",
          postedOn: "Posted Today",
        }],
      }),
    { "/job/Paris/Sales_R003": { jobPostingInfo: { location: "Paris" } } },
  );

  const r = await listerWorkdayFR("accenture.wd103/AccentureCareers", f);
  assert.deepEqual(r.map((o) => o.lieu), ["Paris"]);
});

test("une entrée sans titre ni chemin n'est pas une offre", async () => {
  // Workday en renvoie qui ne portent que des métadonnées internes : elles
  // produiraient une carte vide pointant sur la racine du board.
  const f = fauxFetch(
    (corps) => (Object.keys(corps.appliedFacets).length === 0
      ? { facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 2 }]) }
      : {
        jobPostings: [
          { bulletFields: ["R00260956", "Paris"] },
          poste("Vrai poste", "Paris", "/job/Paris/Vrai_R1"),
        ],
      }),
    {},
  );

  const r = await listerWorkdayFR("accenture.wd103/AccentureCareers", f);
  assert.deepEqual(r.map((o) => o.titre), ["Vrai poste"]);
});

test("voie A : une offre dont le lieu reste innommable est écartée, pas conservée", async () => {
  // Sans ville, l'offre serait absente d'une recherche par rayon tout en
  // s'affichant ailleurs. On préfère ne pas la proposer du tout.
  const f = fauxFetch(
    (corps) => (Object.keys(corps.appliedFacets).length === 0
      ? { facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 2 }]) }
      : {
        jobPostings: [
          poste("Poste flou", "3 Locations", "/job/X/Flou_R1"),
          poste("Technicien", "Angers", "/job/Angers/Tech_R2"),
        ],
      }),
    { "/job/X/Flou_R1": { jobPostingInfo: { location: "", additionalLocations: [] } } },
  );

  const r = await listerWorkdayFR("sanofi.wd3/SanofiCareers", f);
  assert.deepEqual(r.map((o) => o.titre), ["Technicien"]);
});

test("voie A : les offres écartées ne font pas boucler la pagination", async () => {
  let pages = 0;
  const f = fauxFetch(
    (corps) => {
      if (Object.keys(corps.appliedFacets).length === 0) {
        return { facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 40 }]) };
      }
      pages++;
      return {
        jobPostings: Array.from({ length: 20 }, (_, i) => poste(`P${i}`, "2 Locations", `/job/X/P${i}`)),
      };
    },
    {},
  );
  // Aucun détail ne répond (404) : toutes les offres sont écartées.
  const r = await listerWorkdayFR("x.wd1/Y", f);
  assert.deepEqual(r, []);
  assert.equal(pages, 2, "40 offres annoncées, 2 pages de 20 — puis on s'arrête");
});

test("voie B : le détail déjà ouvert sert aussi à nommer les villes", async () => {
  const f = fauxFetch(
    () => ({
      facets: [],
      jobPostings: [poste("Ingénieur", "2 Locations", "/job/X/Ing_1")],
    }),
    {
      "/job/X/Ing_1": {
        jobPostingInfo: {
          country: { descriptor: "France", id: FRANCE_WID },
          location: "Nantes",
          additionalLocations: ["Rennes"],
        },
      },
    },
  );
  const r = await listerWorkdayFR("gea.wd3/GEACareers", f);
  assert.deepEqual(r.map((o) => o.lieu), ["Nantes / Rennes"]);
});

test("un détail en erreur reste indéterminé malgré la parallélisation", async () => {
  // Les détails sont ouverts six de front ; un 5xx au milieu ne doit pas être
  // avalé par les autres et rendre un board amputé.
  const f = async (url, init) => {
    if (init?.method === "POST") {
      return new Response(JSON.stringify({
        facets: [],
        jobPostings: Array.from({ length: 10 }, (_, i) => poste(`P${i}`, "Paris", `/job/Paris/P${i}`)),
      }), { status: 200 });
    }
    if (String(url).endsWith("P7")) return new Response("", { status: 500 });
    return new Response(JSON.stringify({
      jobPostingInfo: { country: { descriptor: "France", id: FRANCE_WID } },
    }), { status: 200 });
  };
  assert.equal(await listerWorkdayFR("x.wd1/Y", f), null);
});

test("sur un gros board, un incident isolé ne coûte plus les centaines d'autres offres", async () => {
  // ⚠️ Mesuré le 06/08/2026 : Mango ouvre 299 requêtes pour 283 offres. Sans
  // tolérance, une seule qui trébuche faisait perdre les 283 — c'est ce qui a
  // laissé Michelin, Renault, la RATP et Sanofi absents de l'index. Ici 200
  // offres, 3 détails en échec (1,5 %) : le board tient, les 3 sortent.
  const f = async (url, init) => {
    if (init?.method === "POST") {
      const { offset } = JSON.parse(init.body);
      return new Response(JSON.stringify({
        facets: [],
        jobPostings: offset >= 200
          ? []
          : Array.from({ length: 20 }, (_, i) => poste(`P${offset + i}`, "Paris", `/job/Paris/P${offset + i}`)),
      }), { status: 200 });
    }
    if (/\/P(7|42|155)$/.test(String(url))) return new Response("", { status: 500 });
    return new Response(JSON.stringify({
      jobPostingInfo: { country: { descriptor: "France", id: FRANCE_WID } },
    }), { status: 200 });
  };
  const r = await listerWorkdayFR("x.wd1/Y", f);
  assert.notEqual(r, null, "le board ne doit pas être invalidé pour 1,5 % d'incidents");
  assert.equal(r.length, 197, "les 3 offres en échec sortent, les 197 autres restent");
});

test("au-delà de la tolérance, le board redevient indéterminé", async () => {
  // 200 offres, 11 échecs (5,5 %) : au-dessus des 5 %, plus rien n'est rendu.
  const f = async (url, init) => {
    if (init?.method === "POST") {
      const { offset } = JSON.parse(init.body);
      return new Response(JSON.stringify({
        facets: [],
        jobPostings: offset >= 200
          ? []
          : Array.from({ length: 20 }, (_, i) => poste(`P${offset + i}`, "Paris", `/job/Paris/P${offset + i}`)),
      }), { status: 200 });
    }
    const n = Number(/\/P(\d+)$/.exec(String(url))?.[1] ?? -1);
    if (n >= 0 && n < 11) return new Response("", { status: 500 });
    return new Response(JSON.stringify({
      jobPostingInfo: { country: { descriptor: "France", id: FRANCE_WID } },
    }), { status: 200 });
  };
  assert.equal(await listerWorkdayFR("x.wd1/Y", f), null);
});

test("404 sur la liste : le site n'existe pas, c'est un fait — pas un inconnu", async () => {
  const r = await listerWorkdayFR("airliquidehr.wd3/AirLiquide", async () => new Response("", { status: 404 }));
  assert.deepEqual(r, []);
});

test("5xx : indéterminé, jamais un board vide", async () => {
  assert.equal(await listerWorkdayFR("x.wd1/Y", async () => new Response("", { status: 503 })), null);
});

test("échec en cours de pagination : indéterminé, jamais un résultat partiel", async () => {
  let appels = 0;
  const f = async (url, init) => {
    if (init?.method !== "POST") return new Response("", { status: 404 });
    appels++;
    if (appels === 1) {
      return new Response(JSON.stringify({
        facets: facettesPays([{ id: FRANCE_WID, descriptor: "France", count: 40 }]),
      }), { status: 200 });
    }
    if (appels === 2) {
      const jobPostings = Array.from({ length: 20 }, (_, i) => poste(`P${i}`, "Paris", `/job/Paris/P${i}`));
      return new Response(JSON.stringify({ jobPostings }), { status: 200 });
    }
    return new Response("", { status: 500 });
  };
  assert.equal(await listerWorkdayFR("x.wd1/Y", f), null);
});

test("slug mal formé : rien à tester, donc aucune offre et aucun appel", async () => {
  let appels = 0;
  await listerWorkdayFR("nimportequoi", async () => { appels++; return new Response("", { status: 200 }); });
  assert.equal(appels, 0);
});

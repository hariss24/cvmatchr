// Les deux sources de découverte de boards.
//
// A — les listes de slugs publiques (Common Crawl, via Feashliaa/job-board-aggregator).
//     Rendement français mesuré le 04/08/2026 sur 450 boards : greenhouse 2,0 %,
//     lever 2,7 %, ashby 0,7 %. Faible, parce que 98 % de ces boards sont
//     américains — mais le balayage complet coûte 1,6 Go et 5 minutes.
//
// B — les entreprises françaises de la base SIRENE. Seule voie vers
//     SmartRecruiters, qui n'a ni liste publique ni API d'énumération.
//
// ⚠️ Licence des listes de la source A : CC BY-NC 4.0, usage non commercial.
// Le jour d'une exploitation commerciale, cette source devra être remplacée par
// une régénération maison depuis Common Crawl. Tout est isolé dans
// `slugsDesListes` pour que ce remplacement ne touche rien d'autre.

const BASE_LISTES = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";

/** Pas de smartrecruiters : le répertoire `data/` du dépôt n'en contient pas. */
export const LISTES = {
  greenhouse: `${BASE_LISTES}/greenhouse_companies.json`,
  lever: `${BASE_LISTES}/lever_companies.json`,
  ashby: `${BASE_LISTES}/ashby_companies.json`,
};

/**
 * Tranches d'effectif INSEE retenues, de 200 salariés et plus. Comptes relevés
 * le 04/08/2026 : 3 125 + 6 007 + 2 952 + 1 473 + 831 + 174 + 89 = 14 651
 * entreprises actives.
 *
 * Les tranches 21 (50–99) et 22 (100–199) dépassent le plafond de pagination de
 * 10 000 résultats et exigeraient un découpage par département : hors périmètre.
 */
export const TRANCHES = ["31", "32", "41", "42", "51", "52", "53"];

const SIRENE = "https://recherche-entreprises.api.gouv.fr/search";

/** L'API refuse toute valeur supérieure. 14 651 entreprises = 587 pages. */
const PAR_PAGE = 25;

const TIMEOUT_MS = 15_000;

/** Un fichier de liste est soit un tableau de chaînes, soit un tableau d'objets. */
function extraireSlugs(brut) {
  const arr = Array.isArray(brut) ? brut : (brut?.companies ?? []);
  return arr
    .map((e) => (typeof e === "string" ? e : e?.slug ?? e?.name ?? e?.id ?? ""))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/** Tous les couples { ats, slug } des listes publiques. Une liste en panne est ignorée. */
export async function slugsDesListes(fetchImpl = fetch) {
  const out = [];

  for (const [ats, url] of Object.entries(LISTES)) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) continue;
      for (const slug of extraireSlugs(await res.json())) out.push({ ats, slug });
    } catch {
      // Liste injoignable : les autres doivent quand même servir.
      console.warn(`Liste ${ats} injoignable, ignorée.`);
    }
  }

  return out;
}

/** Toutes les entreprises actives des tranches demandées. Une tranche en panne est ignorée. */
export async function entreprisesFrancaises(fetchImpl = fetch, tranches = TRANCHES) {
  const out = [];

  for (const tranche of tranches) {
    let page = 1;
    let total = 1;

    try {
      while (page <= total) {
        const url = `${SIRENE}?tranche_effectif_salarie=${tranche}&etat_administratif=A`
          + `&per_page=${PAR_PAGE}&page=${page}`;
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) break;

        const corps = await res.json();
        total = Number(corps?.total_pages ?? 1);
        for (const e of corps?.results ?? []) {
          if (e?.nom_complet) out.push({ nom: e.nom_complet, siren: String(e.siren ?? "") });
        }
        page += 1;
      }
    } catch {
      console.warn(`Tranche ${tranche} interrompue, on passe à la suivante.`);
    }
  }

  return out;
}

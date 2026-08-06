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
// ⚠️ Licence des listes de la source A : le CODE du dépôt amont est MIT, mais
// son répertoire `data/` — celui qu'on lit ici — est sous CC BY-NC 4.0 :
// attribution obligatoire ET usage non commercial. L'attribution vit dans le
// fichier NOTICE à la racine ; ne pas l'y retirer sans retirer cette source.
// Le jour d'une exploitation commerciale, elle devra être remplacée par une
// régénération maison depuis Common Crawl, comme c'est déjà le cas pour Workday
// (`crawl.mjs`). Tout est isolé dans `slugsDesListes` pour que ce remplacement
// ne touche rien d'autre.

const BASE_LISTES = "https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data";

/** Pas de smartrecruiters : le répertoire `data/` du dépôt n'en contient pas. */
export const LISTES = {
  greenhouse: `${BASE_LISTES}/greenhouse_companies.json`,
  lever: `${BASE_LISTES}/lever_companies.json`,
  ashby: `${BASE_LISTES}/ashby_companies.json`,
};

/**
 * Tranches d'effectif INSEE de 200 salariés et plus. Comptes relevés le
 * 04/08/2026 : 3 125 + 6 007 + 2 952 + 1 473 + 831 + 174 + 89 = 14 651
 * entreprises actives. Chacune tient sous le plafond d'affichage de l'API.
 */
export const TRANCHES = ["31", "32", "41", "42", "51", "52", "53"];

/**
 * Les PME : 50–99 et 100–199 salariés. Là où un candidat se bat contre trois
 * personnes et non trois cents — la raison d'être du marché caché.
 *
 * Elles dépassent le plafond d'affichage de 10 000 résultats et exigent d'être
 * découpées (voir `SECTIONS`). Comptes réels obtenus par somme des sections le
 * 05/08/2026 : tranche 21 → 33 760, tranche 22 → 15 678.
 */
export const TRANCHES_PME = ["21", "22"];

/**
 * Sections NAF, de A à U. Sert à découper une tranche trop peuplée pour le
 * plafond de 10 000 résultats de l'API.
 *
 * ⚠️ Le découpage par **département ne fonctionne pas** : vérifié le
 * 05/08/2026, `departement=75` change bien le total mais renvoie des résultats
 * majoritairement hors de Paris (12 sur 25 conformes, le premier ayant son
 * siège dans le 95). Le filtre porte sur les **établissements** — une chaîne
 * nationale ayant une boutique à Paris ressort dans « 75 » — et le classement
 * reste national, si bien que les premières pages de chaque département sont
 * presque identiques : 400 lignes n'avaient donné que 170 entreprises
 * distinctes. La section d'activité, elle, est unique par entreprise : même
 * mesure, 5 146 lignes → 5 122 noms distincts, soit 0,5 % de recouvrement.
 */
export const SECTIONS = "ABCDEFGHIJKLMNOPQRSTU".split("");

const SIRENE = "https://recherche-entreprises.api.gouv.fr/search";

/** L'API refuse toute valeur supérieure. 14 651 entreprises = 587 pages. */
const PAR_PAGE = 25;

const TIMEOUT_MS = 15_000;

/**
 * Attente entre deux requêtes SIRENE. L'API plafonne : mesuré à 429 le
 * 04/08/2026 en pagination rapide (69 appels tranche 31 au lieu de 125).
 * 300 ms entre requêtes + retry sur 429 suffisent à la traverser.
 */
const ATTENTE_MS = 300;

/** Tentatives sur un 429 avant d'abandonner la tranche. */
const RETRY_MAX = 6;

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Délai avant de retenter un 429 : Retry-After du serveur, sinon 5 s. */
function delaiRetry(res) {
  const ra = Number(res.headers?.get("retry-after"));
  return (Number.isFinite(ra) && ra >= 0 ? ra : 5) * 1000;
}

/**
 * Nom à tester : la raison sociale quand elle est disponible, sinon le nom
 * complet débarrassé de sa parenthèse (« ACCOR (ACCOR) » → « ACCOR »).
 * Sans ce repli, les slugs dérivés du nom légal ne matchent jamais le board
 * (accor-accor au lieu d'accor) et le rendement de la source B s'effondre.
 */
function nomTirable(e) {
  const raison = String(e?.nom_raison_sociale ?? "").trim();
  if (raison) return raison;
  const complet = String(e?.nom_complet ?? "").trim();
  return complet.replace(/\s*\([^)]*\)\s*$/, "").trim() || complet;
}

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

/**
 * Toutes les entreprises actives des tranches demandées. Une tranche en panne
 * est ignorée.
 *
 * `sections` découpe chaque tranche par section NAF, pour les tranches trop
 * peuplées pour le plafond d'affichage de l'API. Sans elle, une seule requête
 * par tranche — le cas des entreprises de 200 salariés et plus.
 */
export async function entreprisesFrancaises(fetchImpl = fetch, tranches = TRANCHES, sections = null) {
  const out = [];

  const requetes = sections
    ? tranches.flatMap((t) => sections.map((s) => ({ tranche: t, section: s })))
    : tranches.map((t) => ({ tranche: t, section: null }));

  for (const { tranche, section } of requetes) {
    let page = 1;
    let total = 1;

    try {
      while (page <= total) {
        const url = `${SIRENE}?tranche_effectif_salarie=${tranche}&etat_administratif=A`
          + (section ? `&section_activite_principale=${section}` : "")
          + `&per_page=${PAR_PAGE}&page=${page}`;

        // Un 429 (quota de l'API) se retente, en honorant Retry-After. Un autre
        // statut non-OK abandonne la tranche sans faire tomber les autres.
        let res;
        for (let essai = 0; essai < RETRY_MAX; essai++) {
          res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
          if (res.status !== 429) break;
          await attendre(delaiRetry(res));
        }
        if (!res.ok) break;

        const corps = await res.json();
        total = Number(corps?.total_pages ?? 1);
        for (const e of corps?.results ?? []) {
          const nom = nomTirable(e);
          if (nom) out.push({ nom, siren: String(e.siren ?? "") });
        }
        page += 1;
        await attendre(ATTENTE_MS);
      }
    } catch {
      console.warn(`Tranche ${tranche}${section ? ` section ${section}` : ""} interrompue, on passe à la suivante.`);
    }
  }

  return out;
}

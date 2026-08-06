// Construit l'index LÉGER des offres françaises (sans texte) des boards déjà
// connus de boards-fr.json.
//
// Usage : node scripts/build-boards-offres.mjs
//
// Produit : web/src/lib/jobs/data/boards-offres.json
//
// Contrairement à build-boards-fr.mjs, pas de mémo ni de TTL : ce fichier est
// entièrement réécrit à chaque passage — un board retombé à zéro (donc sorti
// de boards-fr.json) sort aussi de celui-ci. Seul `decouverteLe` est repris du
// passage précédent (voir boards/nouveaute.mjs).

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listerOffresFR } from "./boards/offres.mjs";
import { enLot } from "./boards/lot.mjs";
import { cle } from "./boards/memo.mjs";
import { dater, jour, reprendreIndetermines, sansPerimees, PEREMPTION_JOURS } from "./boards/nouveaute.mjs";

/**
 * Au-delà de cette part de boards injoignables, la moisson est déclarée en
 * échec : le fichier est écrit et commité, mais le workflow devient rouge et
 * `alerte.yml` ouvre une issue.
 *
 * ⚠️ Sans ce seuil, une panne totale des cinq API est indiscernable d'une
 * journée sans changement — simulé le 06/08/2026, le fichier produit était
 * identique à l'octet, `git diff` ne voyait rien et le job restait vert.
 * Référence mesurée le même jour : 22 boards indéterminés sur 864, soit 2,5 %.
 */
const SEUIL_ALERTE = 0.1;

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_INDEX = join(DATA_DIR, "boards-fr.json");
const F_OFFRES = join(DATA_DIR, "boards-offres.json");

const PLAFOND = 12;

if (!existsSync(F_INDEX)) {
  console.error(`${F_INDEX} introuvable — lancer build-boards-fr.mjs d'abord.`);
  process.exit(1);
}
const boards = JSON.parse(readFileSync(F_INDEX, "utf8"));

console.log(`${boards.length} boards à moissonner.`);

/**
 * ⚠️ Workday à part, et bridé. Chaque board Workday ouvre lui-même jusqu'à 6
 * détails de front : à 12 boards en parallèle, cela fait 72 requêtes
 * simultanées. Mesuré le 06/08/2026, cette cadence a fait tomber 121 des 361
 * boards Workday — dont Thales, Airbus, Deloitte et Chanel, soit 6 144 offres
 * perdues d'un coup. Les quatre autres ATS ne bronchent pas et gardent la
 * cadence pleine.
 */
const PLAFOND_WD = 3;

/**
 * ⚠️ Deux réessais, avec une attente qui s'allonge. `listerOffresFR` rend `null`
 * au premier accroc, sans insister : sur un board volumineux, la probabilité
 * qu'aucune des dizaines de requêtes ne trébuche devient faible, et un board
 * entier disparaît pour un incident passager.
 *
 * ⚠️ L'attente monte à 3 s puis 12 s, au lieu de 1,5 s deux fois. Mesuré le
 * 06/08/2026 en rappelant les 25 boards absents de l'index : Michelin, Sanofi,
 * la RATP et Mango répondent tous correctement, mais échouent par intermittence
 * quand on les sollicite en rafale — Sanofi a rendu 81 offres, puis rien en
 * 0,1 seconde, puis de nouveau 81. Une pause d'une seconde et demie ne laisse
 * pas le temps à un throttling de retomber ; c'est ce qui a coûté 1 270 offres.
 */
const ATTENTES_MS = [3_000, 12_000];

async function lister(b) {
  for (let essai = 0; essai < 3; essai++) {
    const offres = await listerOffresFR(b.ats, b.slug);
    if (offres !== null) return offres;
    if (essai < ATTENTES_MS.length) {
      await new Promise((r) => setTimeout(r, ATTENTES_MS[essai]));
    }
  }
  return null;
}

// `brut[i]` correspond à `boards[i]` : `null` = board indéterminé, que ce soit
// par le `null` de `listerOffresFR` ou par une exception rattrapée par `enLot`.
// L'ordre est reconstitué après coup, les deux lots étant traités séparément.
const rangs = boards.map((b, i) => ({ b, i }));
const wd = rangs.filter(({ b }) => b.ats === "workday");
const autres = rangs.filter(({ b }) => b.ats !== "workday");

const brut = new Array(boards.length).fill(null);
for (const [lot, plafond] of [[autres, PLAFOND], [wd, PLAFOND_WD]]) {
  const res = await enLot(lot, plafond, ({ b }) => lister(b));
  lot.forEach(({ i }, k) => { brut[i] = res[k]; });
}

const precedentes = existsSync(F_OFFRES) ? JSON.parse(readFileSync(F_OFFRES, "utf8")) : [];

// ⚠️ Calculé ici, avant toute utilisation. Une date obtenue trop tard dans le
// fichier a déjà coûté une moisson entière le 06/08/2026.
const aujourdhui = jour(new Date());

const index = [];
const indetermines = new Set();
boards.forEach((board, i) => {
  const offres = brut[i];
  if (offres === null) {
    indetermines.add(cle(board.ats, board.slug));
    return;
  }
  for (const o of offres) {
    // `pays` est interne au harvest (estFrancais) : pas dans OffreLegere (spec §2).
    const { pays, ...legere } = o;
    // `vuLe` n'est posé QUE sur les offres réellement moissonnées aujourd'hui :
    // c'est ce qui permet à `sansPerimees` de distinguer une offre revue d'une
    // offre simplement recopiée du passage précédent.
    index.push({ ats: board.ats, slug: board.slug, entreprise: board.nom, ...legere, vuLe: aujourdhui });
  }
});

// Un board injoignable n'est pas un board vide : on garde ce qu'on savait de
// lui — mais pas indéfiniment (voir `sansPerimees`).
const reprisBruts = reprendreIndetermines(precedentes, indetermines);
const repris = sansPerimees(reprisBruts, aujourdhui);
index.push(...repris);

console.log(
  `${boards.length - indetermines.size} boards exploitables, ${indetermines.size} indéterminés `
  + `(${repris.length} offres reprises du passage précédent`
  + `${reprisBruts.length > repris.length ? `, ${reprisBruts.length - repris.length} périmées depuis plus de ${PEREMPTION_JOURS} jours` : ""}).`,
);

/**
 * Dernier filet : une offre sans lieu ne rentre pas dans l'index.
 *
 * ⚠️ La règle vit AUSSI ici, et pas seulement chez chaque ATS. Deux raisons
 * mesurées le 06/08/2026 : les offres reprises d'un board indéterminé viennent
 * du fichier précédent, donc d'un code plus ancien (93 offres Europcar sans
 * lieu), et un ATS peut avoir le même trou sans qu'on l'ait vu (56 offres chez
 * `lever:ippon`). Sans ville, une offre est absente des recherches par rayon
 * tout en s'affichant ailleurs — une incohérence invisible pour le candidat.
 */
const situees = index.filter((o) => String(o.lieu ?? "").trim() !== "");
if (situees.length < index.length) {
  console.log(`${index.length - situees.length} offres écartées faute de lieu exploitable.`);
}
index.length = 0;
index.push(...situees);

index.sort(
  (a, b) => a.ats.localeCompare(b.ats) || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
);

// Tri AVANT datation : l'ordre du fichier reste celui de l'index, pas celui de
// la nouveauté. Un diff quotidien ne doit montrer que ce qui a réellement bougé.
const datees = dater(precedentes, index, aujourdhui);
const nouvelles = datees.filter((o) => o.decouverteLe === aujourdhui).length;

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(F_OFFRES, `${JSON.stringify(datees, null, 2)}\n`, "utf8");

console.log(`OK — ${datees.length} offres légères écrites dans ${F_OFFRES}, dont ${nouvelles} nouvelles.`);

/**
 * ⚠️ L'échec est déclaré APRÈS l'écriture, jamais avant : ce que la moisson a
 * réussi à ramener est conservé et commité (l'étape de commit du workflow tourne
 * en `if: always()`). Seule la couleur du job change — et c'est elle qui
 * déclenche `alerte.yml`.
 */
const partIndeterminee = boards.length === 0 ? 1 : indetermines.size / boards.length;
if (partIndeterminee > SEUIL_ALERTE) {
  console.error(
    `ÉCHEC — ${indetermines.size} boards injoignables sur ${boards.length} `
    + `(${(partIndeterminee * 100).toFixed(1)} %, seuil ${SEUIL_ALERTE * 100} %). `
    + `L'index a été écrit avec ce qui a pu être moissonné, mais ce passage n'est pas fiable.`,
  );
  process.exitCode = 1;
}

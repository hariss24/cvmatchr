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
import { dater, jour, reprendreIndetermines } from "./boards/nouveaute.mjs";

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

// `brut[i]` correspond à `boards[i]` : `null` = board indéterminé, que ce soit
// par le `null` de `listerOffresFR` ou par une exception rattrapée par `enLot`.
const brut = await enLot(boards, PLAFOND, (b) => listerOffresFR(b.ats, b.slug));

const precedentes = existsSync(F_OFFRES) ? JSON.parse(readFileSync(F_OFFRES, "utf8")) : [];

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
    index.push({ ats: board.ats, slug: board.slug, entreprise: board.nom, ...legere });
  }
});

// Un board injoignable n'est pas un board vide : on garde ce qu'on savait de lui.
const repris = reprendreIndetermines(precedentes, indetermines);
index.push(...repris);

console.log(
  `${boards.length - indetermines.size} boards exploitables, ${indetermines.size} indéterminés `
  + `(${repris.length} offres reprises du passage précédent).`,
);

index.sort(
  (a, b) => a.ats.localeCompare(b.ats) || a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id),
);

// Tri AVANT datation : l'ordre du fichier reste celui de l'index, pas celui de
// la nouveauté. Un diff quotidien ne doit montrer que ce qui a réellement bougé.
const aujourdhui = jour(new Date());
const datees = dater(precedentes, index, aujourdhui);
const nouvelles = datees.filter((o) => o.decouverteLe === aujourdhui).length;

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(F_OFFRES, `${JSON.stringify(datees, null, 2)}\n`, "utf8");

console.log(`OK — ${datees.length} offres légères écrites dans ${F_OFFRES}, dont ${nouvelles} nouvelles.`);

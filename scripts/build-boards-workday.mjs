// Ajoute les boards Workday français à l'index, à partir de Common Crawl.
//
// Usage : node scripts/build-boards-workday.mjs [--collection=CC-MAIN-2026-30] [--complet]
//   --complet   ignore la TTL du mémo et reteste tous les locataires
//
// Met à jour : web/src/lib/jobs/data/boards-fr.json et boards-fr-testes.json
//
// Séparé de build-boards-fr.mjs pour une raison de fond : les quatre ATS de la
// brique 1 se découvrent en DEVINANT un slug depuis un nom d'entreprise, ce que
// Workday interdit. La découverte passe ici par la lecture d'un index public, et
// mélanger les deux logiques dans un même script aurait rendu les deux illisibles.
//
// ⚠️ Ce script n'écrit que des ajouts et des mises à jour. Il ne retire jamais
// une entrée qu'il n'a pas su tester : un locataire injoignable reste dans
// l'index avec ce qu'on savait de lui. C'est la même règle que partout ailleurs
// dans la chaîne — `null` n'est pas `0`.

import { appendFileSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { locatairesWorkday } from "./boards/crawl.mjs";
import { listerWorkdayFR, decomposer, nomWorkday } from "./boards/workday.mjs";
import { enLot } from "./boards/lot.mjs";
import { cle, mois, estFrais, trierMemo, fusionner } from "./boards/memo.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_INDEX = join(OUT_DIR, "boards-fr.json");
const F_MEMO = join(OUT_DIR, "boards-fr-testes.json");

/**
 * Cadence. Workday n'a pas bridé pendant les essais, mais il fait tomber des
 * requêtes quand on pousse : mesuré le 05/08/2026, 6 en vol donnaient 73 échecs
 * sur 125 locataires, contre 10 sur 125 à 4 en vol avec deux réessais.
 */
const PLAFOND = 4;

const args = process.argv.slice(2);
const complet = args.includes("--complet");
const collection = args.find((a) => a.startsWith("--collection="))?.split("=")[1] ?? "CC-MAIN-2026-30";

/** Nom d'affichage : voir `nomWorkday`, le locataire seul ne suffit pas. */
function nomDuBoard(slug, locataire) {
  const m = decomposer(slug);
  return m ? nomWorkday(m.locataire, m.site) : locataire;
}

// ⚠️ `mois` et `estFrais` EXIGENT cette date : appelés sans, ils jettent. Le
// passage du 05/08/2026 a rendu 1 458 indéterminées sur 1 458 pour cette seule
// raison — l'exception, rattrapée par `enLot`, était indiscernable d'un board
// injoignable. C'est le garde-fou `null` qui a évité d'écrire ce néant.
const maintenant = new Date();
const moisCourant = mois(maintenant);

/**
 * Journal d'avancement, dans un fichier — pas seulement sur la sortie standard.
 *
 * ⚠️ `console.log` ne suffit PAS ici. Quand la sortie du script est redirigée,
 * Node la garde en tampon et ne la livre qu'à la fin : le passage du 05/08/2026
 * a tourné 1 h 40 sans afficher une ligne, alors qu'il échouait depuis la
 * première seconde. `appendFileSync` écrit immédiatement, donc le fichier se lit
 * pendant que le script tourne.
 */
const F_SUIVI = join(dirname(fileURLToPath(import.meta.url)), "..", "boards-workday-suivi.log");

function noter(ligne) {
  console.log(ligne);
  appendFileSync(F_SUIVI, `${ligne}\n`, "utf8");
}

writeFileSync(F_SUIVI, "", "utf8");

const index = existsSync(F_INDEX) ? JSON.parse(readFileSync(F_INDEX, "utf8")) : [];
const memo = existsSync(F_MEMO) ? JSON.parse(readFileSync(F_MEMO, "utf8")) : [];
const memoParCle = new Map(memo.map((m) => [m.cle, m]));

noter(`Lecture de l'index Common Crawl ${collection}…`);
const locataires = await locatairesWorkday(collection);
noter(`${locataires.length} locataires Workday trouvés.`);

const aSonder = locataires.filter((l) => {
  if (complet) return true;
  return !estFrais(memoParCle.get(cle("workday", l.slug))?.vuLe, maintenant);
});
noter(`${aSonder.length} à sonder (${locataires.length - aSonder.length} encore frais en mémoire).`);

let faits = 0;
let rates = 0;
let trouves = 0;
let offresVues = 0;

function avancer(resultat) {
  faits++;
  if (resultat === null) rates++;
  else if (resultat.offresFR > 0) {
    trouves++;
    offresVues += resultat.offresFR;
    noter(`  + ${resultat.nom} (${resultat.slug}) : ${resultat.offresFR} offres FR`);
  }
  if (faits % 50 === 0) {
    noter(`  … ${faits}/${aSonder.length} sondés · ${trouves} boards français · ${offresVues} offres · ${rates} indéterminés`);
  }
}

/**
 * ⚠️ Deux réessais avant de rendre `null`. Sans eux, 58 % des locataires
 * ressortaient indéterminés là où un simple réessai suffisait : le même
 * locataire répondait 3 fois sur 3 quelques secondes plus tard.
 */
async function sonder(l) {
  for (let essai = 0; essai < 3; essai++) {
    const offres = await listerWorkdayFR(l.slug);
    if (offres !== null) {
      const trouvaille = {
        ats: "workday",
        slug: l.slug,
        nom: nomDuBoard(l.slug, l.locataire),
        offresFR: offres.length,
        vuLe: moisCourant,
      };
      avancer(trouvaille);
      return trouvaille;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  avancer(null);
  return null;
}

const brut = await enLot(aSonder, PLAFOND, sonder);
const trouvailles = brut.filter(Boolean);

noter(`${trouvailles.length} réponses exploitables, ${brut.length - trouvailles.length} indéterminées.`);

const nouvelIndex = fusionner(index, trouvailles);
for (const t of trouvailles) {
  memoParCle.set(cle(t.ats, t.slug), { cle: cle(t.ats, t.slug), offresFR: t.offresFR, vuLe: t.vuLe });
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(F_INDEX, `${JSON.stringify(nouvelIndex, null, 2)}\n`, "utf8");
writeFileSync(F_MEMO, `${JSON.stringify(trierMemo([...memoParCle.values()]), null, 2)}\n`, "utf8");

const wd = nouvelIndex.filter((e) => e.ats === "workday");
const offresWd = wd.reduce((n, e) => n + e.offresFR, 0);
noter(`OK — ${wd.length} boards Workday français (${offresWd} offres), ${nouvelIndex.length} boards au total.`);

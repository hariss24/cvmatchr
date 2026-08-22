// Ajoute les boards Talentsoft français à l'index, à partir de Common Crawl.
//
// Usage : node --max-old-space-size=8192 scripts/build-boards-talentsoft.mjs
//           [--collection=CC-MAIN-2026-30] [--complet] [--fichiers=N]
//   --complet     ignore la TTL du mémo et resonde tous les hôtes
//   --fichiers=N  ne lit que les N premiers fichiers columnar (essais)
//
// ⚠️ La mémoire n'est pas un détail : un fichier columnar contient ~7,3 millions
// de lignes, matérialisées le temps de la lecture. Sans `--max-old-space-size`,
// Node s'arrête. Seuls les ~60 000 noms retenus survivent d'un fichier à l'autre.
//
// Séparé de build-boards-workday.mjs pour la même raison qui l'avait séparé de
// build-boards-fr.mjs : la DÉCOUVERTE diffère. Workday se lit dans l'index CDX
// par préfixe de domaine ; Talentsoft, lui, vit aussi bien sur un sous-domaine
// partagé que sur le domaine propre du client (jobs.groupe-psa.com), qu'aucun
// préfixe ne trouve. Sa découverte passe donc par l'index COLUMNAR, où l'on peut
// lire les noms d'hôtes du web entier — voir boards/parquet.mjs et
// boards/carrieres.mjs.
//
// ⚠️ Ce script n'écrit que des ajouts et des mises à jour. Il ne retire jamais
// une entrée qu'il n'a pas su tester : `null` n'est pas `0`.

import { appendFileSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cheminsColumnar, lireColonne } from "./boards/parquet.mjs";
import { hotesCarrieres } from "./boards/carrieres.mjs";
import { listerTalentsoftFR, nomTalentsoft } from "./boards/talentsoft.mjs";
import { enLot } from "./boards/lot.mjs";
import { cle, mois, estFrais, trierMemo, fusionner } from "./boards/memo.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const MEMO_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
const F_INDEX = join(OUT_DIR, "boards-fr.json");
const F_MEMO = join(MEMO_DIR, "boards-fr-testes.json");

/**
 * Cadence de sondage.
 *
 * Plus haute que celle de Workday (4), et ce n'est pas une imprudence : chaque
 * requête part vers un hôte DIFFÉRENT. Trente-deux en vol, c'est une requête par
 * serveur, pas trente-deux sur le même. Le gisement compte des dizaines de
 * milliers de candidats dont l'immense majorité rendra 404 : à 4 en vol, un
 * passage à froid ne finirait pas dans la journée.
 */
const PLAFOND = 32;

const args = process.argv.slice(2);
const complet = args.includes("--complet");
const collection = args.find((a) => a.startsWith("--collection="))?.split("=")[1] ?? "CC-MAIN-2026-30";
const limiteFichiers = Number(args.find((a) => a.startsWith("--fichiers="))?.split("=")[1]) || 0;

const maintenant = new Date();
const moisCourant = mois(maintenant);

/** Journal écrit au fil de l'eau : `console.log` seul reste en tampon (voir Workday). */
const F_SUIVI = join(dirname(fileURLToPath(import.meta.url)), "..", "boards-talentsoft-suivi.log");

function noter(ligne) {
  console.log(ligne);
  appendFileSync(F_SUIVI, `${ligne}\n`, "utf8");
}

writeFileSync(F_SUIVI, "", "utf8");

const index = existsSync(F_INDEX) ? JSON.parse(readFileSync(F_INDEX, "utf8")) : [];
const memo = existsSync(F_MEMO) ? JSON.parse(readFileSync(F_MEMO, "utf8")) : [];
const memoParCle = new Map(memo.map((m) => [m.cle, m]));

noter(`Lecture de l'index columnar ${collection}…`);
let chemins = await cheminsColumnar(collection);
if (limiteFichiers) chemins = chemins.slice(0, limiteFichiers);
noter(`${chemins.length} fichiers columnar à lire.`);

let lus = 0;
const hotes = await hotesCarrieres(chemins, async (chemin, colonne) => {
  const lignes = await lireColonne(chemin, colonne);
  lus += 1;
  if (lus % 20 === 0) noter(`  … ${lus}/${chemins.length} fichiers lus`);
  return lignes;
});

noter(`${hotes.size} hôtes à consonance « site carrière » retenus.`);

const aSonder = [...hotes].filter((h) => {
  if (complet) return true;
  return !estFrais(memoParCle.get(cle("talentsoft", h))?.vuLe, maintenant);
});
noter(`${aSonder.length} à sonder (${hotes.size - aSonder.length} encore frais en mémoire).`);

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
  if (faits % 500 === 0) {
    noter(`  … ${faits}/${aSonder.length} sondés · ${trouves} boards · ${offresVues} offres · ${rates} indéterminés`);
  }
}

/** Deux réessais avant de rendre `null` — même raison que chez Workday. */
async function sonder(hote) {
  for (let essai = 0; essai < 3; essai++) {
    const offres = await listerTalentsoftFR(hote);
    if (offres !== null) {
      const trouvaille = {
        ats: "talentsoft",
        slug: hote,
        nom: nomTalentsoft(hote),
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
mkdirSync(MEMO_DIR, { recursive: true });
writeFileSync(F_INDEX, `${JSON.stringify(nouvelIndex, null, 2)}\n`, "utf8");
writeFileSync(F_MEMO, `${JSON.stringify(trierMemo([...memoParCle.values()]), null, 2)}\n`, "utf8");

const ts = nouvelIndex.filter((e) => e.ats === "talentsoft");
const offresTs = ts.reduce((n, e) => n + e.offresFR, 0);
noter(`OK — ${ts.length} boards Talentsoft français (${offresTs} offres), ${nouvelIndex.length} boards au total.`);

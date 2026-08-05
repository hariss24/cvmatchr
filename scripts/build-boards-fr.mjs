// Construit l'index des boards ATS ayant au moins une offre en France.
//
// Usage : node scripts/build-boards-fr.mjs [--source=a|b|tout] [--complet]
//   --source=a      les listes de slugs publiques seulement (~5 min)
//   --source=b      les entreprises SIRENE seulement : 200 salariés et plus
//                   contre les quatre ATS, puis les PME de 50 à 199 salariés
//                   contre SmartRecruiters seul (~45-60 min à froid)
//   --source=tout   les deux (défaut)
//   --complet       ignore la TTL et reteste tout
//
// Produit : web/src/lib/jobs/data/boards-fr.json et boards-fr-testes.json
//
// ⚠️ Un `null` de compterFR n'est JAMAIS écrit : il signifie « on ne sait pas »
// (réseau, 5xx), et en conclure quoi que ce soit viderait l'index au premier
// incident réseau — commité, qui plus est.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ATS, compterFR } from "./boards/ats.mjs";
import { slugsCandidats } from "./boards/slugs.mjs";
import { slugsDesListes, entreprisesFrancaises, TRANCHES_PME, SECTIONS } from "./boards/sources.mjs";
import { enLot } from "./boards/lot.mjs";
import { cle, mois, estFrais, nomDepuisSlug, trierMemo, fusionner } from "./boards/memo.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_INDEX = join(OUT_DIR, "boards-fr.json");
const F_MEMO = join(OUT_DIR, "boards-fr-testes.json");

const PLAFOND = 12;

/** Cadence tolérée par SmartRecruiters — voir le commentaire au point de sondage. */
const PLAFOND_SR = 4;
const PAUSE_SR_MS = 200;

const args = process.argv.slice(2);
const complet = args.includes("--complet");
const source = (args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "tout");

const maintenant = new Date();
const moisCourant = mois(maintenant);

function lire(chemin) {
  if (!existsSync(chemin)) return [];
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    console.warn(`${chemin} illisible, on repart de zéro.`);
    return [];
  }
}

const index = lire(F_INDEX);
const memo = lire(F_MEMO);
const memoParCle = new Map(memo.map((e) => [e.cle, e]));

/** Un couple ats+slug mérite-t-il d'être testé maintenant ? */
function aTester(ats, slug) {
  if (complet) return true;
  return !estFrais(memoParCle.get(cle(ats, slug))?.vuLe, maintenant);
}

/** Teste un couple et renvoie une trouvaille, ou null si la réponse est inexploitable. */
async function tester({ ats, slug, nom, siren }) {
  const n = await compterFR(ats, slug);
  if (n === null) return null;
  return {
    nom: nom ?? nomDepuisSlug(slug),
    ats,
    slug,
    offresFR: n,
    siren: siren ?? null,
    vuLe: moisCourant,
  };
}

const cibles = [];

// --- Source A : les listes publiques (pas de SmartRecruiters, il n'en existe pas)
if (source === "a" || source === "tout") {
  const couples = await slugsDesListes();
  console.log(`Source A : ${couples.length} slugs dans les listes publiques.`);
  for (const c of couples) if (aTester(c.ats, c.slug)) cibles.push(c);
}

/** Ajoute aux cibles les couples encore à tester pour ces entreprises. */
function viser(entreprises, atsSondes) {
  const avant = cibles.length;
  for (const e of entreprises) {
    for (const slug of slugsCandidats(e.nom)) {
      for (const ats of atsSondes) {
        if (aTester(ats, slug)) cibles.push({ ats, slug, nom: e.nom, siren: e.siren });
      }
    }
  }
  return cibles.length - avant;
}

// --- Source B : les entreprises françaises, contre les quatre ATS
if (source === "b" || source === "tout") {
  const entreprises = await entreprisesFrancaises();
  console.log(`Source B : ${entreprises.length} entreprises de 200 salariés et plus.`);
  console.log(`  → ${viser(entreprises, ATS)} couples à tester sur ${ATS.length} ATS.`);
}

// --- Source B bis : les PME (50 à 199 salariés), SmartRecruiters seul
//
// SmartRecruiters seul, et c'est une mesure, pas une intuition. Sur 5 122 PME
// sondées le 05/08/2026 contre les quatre ATS : 5 boards trouvés, tous
// SmartRecruiters (dont SCALIAN, 479 offres). Le sixième, `ibanfirst` chez
// Greenhouse, figurait déjà dans l'index via la liste publique — donc apporté
// par la source A, pas par celle-ci. Zéro Lever, zéro Ashby. Le même constat
// vaut au-dessus de 200 salariés : sur les 49 boards que SIRENE a fait
// découvrir, 47 sont SmartRecruiters et aucun n'est Greenhouse ou Lever, que
// les listes publiques couvrent déjà.
//
// Sonder les trois autres coûterait quatre fois plus de requêtes et quatre fois
// plus de mémo pour ce que les listes publiques donnent déjà gratuitement.
if (source === "b" || source === "tout") {
  const pme = await entreprisesFrancaises(fetch, TRANCHES_PME, SECTIONS);
  console.log(`Source B bis : ${pme.length} PME de 50 à 199 salariés.`);
  console.log(`  → ${viser(pme, ["smartrecruiters"])} couples à tester sur SmartRecruiters.`);
}

// Deux entreprises portant le même nom, ou une entreprise vue par deux sources,
// produisent le même couple ats+slug. `aTester` consulte le mémo du passage
// PRÉCÉDENT, pas la file en cours : sans ce dédoublonnage, le même board serait
// interrogé plusieurs fois dans la même exécution.
const parCle = new Map();
for (const c of cibles) if (!parCle.has(cle(c.ats, c.slug))) parCle.set(cle(c.ats, c.slug), c);
const aSonder = [...parCle.values()];

console.log(
  `${aSonder.length} couples à tester (${cibles.length - aSonder.length} doublons écartés, `
  + `${memo.length} déjà en mémoire).`,
);

// SmartRecruiters à part, et bridé. C'est le seul des quatre à refuser la
// cadence : mesuré le 05/08/2026, 25 000 requêtes à 12 de front donnent 4 825
// réponses puis 20 175 refus. À 4 de front avec 200 ms de pause, 6 000
// requêtes passent sans un seul refus, à 16 par seconde. Les trois autres
// gardent la cadence pleine — ils ne bronchent pas, et les faire ralentir
// coûterait dix minutes par passage pour rien.
const sr = aSonder.filter((c) => c.ats === "smartrecruiters");
const autres = aSonder.filter((c) => c.ats !== "smartrecruiters");
console.log(`  → ${autres.length} en cadence pleine, ${sr.length} sur SmartRecruiters à cadence réduite.`);

const brut = [
  ...(await enLot(autres, PLAFOND, tester)),
  ...(await enLot(sr, PLAFOND_SR, tester, PAUSE_SR_MS)),
];
const trouvailles = brut.filter(Boolean);

console.log(`${trouvailles.length} réponses exploitables, ${brut.length - trouvailles.length} indéterminées.`);

// L'index ne retient que les succès ; le mémo retient tout, échecs compris.
const nouvelIndex = fusionner(index, trouvailles);
for (const t of trouvailles) {
  memoParCle.set(cle(t.ats, t.slug), { cle: cle(t.ats, t.slug), offresFR: t.offresFR, vuLe: t.vuLe });
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(F_INDEX, `${JSON.stringify(nouvelIndex, null, 2)}\n`, "utf8");
writeFileSync(F_MEMO, `${JSON.stringify(trierMemo([...memoParCle.values()]), null, 2)}\n`, "utf8");

const offres = nouvelIndex.reduce((n, e) => n + e.offresFR, 0);
console.log(`OK — ${nouvelIndex.length} boards français, ${offres} offres FR, ${memoParCle.size} couples en mémoire.`);

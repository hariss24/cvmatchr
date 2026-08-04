// Construit l'index des boards ATS ayant au moins une offre en France.
//
// Usage : node scripts/build-boards-fr.mjs [--source=a|b|tout] [--complet]
//   --source=a      les listes de slugs publiques seulement (~5 min)
//   --source=b      les entreprises françaises SIRENE seulement (~20-40 min)
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
import { slugsDesListes, entreprisesFrancaises } from "./boards/sources.mjs";
import { enLot } from "./boards/lot.mjs";
import { cle, mois, estFrais, nomDepuisSlug, trierMemo, fusionner } from "./boards/memo.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_INDEX = join(OUT_DIR, "boards-fr.json");
const F_MEMO = join(OUT_DIR, "boards-fr-testes.json");

const PLAFOND = 12;

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

// --- Source B : les entreprises françaises, contre les quatre ATS
if (source === "b" || source === "tout") {
  const entreprises = await entreprisesFrancaises();
  console.log(`Source B : ${entreprises.length} entreprises françaises.`);
  for (const e of entreprises) {
    for (const slug of slugsCandidats(e.nom)) {
      for (const ats of ATS) {
        if (aTester(ats, slug)) cibles.push({ ats, slug, nom: e.nom, siren: e.siren });
      }
    }
  }
}

console.log(`${cibles.length} couples à tester (${memo.length} déjà en mémoire).`);

const brut = await enLot(cibles, PLAFOND, tester);
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

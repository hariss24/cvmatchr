// Consulter l'index du marché caché en ligne de commande.
//
// Usage :
//   node scripts/voir-offres.mjs                     les 30 entreprises qui recrutent le plus
//   node scripts/voir-offres.mjs thales              les offres d'une entreprise
//   node scripts/voir-offres.mjs --lieu paris        les offres d'une ville
//   node scripts/voir-offres.mjs --poste ingenieur   les offres dont le titre correspond
//   node scripts/voir-offres.mjs --resume            le compte par ATS et les totaux
//
// Ajouter --tout pour lever la limite d'affichage (50 lignes par défaut).
//
// Les fichiers lus sont produits par build-boards-fr.mjs, build-boards-workday.mjs
// et build-boards-offres.mjs. Cet outil ne les modifie jamais.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");
const F_BOARDS = join(DATA, "boards-fr.json");
const F_OFFRES = join(DATA, "boards-offres.json");

for (const f of [F_BOARDS, F_OFFRES]) {
  if (!existsSync(f)) {
    console.error(`${f} introuvable — lancer d'abord les scripts de moisson.`);
    process.exit(1);
  }
}

const lire = (f) => JSON.parse(readFileSync(f, "utf8"));

/** Comparaison indulgente : sans accent, sans casse. */
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const args = process.argv.slice(2);
const tout = args.includes("--tout");
const drapeau = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : null;
};
const libres = args.filter((a, i) => !a.startsWith("--") && !String(args[i - 1] ?? "").startsWith("--"));

const LIMITE = tout ? Infinity : 50;

function afficher(lignes, titre) {
  console.log(`\n${titre}\n`);
  if (lignes.length === 0) {
    console.log("  (aucun résultat)");
    return;
  }
  console.table(lignes.slice(0, LIMITE));
  if (lignes.length > LIMITE) {
    console.log(`\n… ${lignes.length - LIMITE} de plus. Ajouter --tout pour tout voir.`);
  }
}

if (args.includes("--resume")) {
  const boards = lire(F_BOARDS);
  const offres = lire(F_OFFRES);
  const parAts = new Map();
  for (const b of boards) {
    const e = parAts.get(b.ats) ?? { ats: b.ats, entreprises: 0, offres: 0 };
    e.entreprises++;
    e.offres += b.offresFR;
    parAts.set(b.ats, e);
  }
  afficher([...parAts.values()].sort((a, b) => b.offres - a.offres), "Index par ATS");
  console.log(`Total : ${boards.length} entreprises · ${offres.length} offres dans l'index léger.`);
  const neuves = offres.filter((o) => o.decouverteLe === offres[0]?.decouverteLe).length;
  console.log(`Offres portant la date de découverte la plus récente : ${neuves}.`);
} else if (drapeau("--lieu")) {
  const q = norm(drapeau("--lieu"));
  const r = lire(F_OFFRES).filter((o) => norm(o.lieu).includes(q));
  afficher(
    r.map((o) => ({ Entreprise: o.entreprise, Poste: o.titre, Lieu: o.lieu })),
    `${r.length} offres dont le lieu contient « ${drapeau("--lieu")} »`,
  );
} else if (drapeau("--poste")) {
  const q = norm(drapeau("--poste"));
  const r = lire(F_OFFRES).filter((o) => norm(o.titre).includes(q));
  afficher(
    r.map((o) => ({ Entreprise: o.entreprise, Poste: o.titre, Lieu: o.lieu })),
    `${r.length} offres dont le titre contient « ${drapeau("--poste")} »`,
  );
} else if (libres.length > 0) {
  const q = norm(libres.join(" "));
  const r = lire(F_OFFRES).filter((o) => norm(o.entreprise).includes(q));
  afficher(
    r.map((o) => ({ Poste: o.titre, Lieu: o.lieu, Publiée: (o.publieLe || "").slice(0, 10) })),
    `${r.length} offres chez « ${libres.join(" ")} »`,
  );
} else {
  const r = lire(F_BOARDS).sort((a, b) => b.offresFR - a.offresFR);
  afficher(
    r.map((b) => ({ Entreprise: b.nom, Offres: b.offresFR, ATS: b.ats })),
    `${r.length} entreprises dans l'index, les plus gros recruteurs d'abord`,
  );
}

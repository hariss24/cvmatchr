// Régénère les données ROME depuis l'open data France Travail (licence Etalab).
// Usage : node scripts/build-rome.mjs
// Produit : web/src/lib/jobs/data/rome-competences.json et rome-appellations.json
//
// ⚠️ Les JSON du ZIP sont encodés en ISO-8859-15 (latin-9), pas en UTF-8.
//    Attention : latin-1 passe sans erreur mais casse « œ » (52 appellations).
// ⚠️ Le bloc `savoirs` s'ouvre sur `categories`, les deux autres sur `enjeux`.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

const SRC = "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "src", "lib", "jobs", "data");

const work = join(tmpdir(), `rome-${process.pid}`);
mkdirSync(work, { recursive: true });

console.log("Téléchargement du ROME open data…");
const res = await fetch(SRC);
if (!res.ok) throw new Error(`Téléchargement échoué (${res.status}). URL changée ? Voir ${SRC}`);
const zipPath = join(work, "rome.zip");
writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));

// Décompression via l'outil système (aucune dépendance npm autorisée).
execFileSync("tar", ["-xf", zipPath, "-C", work], { stdio: "inherit" });

// Le nom du fichier porte un numéro de version (ex. _v461) : on le retrouve par motif.
const { readdirSync, readFileSync } = await import("node:fs");
const files = readdirSync(work);
const find = (frag) => {
  const f = files.find((n) => n.includes(frag) && n.endsWith(".json"));
  if (!f) throw new Error(`Fichier "${frag}" introuvable dans l'archive. Contenu : ${files.join(", ")}`);
  return join(work, f);
};

const readRome = (p) => JSON.parse(new TextDecoder("iso-8859-15").decode(readFileSync(p)));
const fiches = readRome(find("fiche_emploi_metier"));

const BLOCS = [
  ["savoir_faire", "enjeux"],
  ["savoir_etre_professionnel", "enjeux"],
  ["savoirs", "categories"],
];

const table = {};
const appellations = [];

for (const f of fiches) {
  const rome = f.rome?.code_rome;
  if (!rome) continue;

  const c = {};
  for (const [bloc, cle] of BLOCS) {
    for (const grp of f.competences?.[bloc]?.[cle] ?? []) {
      for (const it of grp.items ?? []) {
        const poids = it.coeur_metier === "Principale" ? 2 : 1;
        const code = String(it.code_ogr);
        c[code] = Math.max(c[code] ?? 0, poids);
      }
    }
  }

  const v = (f.mobilites ?? [])
    .map((m) => String(m.rome_cible ?? "").split(" - ")[0])
    .filter((x) => /^[A-Z]\d{4}$/.test(x));

  table[rome] = { i: f.rome.intitule ?? "", c, v: [...new Set(v)] };

  for (const a of f.appellations ?? []) {
    if (a.libelle) appellations.push({ l: a.libelle, r: rome });
  }
}

appellations.sort((a, b) => a.l.localeCompare(b.l, "fr"));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "rome-competences.json"), JSON.stringify(table), "utf8");
writeFileSync(join(OUT_DIR, "rome-appellations.json"), JSON.stringify(appellations), "utf8");
rmSync(work, { recursive: true, force: true });

console.log(`OK — ${Object.keys(table).length} fiches ROME, ${appellations.length} appellations.`);

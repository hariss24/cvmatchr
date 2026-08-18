#!/usr/bin/env node
/**
 * Outil de mesure de pertinence pour la sélection Marché Caché.
 *
 * Rejoue la chaîne de sélection réelle sur web/src/lib/jobs/data/boards-offres.json.
 * Sans appel réseau, sans filtre géographique.
 *
 * ⚠️ ATTENTION : Si la logique de sélection ou d'élargissement dans web/src/lib/jobs/
 * évolue, ce script de mesure doit être maintenu synchronisé.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers l'index d'offres
const DATA_PATH = path.resolve(__dirname, "../../web/src/lib/jobs/data/boards-offres.json");

const EXCLUDED_WORDS = ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"];
const MAX_AGE_DAYS = 30;
const PLAFOND_CANDIDATES = 60;

function normaliser(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normKey(company, role) {
  const c = normaliser(company);
  const r = normaliser(role);
  if (!c && !r) return "";
  return `${c}|${r}`;
}

function isExcludedText(text, excludedWords) {
  const t = normalize(text);
  if (excludedWords.some((w) => w.trim() !== "" && t.includes(normalize(w)))) return true;
  return t.replace(/-/g, " ").split(/\s+/).includes("stage");
}

function dansLage(o, maxAgeDays) {
  const dates = [o.publieLe, o.decouverteLe]
    .map((d) => (d ? new Date(d).getTime() : Number.NaN))
    .filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return true;
  return (Date.now() - Math.min(...dates)) / 86_400_000 <= maxAgeDays;
}

function dateEffective(o) {
  return o.publieLe || o.decouverteLe || "";
}

const GROUPES = [
  ["ingenieur", "engineer", "engineering"],
  ["developpeur", "developer", "software engineer", "fullstack", "full stack", "backend", "frontend"],
  ["architecte", "architect"],
  ["technicien", "technician"],
  ["donnees", "data analyst", "data engineer", "data scientist", "analyste de donnees"],
  ["testeur", "qa engineer", "test engineer"],
  ["administrateur systeme", "system administrator", "sysadmin", "sre"],
  ["securite informatique", "cybersecurity", "security engineer"],
  ["chef de projet", "project manager", "program manager"],
  ["chef de produit", "product manager", "product owner"],
  ["commercial", "sales", "account executive", "business developer", "business development"],
  ["vendeur", "sales associate", "sales assistant", "retail"],
  ["vendeuse", "sales associate", "sales assistant", "retail"],
  ["conseiller clientele", "customer advisor", "customer success", "account manager"],
  ["acheteur", "buyer", "procurement", "purchasing"],
  ["marketing digital", "digital marketing", "growth marketing", "marketing en ligne"],
  ["responsable marketing", "marketing manager", "head of marketing", "directeur marketing", "marketing director"],
  ["ressources humaines", "human resources", "hr business partner", "people partner", "talent acquisition", "responsable rh", "hr manager", "head of people"],
  ["recruteur", "recruiter", "talent acquisition"],
  ["comptable", "accountant", "accounting"],
  ["controleur de gestion", "financial controller", "fp a"],
  ["juriste", "legal counsel", "lawyer"],
  ["assistant de direction", "executive assistant", "office manager"],
  ["formateur", "trainer", "training"],
  ["acheteur informatique", "it buyer"],
  ["logistique", "logistics", "supply chain"],
  ["magasinier", "warehouse operator", "warehouse"],
  ["conducteur", "driver", "operator"],
  ["qualite", "quality"],
  ["maintenance", "maintenance"],
  ["production", "production", "manufacturing"],
  ["responsable hse", "hse manager", "health safety environment", "hygiene securite environnement"],
  ["infirmier", "nurse"],
  ["infirmiere", "nurse"],
  ["aide soignant", "care assistant", "nursing assistant"],
  ["cuisinier", "cook", "chef de partie"],
  ["serveur", "waiter", "server"],
  ["stage", "internship", "intern"],
  ["alternance", "apprenticeship", "apprentice", "work study"],
  ["debutant", "junior", "entry level", "graduate"],
];

const MOTS_VIDES = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "l",
  "d",
  "en",
  "et",
  "a",
  "au",
  "aux",
  "pour",
  "sur",
]);

export function construireCriteres(keywords) {
  const sortie = [];
  const vus = new Set();

  const ajouter = (critere) => {
    const sig = critere.termes.slice().sort().join("|");
    if (!sig || vus.has(sig)) return;
    vus.add(sig);
    sortie.push(critere);
  };

  for (const mot of keywords) {
    const K = normaliser(mot);
    if (!K) continue;
    ajouter({
      termes: [K],
      litteral: true,
      origine: mot,
    });
  }

  for (const mot of keywords) {
    const K = normaliser(mot);
    if (!K) continue;

    for (const groupe of GROUPES) {
      for (const terme of groupe) {
        if (!K.includes(terme)) continue;

        const motsK = K.split(/\s+/).filter(Boolean);
        const motsT = new Set(terme.split(/\s+/).filter(Boolean));
        const reste = motsK.filter((w) => !motsT.has(w) && !MOTS_VIDES.has(w));

        if (reste.length === 0) {
          for (const s of groupe) {
            if (s === terme) continue;
            ajouter({
              termes: [s],
              litteral: false,
              origine: mot,
            });
          }
        } else {
          for (const s of groupe) {
            if (s === terme) continue;
            ajouter({
              termes: [s, ...reste],
              litteral: false,
              origine: mot,
            });
          }
        }
      }
    }
  }

  return sortie;
}

export function satisfait(texte, critere) {
  const norm = normaliser(texte);
  if (!norm) return false;
  return critere.termes.every((terme) => norm.includes(terme));
}

export function meilleurCritere(texte, criteres) {
  for (const c of criteres) {
    if (c.litteral && satisfait(texte, c)) return c;
  }
  for (const c of criteres) {
    if (!c.litteral && satisfait(texte, c)) return c;
  }
  return null;
}

export function pertinence(titre, criteres) {
  const c = meilleurCritere(titre, criteres);
  if (!c) return 0;
  return c.litteral ? 2 : 1;
}

function sansRedites(offres) {
  const vues = new Set();
  return offres.filter((o) => {
    const k = normKey(o.entreprise, o.titre);
    if (!k) return true;
    if (vues.has(k)) return false;
    vues.add(k);
    return true;
  });
}

function repartirParEntreprise(offres, plafond) {
  const files = new Map();
  for (const o of offres) {
    const file = files.get(o.entreprise);
    if (file) file.push(o);
    else files.set(o.entreprise, [o]);
  }

  const gardees = [];
  const restantes = [...files.values()];
  let tour = 0;
  while (gardees.length < plafond) {
    let servi = false;
    for (const file of restantes) {
      if (tour >= file.length) continue;
      gardees.push(file[tour]);
      servi = true;
      if (gardees.length >= plafond) break;
    }
    if (!servi) break;
    tour++;
  }
  return gardees;
}

function estPertinent(titre, saisis) {
  const hay = normaliser(titre);
  return saisis.some((k) => k.trim() !== "" && hay.includes(normaliser(k)));
}

export function mesurer(keywords, options = {}) {
  const data = options.data || JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const criteres = construireCriteres(keywords);

  const candidats = data
    .filter((o) => criteres.some((c) => satisfait(o.titre, c)))
    .filter((o) => !isExcludedText(o.titre, EXCLUDED_WORDS))
    .filter((o) => dansLage(o, MAX_AGE_DAYS));

  const pertinentsDispos = candidats.filter((o) => estPertinent(o.titre, keywords)).length;

  const triees = [...candidats].sort(
    (a, b) =>
      pertinence(b.titre, criteres) - pertinence(a.titre, criteres) ||
      dateEffective(b).localeCompare(dateEffective(a))
  );

  const dedupliquees = sansRedites(triees);
  const retenus = [];
  for (const niveau of [2, 1]) {
    if (retenus.length >= PLAFOND_CANDIDATES) break;
    const duNiveau = dedupliquees.filter((o) => pertinence(o.titre, criteres) === niveau);
    retenus.push(...repartirParEntreprise(duNiveau, PLAFOND_CANDIDATES - retenus.length));
  }
  const pertinentsRetenus = retenus.filter((o) => estPertinent(o.titre, keywords)).length;

  return {
    keywords,
    criteres: criteres.map((c) => c.termes.join(" + ")),
    candidatsCount: candidats.length,
    pertinentsDispos,
    retenusCount: retenus.length,
    pertinentsRetenus,
    retenus: retenus.map((o) => ({
      pertinence: pertinence(o.titre, criteres),
      titre: o.titre,
      entreprise: o.entreprise,
    })),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/boards/mesurer-pertinence.mjs <mot-cle-1> [mot-cle-2 ...]");
    process.exit(1);
  }

  const res = mesurer(args);

  console.log(`mots-clés saisis  : [${res.keywords.map((k) => `"${k}"`).join(", ")}]`);
  console.log(`critères utilisés : [${res.criteres.map((c) => `"${c}"`).join(", ")}]`);
  console.log(`candidats après filtres : ${res.candidatsCount}   dont pertinents disponibles : ${res.pertinentsDispos}`);
  console.log(`retenus                 : ${res.retenusCount}   dont pertinents retenus     : ${res.pertinentsRetenus}`);
  console.log("--- les retenus, préfixés du niveau de pertinence ---");
  for (const r of res.retenus) {
    console.log(`${r.pertinence}  ${r.titre} | ${r.entreprise}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

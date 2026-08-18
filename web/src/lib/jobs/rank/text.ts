/**
 * Analyse textuelle d'une annonce : découpage en zones et notation saturante.
 *
 * C'est le socle du critère le plus lourd (45 points sur 100). Un même métier
 * réel se présente sous des intitulés multiples — webmaster, chargé de contenu
 * web, chargé de communication digitale… — qu'aucune nomenclature ne réconcilie
 * (« contenu web » et « webmarketing » sont introuvables même en ROME 4.0,
 * spec §2.5). La description est la seule source qui les couvre tous.
 *
 * S'applique à TOUTES les sources : c'est ce qui rend une offre Adzuna
 * comparable à une offre France Travail sur la même échelle (spec §3.4).
 */

/** Minuscules + suppression des accents (aligné sur `prefilter.ts`). */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface Zones {
  /** Titre de l'offre, normalisé. Poids 3. */
  titre: string;
  /** Section « profil recherché » si identifiable, normalisée. Poids 2. */
  profil: string;
  /** Tout le reste de la description, normalisé. Poids 1. */
  reste: string;
}

/** Intitulés de section usuels, déjà normalisés. */
const MARQUEURS = [
  "profil recherche",
  "profil souhaite",
  "votre profil",
  "competences requises",
  "vos competences",
  "vous etes",
];

/** Longueur retenue pour la section « profil » à partir de son intitulé. */
const LONGUEUR_PROFIL = 800;

/** Découpe le texte en zones pondérées. Sans section identifiable, `profil` est vide. */
export function splitZones(title: string, jobText: string): Zones {
  const titre = normalize(title);
  const texte = normalize(jobText);

  let debut = -1;
  for (const m of MARQUEURS) {
    const i = texte.indexOf(m);
    if (i !== -1 && (debut === -1 || i < debut)) debut = i;
  }
  if (debut === -1) return { titre, profil: "", reste: texte };

  const fin = debut + LONGUEUR_PROFIL;
  return {
    titre,
    profil: texte.slice(debut, fin),
    reste: texte.slice(0, debut) + texte.slice(fin),
  };
}

const POIDS_TITRE = 3;
const POIDS_PROFIL = 2;
const POIDS_RESTE = 1;

/**
 * Plafond de crédit par mot-clé : au-delà, la répétition n'ajoute plus rien.
 * Calé sur `POIDS_TITRE` : un mot-clé présent dans l'intitulé du poste sature à
 * lui seul, car c'est le signal le plus fort qu'une annonce puisse donner. Un
 * plafond plus haut exigerait titre + rappel dans le corps pour saturer, ce qui
 * rendrait les 45 points quasi inatteignables et viderait le palier S.
 */
const PLAFOND = POIDS_TITRE;

/** Occurrences d'un terme dans un texte (sous-chaîne, sans limite de mot). */
function compte(texte: string, terme: string): number {
  if (!terme) return 0;
  let n = 0;
  let i = texte.indexOf(terme);
  while (i !== -1) {
    n++;
    i = texte.indexOf(terme, i + terme.length);
  }
  return n;
}

import { type Critere } from "../synonymes";

/**
 * Note la présence des critères conjonctifs, pondérée par zone et **saturante** :
 * chaque critère ne crédite que si TOUS ses termes sont présents dans les zones
 * analysées. Le crédit d'une offre est celui de son **meilleur** critère
 * (le maximum remplace la moyenne), plafonné à `PLAFOND` (3).
 *
 * ⚠️ Sans ce fonctionnement conjonctif, un mot-clé « chef de projet marketing »
 * était éclaté en mots et « chef » + « projet » rapportaient 66 % du crédit
 * sur n'importe quel poste de chef de projet (achats, supply chain...).
 */
export function criteresPoints(
  zones: Zones,
  criteres: Critere[],
  max: number,
): { points: number; trouves: string[] } {
  if (criteres.length === 0 || max <= 0) return { points: 0, trouves: [] };

  let meilleurCredit = 0;
  const trouves: string[] = [];

  for (const c of criteres) {
    if (c.termes.length === 0) continue;

    // Un critère ne crédite que si TOUS ses termes sont présents
    const tousPresents = c.termes.every(
      (t) => compte(zones.titre, t) + compte(zones.profil, t) + compte(zones.reste, t) > 0,
    );
    if (!tousPresents) continue;

    let brut = 0;
    for (const t of c.termes) {
      brut +=
        POIDS_TITRE * compte(zones.titre, t) +
        POIDS_PROFIL * compte(zones.profil, t) +
        POIDS_RESTE * compte(zones.reste, t);
    }
    // Un critère multi-termes ramène à la moyenne par terme pour rester comparable à un critère simple
    if (c.termes.length > 1) {
      brut = brut / c.termes.length;
    }

    const credit = Math.min(brut, PLAFOND) / PLAFOND;
    if (credit > 0) {
      if (!trouves.includes(c.origine)) {
        trouves.push(c.origine);
      }
      if (credit > meilleurCredit) {
        meilleurCredit = credit;
      }
    }
  }

  return {
    points: Math.round(max * meilleurCredit),
    trouves,
  };
}


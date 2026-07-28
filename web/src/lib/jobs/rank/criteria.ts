/**
 * Les critères de classement, une fonction pure par critère.
 *
 * Chaque critère a DEUX voies pour le même nombre de points : une voie
 * structurée (France Travail) et une voie textuelle (toutes les sources). C'est
 * ce qui garde une offre Adzuna comparable à une offre France Travail sur une
 * seule échelle de 100 — sans quoi les offres FT seraient systématiquement
 * avantagées (spec §3.4).
 */

import type { JobOffer } from "../offer";
import type { JobSearchProfile } from "../profile";
import { romeLabel, type RomeTargets } from "../rome";
import { parseLatLng, haversineKm, distancePoints, type LatLng } from "../geo";
import { splitZones, keywordPoints } from "./text";

export interface RankContext {
  rome: RomeTargets;
  /** Coordonnées du domicile ; null si l'adresse n'a pas pu être géocodée. */
  home: LatLng | null;
}

export interface Ligne {
  key: string;
  label: string;
  points: number;
  max: number;
  reason: string;
}

/** Barème. Les compétences pèsent plus du double du métier (décision §3.2). */
export const MAX = {
  competences: 45,
  metier: 20,
  distance: 15,
  contrat: 10,
  experience: 10,
} as const;

export const MALUS_HORS_SUJET = -20;
export const MALUS_SIGNAUX_MAX = -15;

/** Part de l'enveloppe « compétences » réservée à la voie structurée. */
const PART_STRUCTUREE = 0.4;

/** Crédit structuré considéré comme plein (offres FT : 4 compétences en moyenne). */
const CREDIT_PLEIN = 6;

/**
 * Compétences et missions — le critère le plus lourd.
 *
 * La voie textuelle sert de socle pour toutes les sources. Sur France Travail,
 * le recouvrement des codes de compétence l'affine, pondéré par le marqueur
 * cœur-de-métier (2 vs 1) et par l'exigence (E vs S). Le total reste plafonné
 * à `MAX.competences` : la part structurée redistribue dans l'enveloppe, elle
 * ne s'y ajoute pas.
 */
export function competencesPoints(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
): Ligne {
  // À défaut de compétences saisies, on retombe sur les intitulés de poste —
  // même repli que le pré-tri historique.
  const mots = profile.prefilterKeywords.length > 0 ? profile.prefilterKeywords : profile.keywords;
  const zones = splitZones(offer.title, offer.jobText);
  const texte = keywordPoints(zones, mots, MAX.competences);

  const structurable = offer.competences && offer.competences.length > 0 && ctx.rome.attendues.size > 0;
  if (!structurable) {
    return {
      key: "competences",
      label: "Compétences & missions",
      points: texte.points,
      max: MAX.competences,
      reason: texte.trouves.length > 0
        ? `${texte.trouves.length} trouvée(s) : ${texte.trouves.slice(0, 4).join(", ")}`
        : "aucune compétence repérée",
    };
  }

  let credit = 0;
  const nomsTrouves: string[] = [];
  for (const c of offer.competences ?? []) {
    const poids = ctx.rome.attendues.get(c.code);
    if (!poids) continue;
    credit += poids * (c.exigence === "E" ? 1.5 : 1);
    nomsTrouves.push(c.code);
  }
  const structure = Math.round(MAX.competences * Math.min(1, credit / CREDIT_PLEIN));

  const points = Math.min(
    MAX.competences,
    Math.round(texte.points * (1 - PART_STRUCTUREE) + structure * PART_STRUCTUREE),
  );

  const bouts = [
    texte.trouves.length > 0 ? texte.trouves.slice(0, 3).join(", ") : "",
    nomsTrouves.length > 0 ? `${nomsTrouves.length} compétence(s) officielle(s)` : "",
  ].filter(Boolean);

  return {
    key: "competences",
    label: "Compétences & missions",
    points,
    max: MAX.competences,
    reason: bouts.length > 0 ? bouts.join(" · ") : "aucune correspondance",
  };
}

/** Part des points « métier » accordée à un métier voisin officiel. */
const PART_VOISIN = 0.55;

/**
 * Métier. Le code ROME quand il existe, le titre sinon. On garde la meilleure
 * des deux voies : un titre parlant ne doit pas être puni parce que l'offre est
 * classée dans un code voisin.
 */
export function metierPoints(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
): Ligne {
  const zones = splitZones(offer.title, "");
  const titre = keywordPoints(zones, profile.keywords, MAX.metier);

  let parRome = 0;
  let motif = "";
  if (offer.romeCode && ctx.rome.cibles.size > 0) {
    if (ctx.rome.cibles.has(offer.romeCode)) {
      parRome = MAX.metier;
      motif = `${romeLabel(offer.romeCode)} (métier cible)`;
    } else if (ctx.rome.voisins.has(offer.romeCode)) {
      parRome = Math.round(MAX.metier * PART_VOISIN);
      motif = `${romeLabel(offer.romeCode)} (métier voisin)`;
    }
  }

  const points = Math.max(parRome, titre.points);
  const reason = parRome >= titre.points && motif
    ? motif
    : titre.trouves.length > 0
      ? `titre : ${titre.trouves.join(", ")}`
      : "métier non reconnu";

  return { key: "metier", label: "Métier", points, max: MAX.metier, reason };
}

/** Coordonnées de l'offre : champs dédiés, puis repli sur `commuteDestination`. */
function offerLatLng(offer: JobOffer): LatLng | null {
  if (typeof offer.lat === "number" && typeof offer.lng === "number") {
    return { lat: offer.lat, lng: offer.lng };
  }
  return parseLatLng(offer.commuteDestination);
}

/** Distance à vol d'oiseau. Aucun appel réseau (spec §2.7). */
export function distanceLigne(
  offer: JobOffer,
  profile: JobSearchProfile,
  ctx: RankContext,
): Ligne {
  const cible = offerLatLng(offer);
  const km = ctx.home && cible ? haversineKm(ctx.home, cible) : null;
  return {
    key: "distance",
    label: "Distance",
    points: distancePoints(km, profile.location.radiusKm, MAX.distance),
    max: MAX.distance,
    reason: km === null ? "distance inconnue" : `${Math.round(km)} km à vol d'oiseau`,
  };
}

const PART_CONTRAT = 6;
const PART_SALAIRE = 4;

/** Contrat voulu et salaire annoncé. Un salaire affiché vaut des points en soi. */
export function contratSalairePoints(offer: JobOffer, profile: JobSearchProfile): Ligne {
  const label = offer.contractLabel.toUpperCase();
  const contratOk = profile.contractTypes.some((t) => label.includes(t.toUpperCase()));
  const salaireOk = offer.salaryLabel.trim() !== "";

  const bouts: string[] = [];
  if (contratOk) bouts.push(offer.contractLabel);
  if (salaireOk) bouts.push("salaire annoncé");

  return {
    key: "contrat",
    label: "Contrat & salaire",
    points: (contratOk ? PART_CONTRAT : 0) + (salaireOk ? PART_SALAIRE : 0),
    max: MAX.contrat,
    reason: bouts.length > 0 ? bouts.join(" · ") : "contrat et salaire non précisés",
  };
}

/** Années d'expérience que le profil déclare pouvoir couvrir. */
const PLAFOND_NIVEAU: Record<JobSearchProfile["experienceLevel"], number> = {
  "": Number.POSITIVE_INFINITY,
  "1": 1,
  "2": 3,
  "3": Number.POSITIVE_INFINITY,
};

/** Expérience exigée face au niveau déclaré. Neutre quand l'information manque. */
export function experiencePoints(offer: JobOffer, profile: JobSearchProfile): Ligne {
  const key = "experience";
  const label = "Expérience";
  const max = MAX.experience;

  if (profile.experienceLevel === "") {
    return { key, label, points: max, max, reason: "niveau indifférent" };
  }
  if (offer.experienceExige === "D") {
    return { key, label, points: max, max, reason: "débutant accepté" };
  }
  if (!offer.experienceExige) {
    return { key, label, points: Math.round(max * 0.7), max, reason: "non précisée" };
  }
  if (offer.experienceExige === "S") {
    return { key, label, points: Math.round(max * 0.8), max, reason: "expérience souhaitée" };
  }

  const demande = offer.experienceYears ?? 0;
  const couvert = PLAFOND_NIVEAU[profile.experienceLevel];
  return demande <= couvert
    ? { key, label, points: max, max, reason: `${demande} an(s) exigé(s), dans ton niveau` }
    : { key, label, points: Math.round(max * 0.4), max, reason: `${demande} an(s) exigé(s), au-dessus de ton niveau` };
}

/**
 * Malus anti-bruit. C'est la vraie valeur du code ROME : sur 60 offres remontées
 * par le mot « webmaster », 20 étaient des postes de conseiller en formation
 * (spec §2.3). Le cumul avec un « Métier » à 0 est voulu — une telle offre
 * plafonne à 80 et devra exceller partout ailleurs pour seulement atteindre A.
 *
 * Ne s'applique jamais aux sources sans code ROME : ni punies, ni protégées.
 */
export function malusHorsSujet(offer: JobOffer, ctx: RankContext): Ligne {
  const applicable =
    Boolean(offer.romeCode) &&
    ctx.rome.cibles.size > 0 &&
    !ctx.rome.cibles.has(offer.romeCode as string) &&
    !ctx.rome.voisins.has(offer.romeCode as string);

  return {
    key: "hors_sujet",
    label: "Métier hors-sujet",
    points: applicable ? MALUS_HORS_SUJET : 0,
    max: 0,
    reason: applicable ? `classée ${romeLabel(offer.romeCode as string)}` : "",
  };
}

/** Motifs littéraux qui trahissent une annonce peu sérieuse. */
const MOTIFS: { motif: string; libelle: string }[] = [
  { motif: "selon profil", libelle: "salaire selon profil" },
  { motif: "selon experience", libelle: "salaire selon expérience" },
  { motif: "jeune et dynamique", libelle: "« jeune et dynamique »" },
  { motif: "esprit startup", libelle: "« esprit startup »" },
  { motif: "esprit start-up", libelle: "« esprit start-up »" },
];

const PENALITE = -5;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Signaux négatifs, plafonnés. `maintenant` est injecté pour rendre le test déterministe. */
export function malusSignaux(
  offer: JobOffer,
  profile: JobSearchProfile,
  maintenant: number,
): Ligne {
  const texte = normalize(`${offer.title} ${offer.jobText}`);
  let points = 0;
  const causes: string[] = [];

  for (const { motif, libelle } of MOTIFS) {
    if (texte.includes(motif)) {
      points += PENALITE;
      causes.push(libelle);
      break; // un seul malus « annonce floue », pas un par formulation
    }
  }

  for (const mot of profile.excludedWords) {
    const m = normalize(mot);
    if (m.length > 2 && texte.includes(m)) {
      points += PENALITE;
      causes.push(`mot exclu « ${mot} »`);
      break;
    }
  }

  if (offer.publishedAt) {
    const t = Date.parse(offer.publishedAt);
    if (!Number.isNaN(t)) {
      const jours = Math.floor((maintenant - t) / 86_400_000);
      if (jours > profile.maxAgeDays) {
        points += PENALITE;
        causes.push(`publiée il y a ${jours} jours`);
      }
    }
  }

  return {
    key: "signaux",
    label: "Signaux négatifs",
    points: Math.max(MALUS_SIGNAUX_MAX, points),
    max: 0,
    reason: causes.join(" · "),
  };
}

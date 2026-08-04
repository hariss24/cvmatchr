/**
 * Quatrième source d'offres : le « marché caché » des boards ATS publics
 * indexés en Brique 1. Contrairement aux trois autres, aucune requête ne part
 * vers un serveur de recherche : on filtre un index local (`boards-offres.json`,
 * rafraîchi chaque jour) puis on ne va chercher le texte complet, en direct,
 * que pour les offres dont le titre matche déjà — voir
 * `docs/superpowers/specs/2026-08-04-marche-cache-offres-design.md`.
 */

import type { JobSearchProfile } from "./profile";
import type { JobOffer } from "./offer";
import { isExcludedText } from "./exclude";
import { obtenirTextes } from "./boardsText";
import { hostnameOf } from "./board";
import boardsOffresData from "./data/boards-offres.json";

export interface OffreLegere {
  ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters";
  slug: string;
  entreprise: string;
  id: string;
  titre: string;
  lieu: string;
  url: string;
  publieLe: string;
  /** Jour où le scan quotidien a vu cette offre pour la première fois (`YYYY-MM-DD`). */
  decouverteLe: string;
  lat?: number;
  lng?: number;
}

const boardsOffres = boardsOffresData as OffreLegere[];

/** Combien d'offres verront leur texte récupéré en direct — spec §6. */
const PLAFOND_CANDIDATES = 60;

const NOMS_ATS: Record<OffreLegere["ats"], string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
};

/**
 * Minuscule sans accent. La plage U+0300–U+036F est celle des diacritiques
 * combinants isolés par la décomposition NFD — écrite en échappements, jamais
 * en caractères littéraux, qu'un outil de la chaîne pourrait normaliser en
 * silence et rendre la classe inopérante.
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Un des mots-clés du profil apparaît-il dans le titre ? Liste vide → aucun résultat. */
function matchTitre(titre: string, keywords: string[]): boolean {
  const hay = normalize(titre);
  return keywords.some((k) => k.trim() !== "" && hay.includes(normalize(k)));
}

function dansLage(publieLe: string, maxAgeDays: number): boolean {
  if (!publieLe) return true; // absence de date ≠ preuve d'ancienneté (spec §5)
  const jours = (Date.now() - new Date(publieLe).getTime()) / 86_400_000;
  return jours <= maxAgeDays;
}

function cleOffre(o: Pick<OffreLegere, "ats" | "slug" | "id">): string {
  return `${o.ats}:${o.slug}:${o.id}`;
}

export async function searchBoards(
  profile: JobSearchProfile,
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const candidates = boardsOffres
    .filter((o) => matchTitre(o.titre, profile.keywords))
    .filter((o) => !isExcludedText(o.titre, profile.excludedWords))
    .filter((o) => dansLage(o.publieLe, profile.maxAgeDays))
    // ⚠️ Trier AVANT de plafonner. L'index est rangé par ats/slug/id : sans ce
    // tri, les 60 retenues étaient les premières dans l'ordre alphabétique —
    // mesuré le 04/08/2026, « développeur » ne remontait aucune offre
    // SmartRecruiters, tout l'alphabet s'arrêtant avant. Le plus récent d'abord
    // sert aussi le but du dispositif : une offre du jour a moins de candidats.
    .sort((a, b) => (b.publieLe || "").localeCompare(a.publieLe || ""))
    .slice(0, PLAFOND_CANDIDATES);

  if (candidates.length === 0) return { offers: [], calls: 0 };

  const textes = await obtenirTextes(candidates);

  const offers: JobOffer[] = [];
  for (const o of candidates) {
    const texte = textes.get(cleOffre(o));
    if (texte === undefined) continue; // fetch en échec pour cette offre : on ne l'affiche pas à moitié
    if (isExcludedText(`${o.titre} ${texte}`, profile.excludedWords)) continue;

    offers.push({
      id: `boards-${o.ats}-${o.slug}-${o.id}`,
      source: "boards",
      title: o.titre,
      company: o.entreprise,
      location: o.lieu,
      commuteDestination: o.lieu,
      url: o.url,
      jobText: texte.slice(0, profile.maxDescriptionChars),
      publishedAt: o.publieLe,
      logoUrl: "",
      boardDomain: hostnameOf(o.url),
      boardName: NOMS_ATS[o.ats],
      contractLabel: "",
      salaryLabel: "",
      ...(o.lat !== undefined ? { lat: o.lat } : {}),
      ...(o.lng !== undefined ? { lng: o.lng } : {}),
    });
  }

  return { offers, calls: candidates.length };
}

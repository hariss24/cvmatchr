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
import { dansLeSecteur, villeDuLibelle } from "./boardsLieu";
import { geocodeHome } from "./homeCoords";
import { normKey } from "@/lib/applications/normKey";
import { elargirMotsCles } from "./synonymes";
import boardsOffresData from "./data/boards-offres.json";

export interface OffreLegere {
  ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workday";
  slug: string;
  entreprise: string;
  id: string;
  titre: string;
  lieu: string;
  url: string;
  publieLe: string;
  /** Jour où le scan quotidien a vu cette offre pour la première fois (`YYYY-MM-DD`). */
  decouverteLe: string;
  /**
   * Jour du dernier passage où le board a réellement répondu (`YYYY-MM-DD`).
   * Absent des fichiers antérieurs au 06/08/2026. Sert à écarter les offres
   * qu'un board définitivement mort republierait sinon indéfiniment — voir
   * `sansPerimees` dans `scripts/boards/nouveaute.mjs`.
   */
  vuLe?: string;
  lat?: number;
  lng?: number;
  /**
   * Code département de l'offre (« 75 », « 2A », « 974 »), posé à la
   * construction de l'index à partir du contexte Base Adresse Nationale.
   * Absent des fichiers antérieurs au 07/08/2026 et des offres dont le libellé
   * n'est pas géocodable (« Anywhere in France »).
   */
  dept?: string;
}

const boardsOffres = boardsOffresData as OffreLegere[];

/** Combien d'offres verront leur texte récupéré en direct — spec §6. */
const PLAFOND_CANDIDATES = 60;

/**
 * Répartit la sélection entre les employeurs : la meilleure offre de chacun,
 * puis la deuxième de chacun, et ainsi de suite jusqu'au plafond.
 *
 * ⚠️ Sans cette répartition, quelques gros publieurs mangent toute la
 * sélection. Mesuré le 06/08/2026 sur l'index réel : « infirmier » rendait 34
 * offres Air Liquide sur 60, « vendeur » 17 Petit-Bateau et 17 Uniqlo,
 * « ingénieur » 12 employeurs seulement pour 1 770 candidates. Les doublons y
 * sont pour beaucoup — Colisée publie quinze annonces du même poste au même
 * endroit, qui prennent quinze places avant d'être regroupées en une seule
 * ligne à l'affichage.
 *
 * ⚠️ Un simple quota par entreprise ne suffit PAS, et c'est contre-intuitif :
 * une fois le quota atteint par tous, il reste des places à combler, et elles
 * repartent au plus gros publieur. Essayé le 06/08/2026 avec un quota de 3 —
 * « ingénieur » passait bien de 12 à 31 employeurs, mais « infirmier » gardait
 * ses 34 Air Liquide sur 60, inchangé. La distribution par tours n'a pas ce
 * angle mort : elle dégrade progressivement au lieu de basculer d'un coup.
 *
 * Quand un seul employeur recrute — « aide-soignant », une entreprise dans
 * l'index — il remplit naturellement toutes les places : aucune offre perdue.
 *
 * `offres` doit déjà être triée : l'ordre d'entrée fait la priorité à
 * l'intérieur de chaque employeur, et l'ordre des employeurs eux-mêmes.
 */
export function repartirParEntreprise<T extends { entreprise: string }>(
  offres: T[],
  plafond: number,
): T[] {
  const files = new Map<string, T[]>();
  for (const o of offres) {
    const file = files.get(o.entreprise);
    if (file) file.push(o);
    else files.set(o.entreprise, [o]);
  }

  const gardees: T[] = [];
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
    if (!servi) break; // toutes les files épuisées avant le plafond
    tour++;
  }
  return gardees;
}

const NOMS_ATS: Record<OffreLegere["ats"], string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
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

/**
 * Ancienneté d'une offre, mesurée sur la PLUS ANCIENNE des deux dates connues.
 *
 * `publieLe` seul se laisse tromper : chez Greenhouse (1 578 offres de l'index)
 * ce champ est `updated_at`, donc une correction de faute de frappe rajeunit
 * une annonce de trois mois. `decouverteLe` — le jour où notre scan a vu
 * l'offre pour la première fois — ne peut pas être rajeuni par l'entreprise.
 * Retenir la plus ancienne des deux, c'est refuser qu'une retouche efface
 * l'historique. Une offre réellement publiée avant la création de l'index
 * garde de son côté son vrai âge, puisque `publieLe` est alors le plus ancien.
 */
function dansLage(o: OffreLegere, maxAgeDays: number): boolean {
  const dates = [o.publieLe, o.decouverteLe]
    .map((d) => (d ? new Date(d).getTime() : Number.NaN))
    .filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return true; // absence de date ≠ preuve d'ancienneté (spec §5)
  return (Date.now() - Math.min(...dates)) / 86_400_000 <= maxAgeDays;
}

/**
 * Date utilisée pour classer une offre : sa parution si l'ATS la donne, sinon
 * le jour où le scan l'a vue pour la première fois. Une offre sans date ne doit
 * pas être traitée comme la plus vieille de toutes.
 */
export function dateEffective(o: Pick<OffreLegere, "publieLe" | "decouverteLe">): string {
  return o.publieLe || o.decouverteLe || "";
}

function cleOffre(o: Pick<OffreLegere, "ats" | "slug" | "id">): string {
  return `${o.ats}:${o.slug}:${o.id}`;
}

/**
 * Écarte les annonces que `dedupeOffers` fusionnera de toute façon à l'arrivée.
 *
 * ⚠️ L'ordre comptait, et il était mauvais : le dédoublonnage inter-source
 * agissait APRÈS le plafond de 60. Les quinze annonces identiques que Colisée
 * publie pour le même poste au même endroit prenaient donc quinze places, puis
 * se réduisaient à une ligne à l'affichage. Le candidat ne voyait aucun
 * doublon — il voyait simplement moins d'offres, sans savoir pourquoi : mesuré
 * le 06/08/2026, « infirmier » descendait de 60 sélectionnées à 45 affichées,
 * « vendeur » à 48. En dédoublonnant d'abord, les huit recherches testées
 * atteignent les 60.
 *
 * Même clé que `dedupeOffers`, donc mêmes fusions et même compromis assumé :
 * deux postes réellement distincts au même intitulé dans la même entreprise
 * n'en font qu'un. La liste étant déjà triée, c'est la plus récente qui reste.
 */
function sansRedites(offres: OffreLegere[]): OffreLegere[] {
  const vues = new Set<string>();
  return offres.filter((o) => {
    const k = normKey(o.entreprise, o.titre);
    if (!k) return true;
    if (vues.has(k)) return false;
    vues.add(k);
    return true;
  });
}

/**
 * Priorité d'une offre dans la sélection : 2 si son titre contient un mot-clé
 * réellement saisi par le candidat, 1 s'il ne contient qu'un équivalent ajouté
 * par la table de synonymes, 0 sinon (ne devrait pas arriver, l'offre ayant
 * déjà passé `matchTitre`).
 *
 * ⚠️ Sans ce niveau de tri, le plafond de 60 se remplissait par date seule.
 * Mesuré le 07/08/2026 sur une recherche marketing : les 60 places partaient à
 * des offres amenées par un synonyme, et les offres correspondant aux intitulés
 * réellement tapés n'entraient jamais dans la sélection. La date reste le
 * second critère : à pertinence égale, une offre du jour a moins de candidats.
 */
function pertinence(titre: string, saisis: string[], elargis: string[]): number {
  const hay = normalize(titre);
  if (saisis.some((k) => k.trim() !== "" && hay.includes(normalize(k)))) return 2;
  if (elargis.some((k) => k.trim() !== "" && hay.includes(normalize(k)))) return 1;
  return 0;
}

export async function searchBoards(
  profile: JobSearchProfile,
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  // Un seul géocodage par recherche, et seulement si une commune est demandée :
  // c'est ce qui permet d'appliquer le rayon réel aux offres qui portent des
  // coordonnées — 31 % de l'index, mesuré le 06/08/2026 (6 123 sur 19 555 ;
  // le chiffre de 53 % écrit ici datait d'avant l'arrivée de Workday, qui n'en
  // fournit aucune). En cas d'échec, `boardsLieu` retombe sur les libellés.
  const cible =
    profile.location.code && profile.location.kind === "commune"
      ? await geocodeHome(villeDuLibelle(profile.location.label))
      : null;

  // ⚠️ Élargissement aux intitulés équivalents AVANT tout filtre. Ces boards
  // sont ceux de grands groupes, qui publient en anglais pour des postes en
  // France : « développeur » laissait 434 offres invisibles, « responsable RH »
  // 147 — mesuré le 06/08/2026. Voir `synonymes.ts`.
  const motsCles = elargirMotsCles(profile.keywords);

  const triees = boardsOffres
    .filter((o) => matchTitre(o.titre, motsCles))
    .filter((o) => !isExcludedText(o.titre, profile.excludedWords))
    .filter((o) => dansLage(o, profile.maxAgeDays))
    .filter((o) => dansLeSecteur(o, profile.location, cible))
    // ⚠️ Trier AVANT de plafonner. L'index est rangé par ats/slug/id : sans ce
    // tri, les 60 retenues étaient les premières dans l'ordre alphabétique —
    // mesuré le 04/08/2026, « développeur » ne remontait aucune offre
    // SmartRecruiters, tout l'alphabet s'arrêtant avant. Le plus récent d'abord
    // sert aussi le but du dispositif : une offre du jour a moins de candidats.
    //
    // ⚠️ Le repli sur `decouverteLe` n'est pas cosmétique : 7 871 des 8 538
    // offres Workday n'ont pas de date de publication. Trier sur `publieLe`
    // seul les renvoyait toutes en fin de liste, donc hors du plafond — mesuré
    // le 06/08/2026, « ingénieur » retenait 0 offre Workday sur 1 770
    // candidates, et Thales, Airbus et Safran étaient invisibles. Même piège
    // que le tri alphabétique, sous une autre forme.
    .sort(
      (a, b) =>
        pertinence(b.titre, profile.keywords, motsCles) -
          pertinence(a.titre, profile.keywords, motsCles) ||
        dateEffective(b).localeCompare(dateEffective(a)),
    );

  const candidates = repartirParEntreprise(sansRedites(triees), PLAFOND_CANDIDATES);

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
      discoveredAt: o.decouverteLe,
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

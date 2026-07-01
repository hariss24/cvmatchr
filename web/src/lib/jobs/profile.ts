/**
 * Profil de recherche d'offres — pièce centrale de la paramétrabilité.
 *
 * Tous les réglages modifiables (adresse, postes visés, modes de transport, filtres, seuils,
 * profil candidat pour le scoring) vivent ici, dans un objet unique passé en argument aux
 * fonctions `lib/jobs/`. Aujourd'hui une seule instance, `DEFAULT_PROFILE` (profil de Hariss,
 * repris de `agent-taff/bot.py`). Demain (multi-utilisateur), une instance par compte, sans
 * toucher au cœur de la logique. Cf. spec `docs/superpowers/specs/2026-07-01-offres-nextjs-design.md`.
 */

export type CommuteMode = "transit" | "driving" | "bicycling" | "walking";

export interface JobSearchProfile {
  /** Adresse de départ pour le calcul du trajet. */
  homeAddress: string;
  /** Intitulés de postes recherchés (une requête France Travail par mot-clé). */
  keywords: string[];
  /** Modes de transport à calculer (Google Distance Matrix). */
  commuteModes: CommuteMode[];
  /** Types de contrat France Travail (ex. ["CDI", "CDD"]). */
  contractTypes: string[];
  /** Code région France Travail (ex. "11" = Île-de-France). */
  region: string;
  /** Ancienneté maximale des offres, en jours. */
  maxAgeDays: number;
  /** Mots interdits dans titre/description/type de contrat (filtre stages/alternances). */
  excludedWords: string[];
  /** Score minimum pour retenir une offre. */
  minScore: number;
  /** Nombre maximum d'offres notées par recherche (garde-fou quota). */
  scoreLimit: number;
  /** Troncature de la description envoyée à l'IA. */
  maxDescriptionChars: number;
  /** Résumé du candidat injecté dans le prompt de scoring. */
  candidateSummary: string;
  /** Barème de notation injecté dans le prompt de scoring. */
  scoringCriteria: string;
}

/** Profil par défaut = Hariss (repris à l'identique de `agent-taff/bot.py`). */
export const DEFAULT_PROFILE: JobSearchProfile = {
  homeAddress: "4 rue jean bouton 75012 Paris",
  keywords: [
    "Chargé SEO",
    "Référenceur web",
    "Éditorial web",
    "Intégrateur WordPress",
    "Développeur Shopify",
    "Chargé communication digital",
    "Webmaster",
    "Webmaster éditorial",
    "Chargé contenu web",
    "Chargé mission digital",
    "Gestionnaire contenu CMS",
    "Chargé marketing digital",
    "Chargé projet digital",
    "Gestionnaire de contenu digital",
    "Spécialiste contenu digital",
    "Rédacteur web SEO",
    "Chargé de contenu éditorial",
    "Community Manager SEO",
    "Gestionnaire de sites web",
    "Référencement naturel",
    "Analyste de contenu web",
    "Chargé SEO Junior",
    "Chargé de webmarketing",
    "Content manager",
    "Content strategist",
    "Marketing digital",
    "Marketing digital Junior",
    "Chef de projet digital",
    "Chef de projet marketing digital",
  ],
  commuteModes: ["transit", "bicycling", "walking"],
  contractTypes: ["CDI", "CDD"],
  region: "11",
  maxAgeDays: 30,
  excludedWords: ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"],
  minScore: 70,
  scoreLimit: 40,
  maxDescriptionChars: 3000,
  candidateSummary:
    "Nom: Hariss Hafeji (Paris 75012)\n" +
    "Titre: Webmaster / Chargé de projet Web\n" +
    "Formation: Master 2 E-commerce (UPEC)\n" +
    "Expériences: 3 stages/alternances (Webmastering Drupal/WP, SEO/SEA, Analytics, UI/UX, Gestion de projet agile).\n" +
    "Compétences: HTML/CSS/JS/PHP, CMS (Drupal, WordPress), SEO on-page, SEA (Google Ads), Analytics (GA4, Looker), UI/UX (Figma).",
  scoringCriteria:
    "score_tech (0-40) : Match avec sa stack (CMS, intégration, SEO, analytics).\n" +
    "score_seniority (0-20) : Adapté à un profil Junior (Bac+5 avec 1-2 ans d'expérience en stage).\n" +
    "score_sector (0-15) : Pertinence dans le secteur web/e-commerce.\n" +
    "score_geo (0-15) : Ajuste avec les temps de trajet fournis (pénalise si > 45 min depuis Paris 12e).\n" +
    "score_red_flags (0-10) : 10 = aucun piège (salaire flou, travail dissimulé, ou alternance masquée).",
};

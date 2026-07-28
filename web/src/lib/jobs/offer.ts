/**
 * Contrat commun aux trois sources d'offres. Chaque provider (`francetravail.ts`,
 * `adzuna.ts`, `jsearch.ts`) traduit sa réponse vers ce type ; tout le pipeline
 * aval (pré-tri, notation IA, stockage, affichage) ne connaît que celui-ci.
 */

/** Source technique ayant fait remonter l'offre (≠ jobboard où elle est publiée). */
export type SourceId = "francetravail" | "adzuna" | "jsearch";

/** Offre normalisée pour l'affichage et le scoring (contrat unique client ⇄ serveur). */
export interface JobOffer {
  id: string;
  source: SourceId;
  title: string;
  company: string;
  location: string;            // libellé lisible (affichage)
  commuteDestination: string;  // "lat,lng" si dispo, sinon libellé ; "" si absent
  url: string;
  jobText: string;
  publishedAt: string;         // ISO ; "" si absente
  /** Logo de l'entreprise fourni par la source ; "" si aucune (≈ 1 offre sur 3). */
  logoUrl: string;
  /** Hôte complet du lien de l'offre, ex. "jobs.lilylifestyle.co.uk" ; "" si inconnu. */
  boardDomain: string;
  /** Nom lisible du jobboard, ex. "LinkedIn". Sert d'infobulle et de repli. */
  boardName: string;
  /** "CDI · Plein temps", "CDD · 8 mois"… ; "" si inconnu. */
  contractLabel: string;
  /** "33–36 k€ / an" ; "" si non précisé. */
  salaryLabel: string;

  // --- Champs structurés, fournis par France Travail uniquement. -------------
  // Absents chez Adzuna et JSearch, qui n'exposent aucune taxonomie métier
  // exploitable (spec §2.6). Le classement a donc une voie textuelle de repli
  // pour chaque critère qui s'appuie dessus.

  /** Code ROME 4.0 officiel de l'offre (100 % des offres France Travail). */
  romeCode?: string;
  /** Compétences codifiées ; `exigence` vaut "E" (exigée) ou "S" (souhaitée). */
  competences?: { code: string; exigence: string }[];
  /** "D" débutant accepté, "S" expérience souhaitée, "E" expérience exigée. */
  experienceExige?: string;
  /** Années d'expérience extraites de `experienceLibelle` ("3 An(s)" → 3). */
  experienceYears?: number;
  /** Latitude du lieu de travail, pour la distance locale. */
  lat?: number;
  /** Longitude du lieu de travail. */
  lng?: number;
}

/**
 * Montants annuels en euros → libellé court. Adzuna et JSearch renvoient des
 * nombres ; France Travail renvoie déjà une phrase et n'utilise pas ce helper.
 */
export function yearlySalaryLabel(min?: number | null, max?: number | null): string {
  const k = (n: number) => {
    const v = n / 1000;
    // Une décimale seulement si elle apporte quelque chose (41,1 mais 40).
    return (Math.round(v * 10) / 10).toLocaleString("fr-FR");
  };
  if (min && max && max !== min) return `${k(min)}–${k(max)} k€ / an`;
  const one = min || max;
  return one ? `${k(one)} k€ / an` : "";
}

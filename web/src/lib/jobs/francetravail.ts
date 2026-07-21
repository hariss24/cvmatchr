/**
 * Accès à l'API France Travail (offres d'emploi). Port de `agent-taff/bot.py`
 * (`get_ft_token` / `fetch_offers` / filtre stages-alternances), en `fetch` natif.
 */

import type { JobSearchProfile } from "./profile";

/** Offre brute renvoyée par l'API France Travail (champs utilisés uniquement). */
export interface RawOffer {
  id?: string;
  intitule?: string;
  description?: string;
  alternance?: boolean;
  typeContratLibelle?: string;
  dateCreation?: string;
  entreprise?: { nom?: string };
  lieuTravail?: { libelle?: string; latitude?: number; longitude?: number };
  origineOffre?: { urlOrigine?: string };
}

/** Offre normalisée pour l'affichage et le scoring (contrat unique client ⇄ serveur). */
export interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;        // libellé lisible (affichage)
  commuteDestination: string; // "lat,lng" si dispo, sinon libellé (calcul trajet) ; "" si absent
  url: string;
  jobText: string;
  publishedAt: string;     // date de création de l'offre (ISO France Travail) ; "" si absente
}

const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

/** Jeton OAuth (client_credentials) France Travail. */
export async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${TOKEN_URL}?realm=%2Fpartenaire`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "api_offresdemploiv2 o2dsoffre",
    }),
  });
  if (!res.ok) {
    throw new Error(`Authentification France Travail échouée (${res.status}).`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Jeton France Travail absent de la réponse.");
  return data.access_token;
}

/** Formate une date en `YYYY-MM-DDTHH:MM:SSZ` (format attendu par l'API). */
function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Recherche les offres pour un mot-clé. L'API exige `minCreationDate` ET `maxCreationDate`.
 * Renvoie la liste brute (`resultats`) ; `[]` si l'API répond autre chose que 200/206.
 */
export async function fetchOffers(
  token: string,
  keyword: string,
  profile: JobSearchProfile,
): Promise<RawOffer[]> {
  const now = new Date();
  const minDate = new Date(now.getTime() - profile.maxAgeDays * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    motsCles: keyword,
    typeContrat: profile.contractTypes.join(","),
    natureContrat: "E1",
    minCreationDate: isoSeconds(minDate),
    maxCreationDate: isoSeconds(now),
    range: "0-99",
  });

  // Géographie (conditionnelle selon la portée choisie).
  const loc = profile.location;
  if (loc.code) {
    if (loc.kind === "commune") {
      params.set("commune", loc.code);
      params.set("distance", String(loc.radiusKm));
    } else if (loc.kind === "departement") {
      params.set("departement", loc.code);
    } else {
      params.set("region", loc.code);
    }
  }

  if (profile.debutantAccepte) params.set("experienceExige", "D");
  if (profile.experienceLevel) params.set("experience", profile.experienceLevel);
  if (profile.qualification) params.set("qualification", profile.qualification);
  if (profile.tempsPlein) params.set("tempsPlein", profile.tempsPlein);
  if (profile.romeCodes.length) params.set("codeROME", profile.romeCodes.join(","));
  if (profile.salaireMin != null) {
    params.set("salaireMin", String(profile.salaireMin));
    params.set("periodeSalaire", profile.periodeSalaire);
  }

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status !== 200 && res.status !== 206) return [];
  const data = (await res.json()) as { resultats?: RawOffer[] };
  return data.resultats ?? [];
}

/** True si l'offre est un stage/alternance (filtre local strict, port de `bot.py`). */
export function isExcluded(offer: RawOffer, excludedWords: string[]): boolean {
  if (offer.alternance) return true;
  const text = `${offer.intitule ?? ""} ${offer.description ?? ""} ${offer.typeContratLibelle ?? ""}`.toLowerCase();
  if (excludedWords.some((w) => text.includes(w))) return true;
  // "stage" en mot isolé (les tirets comptent comme séparateurs).
  return text.replace(/-/g, " ").split(/\s+/).includes("stage");
}

/** Destination pour le trajet : coordonnées si dispo, sinon libellé du lieu, sinon "". */
function commuteDestination(offer: RawOffer): string {
  const lieu = offer.lieuTravail;
  if (!lieu) return "";
  if (typeof lieu.latitude === "number" && typeof lieu.longitude === "number") {
    return `${lieu.latitude},${lieu.longitude}`;
  }
  return lieu.libelle ?? "";
}

/** Offre brute → offre normalisée (description tronquée + destination de trajet). */
export function mapOffer(offer: RawOffer, maxDescriptionChars: number): JobOffer {
  return {
    id: offer.id ?? "",
    title: offer.intitule ?? "",
    company: offer.entreprise?.nom ?? "",
    location: offer.lieuTravail?.libelle ?? "",
    commuteDestination: commuteDestination(offer),
    url: offer.origineOffre?.urlOrigine ?? "",
    jobText: (offer.description ?? "").slice(0, maxDescriptionChars),
    publishedAt: offer.dateCreation ?? "",
  };
}

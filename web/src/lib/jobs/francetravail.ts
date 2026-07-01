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

/** Offre normalisée pour l'affichage et le scoring. */
export interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  jobText: string;
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
    region: profile.region,
    typeContrat: profile.contractTypes.join(","),
    natureContrat: "E1",
    minCreationDate: isoSeconds(minDate),
    maxCreationDate: isoSeconds(now),
    range: "0-99",
  });
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

/** Offre brute → offre normalisée (avec description tronquée). */
export function mapOffer(offer: RawOffer, maxDescriptionChars: number): JobOffer {
  return {
    id: offer.id ?? "",
    title: offer.intitule ?? "",
    company: offer.entreprise?.nom ?? "",
    location: offer.lieuTravail?.libelle ?? "",
    url: offer.origineOffre?.urlOrigine ?? "",
    jobText: (offer.description ?? "").slice(0, maxDescriptionChars),
  };
}

/**
 * Accès à l'API France Travail (offres d'emploi). Port de `agent-taff/bot.py`
 * (`get_ft_token` / `fetch_offers` / filtre stages-alternances), en `fetch` natif.
 */

import type { JobSearchProfile } from "./profile";
import { isExcludedText } from "./exclude";
import { parVagues, fetchDelai } from "./reseau";

/** Offre brute renvoyée par l'API France Travail (champs utilisés uniquement). */
export interface RawOffer {
  id?: string;
  intitule?: string;
  description?: string;
  alternance?: boolean;
  typeContratLibelle?: string;
  dateCreation?: string;
  entreprise?: { nom?: string; logo?: string };
  lieuTravail?: { libelle?: string; latitude?: number; longitude?: number };
  origineOffre?: { urlOrigine?: string };
  romeCode?: string;
  competences?: { code?: string; libelle?: string; exigence?: string }[];
  experienceExige?: string;
  experienceLibelle?: string;
  salaire?: { libelle?: string };
}

import type { JobOffer } from "./offer";

// Réexport de compatibilité : plusieurs modules importent encore `JobOffer`
// depuis ce fichier. Les nouveaux modules importent depuis `./offer`.
export type { JobOffer } from "./offer";

const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

/** Jeton OAuth (client_credentials) France Travail. */
async function getToken(clientId: string, clientSecret: string): Promise<string> {
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
async function fetchOffers(
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

  const res = await fetchDelai(`${SEARCH_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status !== 200 && res.status !== 206) return [];
  const data = (await res.json()) as { resultats?: RawOffer[] };
  return data.resultats ?? [];
}

/** True si l'offre est un stage/alternance (filtre local strict, port de `bot.py`). */
export function isExcluded(offer: RawOffer, excludedWords: string[]): boolean {
  if (offer.alternance) return true;
  return isExcludedText(
    `${offer.intitule ?? ""} ${offer.description ?? ""} ${offer.typeContratLibelle ?? ""}`,
    excludedWords,
  );
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

/** « 3 An(s) » → 3 ; undefined si le libellé n'annonce pas d'années. */
function experienceYears(libelle?: string): number | undefined {
  const m = /(\d+)\s*an/i.exec(libelle ?? "");
  return m ? Number(m[1]) : undefined;
}

export function mapOffer(offer: RawOffer, maxDescriptionChars: number): JobOffer {
  const lieu = offer.lieuTravail;
  const competences = (offer.competences ?? [])
    .filter((c): c is { code: string; exigence?: string } => Boolean(c.code))
    .map((c) => ({ code: c.code, exigence: c.exigence ?? "S" }));

  return {
    id: offer.id ?? "",
    source: "francetravail",
    title: offer.intitule ?? "",
    company: offer.entreprise?.nom ?? "",
    location: lieu?.libelle ?? "",
    commuteDestination: commuteDestination(offer),
    url: offer.origineOffre?.urlOrigine ?? "",
    jobText: (offer.description ?? "").slice(0, maxDescriptionChars),
    publishedAt: offer.dateCreation ?? "",
    logoUrl: offer.entreprise?.logo ?? "",
    boardDomain: "",
    boardName: "France Travail",
    contractLabel: offer.typeContratLibelle ?? "",
    salaryLabel: offer.salaire?.libelle ?? "",
    ...(offer.romeCode ? { romeCode: offer.romeCode } : {}),
    ...(competences.length > 0 ? { competences } : {}),
    ...(offer.experienceExige ? { experienceExige: offer.experienceExige } : {}),
    ...(experienceYears(offer.experienceLibelle) !== undefined
      ? { experienceYears: experienceYears(offer.experienceLibelle) }
      : {}),
    ...(typeof lieu?.latitude === "number" ? { lat: lieu.latitude } : {}),
    ...(typeof lieu?.longitude === "number" ? { lng: lieu.longitude } : {}),
  };
}

export interface FranceTravailCreds {
  clientId: string;
  clientSecret: string;
}

/**
 * Point d'entrée unique du provider. Si la source est désactivée ou les
 * identifiants manquants, renvoie []. Gère la boucle sur les mots-clés,
 * le dédoublonnage intra-source (par id), le filtrage et le mapping.
 */
export async function search(
  profile: JobSearchProfile,
  creds: FranceTravailCreds
): Promise<{ offers: JobOffer[], calls: number }> {
  if (!profile.sources.francetravail) return { offers: [], calls: 0 };
  if (!creds.clientId || !creds.clientSecret) return { offers: [], calls: 0 };

  try {
    const token = await getToken(creds.clientId, creds.clientSecret);
    const all: JobOffer[] = [];
    const seen = new Set<string>();

    // Chaque mot-clé attrape sa propre panne : sans ce `catch`, une seule requête
    // en échec remonterait au `try` englobant et emporterait toute la source, y
    // compris les résultats des mots-clés qui ont abouti.
    const parMotCle = await parVagues(profile.keywords, (kw) =>
      fetchOffers(token, kw, profile).catch(() => [] as RawOffer[]),
    );

    // Le quota se compte en requêtes émises, échecs compris.
    const calls = profile.keywords.length;

    for (const raw of parMotCle) {
      for (const r of raw) {
        if (r.id && !seen.has(r.id) && !isExcluded(r, profile.excludedWords)) {
          seen.add(r.id);
          all.push(mapOffer(r, profile.maxDescriptionChars));
        }
      }
    }
    return { offers: all, calls };
  } catch (err) {
    console.error("France Travail search error:", err);
    return { offers: [], calls: 0 };
  }
}



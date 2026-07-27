/**
 * Accès à JSearch (OpenWeb Ninja), wrapper légal de Google for Jobs : LinkedIn,
 * Indeed, Glassdoor et des milliers d'autres sites via l'index Google.
 *
 * Seule source à fournir un logo d'entreprise (`employer_logo`, ≈ 6 offres sur
 * 10 mesuré en direct) et le jobboard réel (`job_publisher` + `job_apply_link`).
 *
 * Elle ignore rayon, type de contrat et salaire : ces critères ne sont pas des
 * paramètres de l'API. Les filtres app-side (`excludedWords`, `includeKeywords`)
 * et le scoring IA, qui reçoit le profil complet, absorbent l'écart.
 *
 * Quota gratuit : 200 appels / mois.
 */

import type { JobSearchProfile } from "./profile";
import { type JobOffer, yearlySalaryLabel } from "./offer";
import { hostnameOf } from "./board";
import { isExcludedText } from "./exclude";

const SEARCH_URL = "https://api.openwebninja.com/jsearch/search-v2";

/** Offre brute JSearch (champs utilisés uniquement). */
interface RawJSearch {
  job_id?: string;
  job_title?: string;
  job_description?: string;
  employer_name?: string;
  employer_logo?: string | null;
  job_location?: string;
  job_city?: string;
  job_employment_type?: string;
  job_publisher?: string;
  job_apply_link?: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
}

/** Paliers de `date_posted` : le plus grand ne dépassant pas `maxAgeDays`. */
export function datePosted(maxAgeDays: number): "today" | "3days" | "week" | "month" {
  if (maxAgeDays >= 30) return "month";
  if (maxAgeDays >= 7) return "week";
  if (maxAgeDays >= 3) return "3days";
  return "today";
}

/** Le lieu n'a pas de paramètre dédié : il s'écrit dans la requête en langage naturel. */
function placeName(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * Une requête par mot-clé, résultats fusionnés et dédoublonnés par id.
 * Une requête en échec renvoie [] sans faire échouer les autres.
 */
export async function searchJSearch(
  profile: JobSearchProfile,
  creds: { apiKey: string },
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const place = placeName(profile.location.label);
  const seen = new Set<string>();
  const offers: JobOffer[] = [];
  let calls = 0;

  for (const keyword of profile.keywords) {
    const params = new URLSearchParams({
      query: place ? `${keyword} en ${place}` : keyword,
      country: "fr",
      language: "fr",
      date_posted: datePosted(profile.maxAgeDays),
      num_pages: "1",
    });

    calls++;
    let raw: RawJSearch[] = [];
    try {
      const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: { "x-api-key": creds.apiKey, Accept: "application/json" },
      });
      if (res.ok) raw = ((await res.json()) as { data?: { jobs?: RawJSearch[] } }).data?.jobs ?? [];
    } catch {
      // Panne réseau ponctuelle : cette requête ne rapporte rien, les autres continuent.
    }

    for (const o of raw) {
      const id = o.job_id ? `jsearch-${o.job_id}` : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (isExcludedText(`${o.job_title ?? ""} ${o.job_description ?? ""}`, profile.excludedWords)) continue;

      const url = o.job_apply_link ?? "";
      const domain = hostnameOf(url);
      const place2 = o.job_location || o.job_city || "";
      offers.push({
        id,
        source: "jsearch",
        title: o.job_title ?? "",
        company: o.employer_name ?? "",
        location: place2,
        commuteDestination: place2,
        url,
        jobText: (o.job_description ?? "").slice(0, profile.maxDescriptionChars),
        publishedAt: o.job_posted_at_datetime_utc ?? "",
        logoUrl: o.employer_logo ?? "",
        boardDomain: domain,
        // `job_publisher` est le vrai nom du jobboard ("LinkedIn", "Indeed"…).
        boardName: o.job_publisher || domain,
        contractLabel: o.job_employment_type ?? "",
        salaryLabel: yearlySalaryLabel(o.job_min_salary, o.job_max_salary),
      });
    }
  }
  return { offers, calls };
}

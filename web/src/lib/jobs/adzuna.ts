/**
 * Accès à l'API Adzuna (agrégateur de 270+ jobboards partenaires français).
 * Endpoint vérifié en direct : 2 258 offres pour « développeur » à Paris.
 *
 * Adzuna ne fournit ni logo d'entreprise ni jobboard d'origine : `redirect_url`
 * pointe toujours vers adzuna.fr. La pastille de la carte affiche donc Adzuna.
 */

import type { JobSearchProfile } from "./profile";
import { type JobOffer, yearlySalaryLabel } from "./offer";
import { hostnameOf } from "./board";
import { isExcludedText } from "./exclude";

const SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/fr/search/1";

/** Offre brute Adzuna (champs utilisés uniquement). */
interface RawAdzuna {
  id?: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number | null;
  salary_max?: number | null;
  contract_type?: string;  // "permanent" | "contract"
  contract_time?: string;  // "full_time" | "part_time"
  latitude?: number;
  longitude?: number;
}

/** `where` attend un nom de lieu en clair : on retire le code postal entre parenthèses. */
function placeName(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, "").trim();
}

/** "CDI · Plein temps", "CDD", "" — Adzuna ne connaît que permanent/contract. */
function contractLabel(o: RawAdzuna): string {
  const kind = o.contract_type === "permanent" ? "CDI" : o.contract_type === "contract" ? "CDD" : "";
  const time = o.contract_time === "full_time" ? "Plein temps"
    : o.contract_time === "part_time" ? "Temps partiel" : "";
  return [kind, time].filter(Boolean).join(" · ");
}

/**
 * Une requête par mot-clé, résultats fusionnés et dédoublonnés par id.
 * `calls` compte les requêtes émises (quota gratuit : 1 000 / mois).
 * Une requête en échec renvoie [] sans faire échouer les autres.
 */
export async function searchAdzuna(
  profile: JobSearchProfile,
  creds: { appId: string; appKey: string },
): Promise<{ offers: JobOffer[]; calls: number }> {
  if (profile.keywords.length === 0) return { offers: [], calls: 0 };

  const seen = new Set<string>();
  const offers: JobOffer[] = [];
  let calls = 0;

  for (const keyword of profile.keywords) {
    const params = new URLSearchParams({
      app_id: creds.appId,
      app_key: creds.appKey,
      results_per_page: "50",
      what: keyword,
      max_days_old: String(profile.maxAgeDays),
      "content-type": "application/json",
    });

    const place = placeName(profile.location.label);
    if (place) {
      params.set("where", place);
      // Le rayon n'a de sens que pour une commune (cf. LocationFilter).
      if (profile.location.kind === "commune") params.set("distance", String(profile.location.radiusKm));
    }

    // Adzuna n'a pas de CDD : filtrer sur permanent dès que CDI est coché
    // exclurait des CDD légitimes. On ne filtre que si CDI est le seul type.
    if (profile.contractTypes.length === 1 && profile.contractTypes[0] === "CDI") {
      params.set("permanent", "1");
    }
    if (profile.salaireMin != null) params.set("salary_min", String(profile.salaireMin));

    calls++;
    let raw: RawAdzuna[] = [];
    try {
      const res = await fetch(`${SEARCH_URL}?${params}`, { headers: { Accept: "application/json" } });
      if (res.ok) raw = ((await res.json()) as { results?: RawAdzuna[] }).results ?? [];
    } catch {
      // Panne réseau ponctuelle : cette requête ne rapporte rien, les autres continuent.
    }

    for (const o of raw) {
      const id = o.id ? `adzuna-${o.id}` : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (isExcludedText(`${o.title ?? ""} ${o.description ?? ""}`, profile.excludedWords)) continue;

      const url = o.redirect_url ?? "";
      offers.push({
        id,
        source: "adzuna",
        title: o.title ?? "",
        company: o.company?.display_name ?? "",
        location: o.location?.display_name ?? "",
        commuteDestination: o.location?.display_name ?? "",
        url,
        jobText: (o.description ?? "").slice(0, profile.maxDescriptionChars),
        publishedAt: o.created ?? "",
        logoUrl: "",
        boardDomain: hostnameOf(url),
        boardName: "Adzuna",
        contractLabel: contractLabel(o),
        salaryLabel: yearlySalaryLabel(o.salary_min, o.salary_max),
        ...(typeof o.latitude === "number" ? { lat: o.latitude } : {}),
        ...(typeof o.longitude === "number" ? { lng: o.longitude } : {}),
      });
    }
  }
  return { offers, calls };
}

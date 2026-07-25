import { normKey } from "./normKey";
import type { Application } from "./types";

/** Forme minimale d'une entrée d'historique nécessaire au rattachement. */
export interface BackfillEntry {
  id: string;
  created_at: string;
  doc_type: string;
  company?: string;
  role?: string;
  job_desc?: string;
  applicationId?: string;
}

export interface BackfillPlan {
  applications: Application[];
  links: Array<{ entryId: string; applicationId: string }>;
}

/**
 * Calcule les candidatures à créer depuis l'historique existant, groupées par
 * entreprise+poste. Fonction pure : `newId` fournit les identifiants pour que le
 * résultat soit déterministe en test. Idempotent en pratique parce que les
 * entrées déjà rattachées (`applicationId`) sont ignorées.
 */
export function planBackfill(
  entries: BackfillEntry[],
  now: number,
  newId: (index: number) => string,
): BackfillPlan {
  const groups = new Map<string, BackfillEntry[]>();
  for (const e of entries) {
    if (e.applicationId) continue;
    const key = normKey(e.company || "", e.role || "");
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const applications: Application[] = [];
  const links: BackfillPlan["links"] = [];
  let i = 0;
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const first = sorted[0];
    const at = new Date(first.created_at).getTime();
    const id = newId(i);
    i += 1;
    applications.push({
      id,
      createdAt: at,
      company: first.company || "",
      role: first.role || "",
      normKey: key,
      jobText: sorted.find((e) => (e.job_desc || "").trim())?.job_desc || "",
      jobUrl: "",
      source: "generated",
      events: [{ date: at, type: "applied", source: "system" }],
      notes: "",
      updatedAt: now,
    });
    for (const e of sorted) links.push({ entryId: e.id, applicationId: id });
  }
  return { applications, links };
}

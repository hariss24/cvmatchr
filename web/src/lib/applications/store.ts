import {
  listApplicationsRaw,
  getApplicationByNormKey,
  putApplication,
  deleteApplicationRecord,
  listHistoryByApplication,
  listUnattachedHistory,
  updateHistoryFields,
  deleteHistoryEntries,
  type HistoryEntry,
} from "@/lib/storage/db";
import { normKey } from "./normKey";
import { anonymousIdsToDelete } from "./shelf";
import { planBackfill } from "./backfill";
import type { Application } from "./types";

const BACKFILL_KEY = "applications-backfill-v1";

/** Candidatures, les plus récentes d'abord (date d'envoi). */
export async function listApplications(): Promise<Application[]> {
  const all = await listApplicationsRaw();
  const at = (a: Application) => a.events.find((e) => e.type === "applied")?.date ?? a.createdAt;
  return all.sort((x, y) => at(y) - at(x));
}

export async function listApplicationDocuments(applicationId: string): Promise<HistoryEntry[]> {
  return listHistoryByApplication(applicationId);
}

/**
 * Crée la candidature correspondant à un document exporté, ou retourne
 * l'existante. Régénérer un CV pour la même entreprise+poste n'est pas une
 * nouvelle candidature : aucun événement n'est ajouté dans ce cas.
 * Retourne `undefined` si entreprise ET poste sont vides.
 */
export async function upsertApplicationForDocument(input: {
  company: string;
  role: string;
  source: Application["source"];
  jobText?: string;
  jobUrl?: string;
  now?: number;
}): Promise<string | undefined> {
  const key = normKey(input.company, input.role);
  if (!key) return undefined;

  const existing = await getApplicationByNormKey(key);
  if (existing) return existing.id;

  const now = input.now ?? Date.now();
  const app: Application = {
    id: crypto.randomUUID(),
    createdAt: now,
    company: input.company,
    role: input.role,
    normKey: key,
    jobText: input.jobText || "",
    jobUrl: input.jobUrl || "",
    source: input.source,
    events: [{ date: now, type: "applied", source: input.source === "generated" ? "system" : "manual" }],
    notes: "",
    updatedAt: now,
  };
  await putApplication(app);
  return app.id;
}

export async function addApplicationEvent(
  id: string,
  type: "interview" | "rejected",
  now?: number,
): Promise<void> {
  const all = await listApplicationsRaw();
  const app = all.find((a) => a.id === id);
  if (!app) return;
  const at = now ?? Date.now();
  app.events = [...app.events, { date: at, type, source: "manual" }];
  app.updatedAt = at;
  await putApplication(app);
}

/** Annule le dernier événement de statut saisi à la main (entretien ou refus). */
export async function undoLastStatusEvent(id: string): Promise<void> {
  const all = await listApplicationsRaw();
  const app = all.find((a) => a.id === id);
  if (!app) return;
  const idx = app.events.map((e) => e.type).reduce<number>(
    (last, type, i) => (type === "interview" || type === "rejected" ? i : last),
    -1,
  );
  if (idx <= 0) return;
  app.events = app.events.filter((_, i) => i !== idx);
  app.updatedAt = Date.now();
  await putApplication(app);
}

export async function saveApplicationNotes(id: string, notes: string): Promise<void> {
  const all = await listApplicationsRaw();
  const app = all.find((a) => a.id === id);
  if (!app) return;
  app.notes = notes;
  app.updatedAt = Date.now();
  await putApplication(app);
}

/** Supprime la candidature et détache ses documents (ils repassent au rayon). */
export async function deleteApplication(id: string): Promise<void> {
  const docs = await listHistoryByApplication(id);
  for (const doc of docs) await updateHistoryFields(doc.id, { applicationId: undefined });
  await deleteApplicationRecord(id);
}

/** Peuple le tracker depuis l'historique existant. Une seule fois, idempotent. */
export async function runBackfillOnce(): Promise<void> {
  if (typeof localStorage !== "undefined" && localStorage.getItem(BACKFILL_KEY)) return;
  const entries = await listUnattachedHistory();
  const plan = planBackfill(entries, Date.now(), () => crypto.randomUUID());
  for (const app of plan.applications) await putApplication(app);
  for (const link of plan.links) await updateHistoryFields(link.entryId, { applicationId: link.applicationId });
  if (typeof localStorage !== "undefined") localStorage.setItem(BACKFILL_KEY, "1");
}

export async function listShelfEntries(): Promise<HistoryEntry[]> {
  return listUnattachedHistory();
}

export async function setShelfLabel(id: string, label: string): Promise<void> {
  await updateHistoryFields(id, { label: label.trim() });
}

/** Applique la règle du CV anonyme unique après un export sans entreprise ni poste. */
export async function pruneAnonymousShelf(docType: string, keepId: string): Promise<void> {
  const entries = await listUnattachedHistory();
  const ids = anonymousIdsToDelete(entries, docType, keepId);
  if (ids.length) await deleteHistoryEntries(ids);
}

import {
  listApplicationsRaw,
  getApplicationByNormKey,
  putApplication,
  deleteApplicationRecord,
  listHistoryByApplication,
  listUnattachedHistory,
  updateHistoryFields,
  deleteHistoryEntries,
  type DocumentSummary,
} from "@/lib/storage/db";
import { normKey } from "./normKey";
import { anonymousIdsToDelete } from "./shelf";
import { planBackfill } from "./backfill";
import { indexOfLastStatusEvent } from "./status";
import type { Application } from "./types";

const BACKFILL_KEY = "applications-backfill-v1";

/** Candidatures, les plus récentes d'abord (date d'envoi). */
export async function listApplications(): Promise<Application[]> {
  const all = await listApplicationsRaw();
  const at = (a: Application) => a.events.find((e) => e.type === "applied")?.date ?? a.createdAt;
  return all.sort((x, y) => at(y) - at(x));
}

export async function listApplicationDocuments(applicationId: string): Promise<DocumentSummary[]> {
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
  const idx = indexOfLastStatusEvent(app.events);
  if (idx < 0) return;
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

/**
 * Supprime la candidature et détache ses documents : ils repassent tous au rayon
 * « Mes CV » et sont conservés — c'est ce que promet le message de confirmation.
 * Si la candidature portait plusieurs documents non nommés, le rayon contient
 * alors temporairement plus d'un anonyme du même type. C'est assumé : la règle du
 * CV anonyme unique est appliquée à l'export, donc le prochain téléchargement
 * nettoie l'excédent. Supprimer un document ici serait une perte de donnée que
 * l'utilisateur n'a pas demandée. Décision propriétaire du 25/07/2026.
 */
export async function deleteApplication(id: string): Promise<void> {
  const docs = await listHistoryByApplication(id);
  for (const doc of docs) await updateHistoryFields(doc.id, { applicationId: undefined });
  await deleteApplicationRecord(id);
}

/**
 * Peuple le tracker depuis l'historique existant. Une seule fois, idempotent.
 *
 * Le marqueur `localStorage` n'est posé qu'à la fin, donc il ne protège pas
 * pendant l'exécution : deux montages rapprochés du composant (React remonte les
 * effets en développement) lançaient deux passages simultanés qui recréaient
 * chacun tout le lot. D'où le verrou en mémoire ci-dessous, et la liste des clés
 * déjà en base transmise au plan comme seconde barrière.
 */
let backfillInFlight: Promise<void> | null = null;

export function runBackfillOnce(): Promise<void> {
  if (typeof localStorage !== "undefined" && localStorage.getItem(BACKFILL_KEY)) return Promise.resolve();
  if (!backfillInFlight) {
    backfillInFlight = doBackfill().finally(() => { backfillInFlight = null; });
  }
  return backfillInFlight;
}

async function doBackfill(): Promise<void> {
  const entries = await listUnattachedHistory();
  const existing = await listApplicationsRaw();
  const known = new Map(existing.map((a) => [a.normKey, a.id]));
  const plan = planBackfill(entries, Date.now(), () => crypto.randomUUID(), known);
  for (const app of plan.applications) await putApplication(app);
  for (const link of plan.links) await updateHistoryFields(link.entryId, { applicationId: link.applicationId });
  if (typeof localStorage !== "undefined") localStorage.setItem(BACKFILL_KEY, "1");
}

export async function listShelfEntries(): Promise<DocumentSummary[]> {
  // Le CV Maître n'est pas un document du rayon : c'est la base de référence des
  // adaptations, gérée depuis la modale d'adaptation. Il n'a ni candidature ni
  // nom, donc rien ne l'écarterait sans ce filtre.
  const entries = await listUnattachedHistory();
  return entries.filter((e) => e.doc_type !== "Maître");
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

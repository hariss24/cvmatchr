import Dexie, { type Table } from "dexie";
import type { DocData } from "@/state/docStore";
import type { DocType } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";
import { DEFAULT_TEMPLATES, type MailTemplate } from "@/lib/templates/defaults";
import type { UserProfile } from "@/lib/profile/profile";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Snapshot {
  ts: number;
  label: string;
  html: string;
  css: string;
  json: DocData | null;
  doc_type: DocType;
  company: string;
  role: string;
}

export interface Draft {
  id: string; // ex: "draft-CV", "draft-Lettre"
  html: string;
  css: string;
  json: DocData | null;
  templateId: TemplateId | null;
  company?: string;
  role?: string;
  /** True si le HTML est la source de vérité (json périmé). Absent = déduit de `json == null`. */
  htmlSource?: boolean;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  created_at: string; // ISO string
  doc_type: DocType;
  company: string;
  role: string;
  job_desc: string;
  filename: string;
  notes: string;
  pdf_views: number;
  editor_reloads: number;
  last_viewed_at?: string;
  
  html: string;
  css: string;
  json: DocData | null;
  templateId: TemplateId | null;
}

/** Offre d'emploi retenue (feature « Offres »). Stockée localement, comme les CV. */
export interface JobEntry {
  id: string;          // id France Travail (clé primaire, sert au dédoublonnage)
  createdAt: number;   // horodatage d'enregistrement local
  title: string;
  company: string;
  location: string;
  commute: string;     // résumé texte « TC: … | Vélo: … »
  score: number;       // note IA /100
  url: string;         // lien vers l'offre d'origine
  jobText: string;     // description (pour « Adapter mon CV »)
  status: "new" | "dismissed" | "hidden"; // hidden = explorée mais sous le seuil (mémorisée, non affichée)
  seen?: boolean;      // false = pas encore consultée (badge « Nouveau ») ; absent/true = déjà vue
  publishedAt?: string; // date de publication de l'offre (ISO France Travail)
}

// ---------------------------------------------------------------------------
// DB DEFINITION
// ---------------------------------------------------------------------------

export class AppDatabase extends Dexie {
  snapshots!: Table<Snapshot, number>; // Primary key: ts
  drafts!: Table<Draft, string>;       // Primary key: id
  history!: Table<HistoryEntry, string>; // Primary key: id
  jobs!: Table<JobEntry, string>;      // Primary key: id
  templates!: Table<MailTemplate, string>; // Primary key: id
  profile!: Table<UserProfile, string>; // Primary key: id (singleton "me")

  constructor() {
    // Nouveau nom pour éviter les collisions si on lance sur le même port que Flask
    super("html-to-pdf-nextjs");

    this.version(1).stores({
      snapshots: "ts",
      drafts: "id",
      history: "id, created_at, company, role, doc_type",
    });

    // v2 : ajout de la table des offres (tables existantes héritées de la v1).
    this.version(2).stores({
      jobs: "id, score, status, createdAt",
    });

    // v3 : le type de document « Autre » a été supprimé → reclasser les données existantes en « CV ».
    this.version(3).stores({}).upgrade(async (tx) => {
      await tx.table("snapshots").filter((s) => (s.doc_type as string) === "Autre")
        .modify({ doc_type: "CV" });
      await tx.table("history").filter((h) => (h.doc_type as string) === "Autre")
        .modify({ doc_type: "CV" });
      // Brouillon « draft-Autre » → « draft-CV » (sans écraser un brouillon CV déjà présent).
      const autre = await tx.table("drafts").get("draft-Autre");
      if (autre) {
        const cv = await tx.table("drafts").get("draft-CV");
        if (!cv) await tx.table("drafts").put({ ...autre, id: "draft-CV" });
        await tx.table("drafts").delete("draft-Autre");
      }
    });

    // v4 : bibliothèque de modèles lettre/email (feature « Pack candidature » sans IA).
    this.version(4).stores({
      templates: "id, updatedAt",
    });

    // v5 : profil « Mes informations » (singleton id="me"), réutilisé par CV & lettre.
    this.version(5).stores({
      profile: "id",
    });
  }
}

export const db = new AppDatabase();

const MAX_SNAPS = 20;

// ---------------------------------------------------------------------------
// SNAPSHOTS API
// ---------------------------------------------------------------------------

export async function saveSnapshot(snap: Snapshot) {
  try {
    await db.snapshots.put(snap);
    await pruneSnapshots();
  } catch (e) {
    console.warn("Snapshot save error:", e);
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  try {
    const all = await db.snapshots.toArray();
    return all.sort((a, b) => b.ts - a.ts);
  } catch (e) {
    console.warn("listSnapshots error:", e);
    return [];
  }
}

export async function deleteSnapshot(ts: number) {
  try {
    await db.snapshots.delete(ts);
  } catch (e) {
    console.warn("deleteSnapshot error:", e);
  }
}

async function pruneSnapshots() {
  const all = await db.snapshots.orderBy('ts').reverse().toArray();
  if (all.length > MAX_SNAPS) {
    const toDelete = all.slice(MAX_SNAPS).map(s => s.ts);
    await db.snapshots.bulkDelete(toDelete);
  }
}

// ---------------------------------------------------------------------------
// DRAFTS API
// ---------------------------------------------------------------------------

export async function saveDraft(draft: Draft) {
  try {
    draft.updatedAt = Date.now();
    await db.drafts.put(draft);
  } catch (e) {
    console.warn("Draft save error:", e);
  }
}

export async function loadDraft(id: string): Promise<Draft | undefined> {
  try {
    return await db.drafts.get(id);
  } catch (e) {
    console.warn("loadDraft error:", e);
    return undefined;
  }
}

export async function deleteDraft(id: string) {
  try {
    await db.drafts.delete(id);
  } catch (e) {
    console.warn("deleteDraft error:", e);
  }
}

// ---------------------------------------------------------------------------
// HISTORY API
// ---------------------------------------------------------------------------

export async function saveHistoryEntry(entry: HistoryEntry) {
  try {
    await db.history.put(entry);
  } catch (e) {
    console.warn("History save error:", e);
  }
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  try {
    const all = await db.history.toArray();
    return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (e) {
    console.warn("listHistoryEntries error:", e);
    return [];
  }
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
  try {
    return await db.history.get(id);
  } catch (e) {
    console.warn("getHistoryEntry error:", e);
    return undefined;
  }
}

export async function deleteHistoryEntry(id: string) {
  try {
    await db.history.delete(id);
  } catch (e) {
    console.warn("deleteHistoryEntry error:", e);
  }
}

export async function updateHistoryEntryStat(id: string, field: 'pdf_views' | 'editor_reloads') {
  try {
    const entry = await db.history.get(id);
    if (entry) {
      entry[field] = (entry[field] || 0) + 1;
      if (field === 'pdf_views') {
        entry.last_viewed_at = new Date().toISOString();
      }
      await db.history.put(entry);
    }
  } catch (e) {
    console.warn("History update error:", e);
  }
}

// ---------------------------------------------------------------------------
// JOBS API (feature « Offres »)
// ---------------------------------------------------------------------------

/** True si l'offre est déjà en base (retenue ou masquée) — sert au dédoublonnage du scan. */
export async function jobExists(id: string): Promise<boolean> {
  try {
    return (await db.jobs.get(id)) !== undefined;
  } catch (e) {
    console.warn("jobExists error:", e);
    return false;
  }
}

export async function saveJob(entry: JobEntry) {
  try {
    await db.jobs.put(entry);
  } catch (e) {
    console.warn("saveJob error:", e);
  }
}

/** Offres d'un statut donné, triées par score décroissant (puis plus récentes d'abord). */
export async function listJobs(status: JobEntry["status"] = "new"): Promise<JobEntry[]> {
  try {
    const all = await db.jobs.where("status").equals(status).toArray();
    return all.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
  } catch (e) {
    console.warn("listJobs error:", e);
    return [];
  }
}

export async function setJobStatus(id: string, status: JobEntry["status"]) {
  try {
    await db.jobs.update(id, { status });
  } catch (e) {
    console.warn("setJobStatus error:", e);
  }
}

/** Mémorise une offre explorée mais sous le seuil (marqueur minimal) pour ne jamais la re-noter. */
export async function saveExplored(id: string, score: number) {
  try {
    await db.jobs.put({
      id,
      createdAt: Date.now(),
      title: "",
      company: "",
      location: "",
      commute: "",
      score,
      url: "",
      jobText: "",
      status: "hidden",
      seen: true,
    });
  } catch (e) {
    console.warn("saveExplored error:", e);
  }
}

/** Marque une offre comme consultée (retire le badge « Nouveau »). */
export async function markJobSeen(id: string) {
  try {
    await db.jobs.update(id, { seen: true });
  } catch (e) {
    console.warn("markJobSeen error:", e);
  }
}

// ---------------------------------------------------------------------------
// TEMPLATES API (modèles lettre/email)
// ---------------------------------------------------------------------------

/**
 * Seed le modèle de départ. Migration unique `pack-templates-v3` (v2 : refonte
 * « lettre seule » ; v3 : lettre personnelle « couteau suisse du web ») : chaque
 * bump remplace les modèles une fois, puis on préserve les éditions de
 * l'utilisateur (on ne réécrase plus ensuite).
 */
export async function ensureDefaultTemplates() {
  try {
    const KEY = "pack-templates-v3";
    const migrated = typeof localStorage !== "undefined" && localStorage.getItem(KEY);
    if (!migrated) {
      await db.templates.clear();
      await db.templates.bulkPut(DEFAULT_TEMPLATES.map((t) => ({ ...t, updatedAt: Date.now() })));
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, "1");
      return;
    }
    if ((await db.templates.count()) === 0) {
      await db.templates.bulkPut(DEFAULT_TEMPLATES.map((t) => ({ ...t, updatedAt: Date.now() })));
    }
  } catch (e) {
    console.warn("ensureDefaultTemplates error:", e);
  }
}

export async function listTemplates(): Promise<MailTemplate[]> {
  try {
    const all = await db.templates.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn("listTemplates error:", e);
    return [];
  }
}

export async function saveTemplate(tpl: MailTemplate) {
  try {
    await db.templates.put({ ...tpl, updatedAt: Date.now() });
  } catch (e) {
    console.warn("saveTemplate error:", e);
  }
}

export async function deleteTemplate(id: string) {
  try {
    await db.templates.delete(id);
  } catch (e) {
    console.warn("deleteTemplate error:", e);
  }
}

// ---------------------------------------------------------------------------
// PROFILE API (profil « Mes informations »)
// ---------------------------------------------------------------------------

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    return (await db.profile.get("me")) ?? null;
  } catch (e) {
    console.warn("loadProfile error:", e);
    return null;
  }
}

export async function saveProfile(p: UserProfile): Promise<void> {
  try {
    await db.profile.put({ ...p, id: "me", updatedAt: Date.now() });
  } catch (e) {
    console.warn("saveProfile error:", e);
  }
}

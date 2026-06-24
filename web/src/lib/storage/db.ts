import Dexie, { type Table } from "dexie";
import type { DocData } from "@/state/docStore";
import type { DocType } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";

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

// ---------------------------------------------------------------------------
// DB DEFINITION
// ---------------------------------------------------------------------------

export class AppDatabase extends Dexie {
  snapshots!: Table<Snapshot, number>; // Primary key: ts
  drafts!: Table<Draft, string>;       // Primary key: id
  history!: Table<HistoryEntry, string>; // Primary key: id

  constructor() {
    // Nouveau nom pour éviter les collisions si on lance sur le même port que Flask
    super("html-to-pdf-nextjs");

    this.version(1).stores({
      snapshots: "ts",
      drafts: "id",
      history: "id, created_at, company, role, doc_type",
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

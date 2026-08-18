import Dexie, { type Table } from "dexie";
import type { DocData } from "@/state/docStore";
import type { DocType } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";
import { DEFAULT_TEMPLATES, type MailTemplate } from "@/lib/templates/defaults";
import type { UserProfile } from "@/lib/profile/profile";
import type { JobSearchProfile } from "@/lib/jobs/profile";
import type { Application } from "@/lib/applications/types";
import type { SourceId } from "@/lib/jobs/offer";
import { GRADE_ORDER, type Grade } from "@/lib/jobs/grade";
import { normKey } from "@/lib/applications/normKey";
import type { Ligne } from "@/lib/jobs/rank/criteria";
import { normalizeCompany, type AtsProvider } from "@/lib/jobs/ats";
import { requireRemote, currentUserId, RemoteError } from "./remote";
import { cacheGet, cacheSet, cacheInvalidate } from "./sessionCache";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Snapshot {
  ts: number;
  label: string;
  json: DocData;
  doc_type: DocType;
  company: string;
  role: string;
}

export interface Draft {
  id: string; // ex: "draft-CV", "draft-Lettre"
  json: DocData;
  templateId: TemplateId | null;
  company?: string;
  role?: string;

  /**
   * Identifiant du document du compte que ce brouillon est en train de modifier.
   *
   * Il voyage avec le brouillon, et non seulement en mémoire, parce qu'un simple
   * rafraîchissement de page perdrait l'identité : l'enregistrement automatique
   * suivant créerait alors un second document au lieu de mettre à jour le
   * premier. `null` = document jamais enregistré sur le compte.
   */
  documentId?: string | null;

  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  created_at: string; // ISO string
  updated_at?: string;
  doc_type: DocType;
  company: string;
  role: string;
  job_desc: string;
  filename: string;
  notes: string;
  pdf_views: number;
  editor_reloads: number;
  last_viewed_at?: string;
  /** Candidature à laquelle ce document est rattaché (feature « Mes candidatures »). */
  applicationId?: string;
  /** Nom donné à un CV du rayon « Mes CV ». Vide/absent = document anonyme. */
  label?: string;

  json: DocData;
  templateId: TemplateId | null;
}

/** Résumé de liste : tout SAUF `json`. C'est le catalogue. */
export type DocumentSummary = Omit<HistoryEntry, 'json'>;

/** Offre d'emploi retenue (feature « Offres »). Stockée localement, comme les CV. */
export interface JobEntry {
  id: string;          // id France Travail (clé primaire, sert au dédoublonnage)
  createdAt: number;   // horodatage d'enregistrement local
  updatedAt?: number;
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
  /**
   * Jour (`YYYY-MM-DD`) où le scan quotidien a vu l'offre pour la première fois.
   * Marché caché seulement ; absent partout ailleurs. Sert la pastille de
   * fraîcheur de la carte — à ne pas confondre avec `seen`, qui dit si TOI tu
   * l'as ouverte, ni avec `createdAt`, qui date ton propre scan.
   */
  discoveredAt?: string;
  /** Candidature créée depuis cette offre (bouton « Suivre »). */
  applicationId?: string;
  /** Source qui a fait remonter l'offre. Absent = donnée d'avant la v9. */
  source?: SourceId;
  /** Logo d'entreprise fourni par la source ; absent/"" → repli sur l'initiale. */
  logoUrl?: string;
  /** Hôte du lien de l'offre, pour le favicon du jobboard. */
  boardDomain?: string;
  /** Nom lisible du jobboard, ex. "LinkedIn". */
  boardName?: string;
  /** "CDI · Plein temps"… ; absent/"" → « Type non précisé ». */
  contractLabel?: string;
  /** "33–36 k€ / an" ; absent/"" → « Salaire non précisé ». */
  salaryLabel?: string;
  /** Critère ayant permis l'entrée de l'offre (ex. "software engineer" sur une recherche "développeur"). */
  critereEntree?: string;
  /** Lettre de classement. Absent = offre notée avant la bascule (score /100 seul). */
  grade?: Grade;

  /** Détail par critère, pour afficher le POURQUOI que l'IA ne fournissait pas. */
  breakdown?: Ligne[];
}

/**
 * Board public détecté pour une entreprise (feature « offres à la source »).
 *
 * Les entrées `"none"` sont conservées volontairement : savoir qu'une entreprise
 * a déjà été essayée sans succès évite de la retester à chaque affichage.
 */
export interface AtsDirectoryEntry {
  companyKey: string;
  ats: AtsProvider | "none";
  /** Identifiant du board chez l'ATS ; "" quand `ats === "none"`. */
  slug: string;
  resolvedAt: number;
}

export type JobProfileRow = {
  id: "me";
  profile: JobSearchProfile;
  updatedAt?: number;
};

// ---------------------------------------------------------------------------
// DB DEFINITION
// ---------------------------------------------------------------------------

export class AppDatabase extends Dexie {
  snapshots!: Table<Snapshot, number>; // Primary key: ts
  drafts!: Table<Draft, string>;       // Primary key: id
  apiUsage!: Table<{ key: string; count: number }, string>; // Primary key: key
  commuteCache!: Table<{ key: string; text: string; at: number }, string>;
  atsDirectory!: Table<AtsDirectoryEntry, string>; // Primary key: companyKey
  history?: Table<HistoryEntry, string>;
  jobs?: Table<JobEntry, string>;
  templates?: Table<MailTemplate, string>;
  profile?: Table<UserProfile, string>;
  jobProfile?: Table<JobProfileRow, string>;
  applications?: Table<Application, string>;

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

    // v6 : retrait de la couche HTML legacy — purge des enregistrements
    // d'avant-migration (sans `json`, restaurables uniquement via l'ancien
    // pipeline HTML supprimé le 17/07/2026). Décision propriétaire du 17/07.
    this.version(6).stores({}).upgrade(async (tx) => {
      await tx.table("snapshots").filter((s) => s.json == null).delete();
      await tx.table("history").filter((h) => h.json == null).delete();
      await tx.table("drafts").filter((d) => d.json == null).delete();
    });

    // v7 : profil de recherche d'offres paramétrable (singleton id="me").
    this.version(7).stores({
      jobProfile: "id",
    });

    // v8 : tracker de candidatures « Mes candidatures ». Le statut n'est pas
    // stocké (dérivé du journal d'événements), donc aucun index de statut.
    this.version(8).stores({
      applications: "id, normKey, createdAt, updatedAt",
    });

    // v9 : sources multiples. Les champs ajoutés à JobEntry sont optionnels —
    // les offres existantes n'en ont pas et l'affichage retombe sur ses replis,
    // donc aucun upgrade n'est nécessaire. Nouvelle table de comptage d'appels.
    this.version(9).stores({
      apiUsage: "key",
    });

    // v10 : classement par lettres. `grade` et `breakdown` sont optionnels — les
    // offres existantes gardent leur score /100 et leur lettre est dérivée à la
    // lecture (aucun rescan imposé, spec §6). Nouvelle table : cache des temps
    // de trajet, qui ramène Google Maps de 354 appels par scan à quelques-uns
    // par mois.
    this.version(10).stores({
      commuteCache: "key",
    });

    // v11 : annuaire entreprise → ATS. Pas d'upgrade : table neuve, et une
    // absence d'entrée signifie simplement « pas encore résolue ».
    this.version(11).stores({
      atsDirectory: "companyKey",
    });

    // v12 : Ashby et SmartRecruiters rejoignent Greenhouse et Lever. Les « none »
    // enregistrés avec les deux ATS d'origine sont des non-réponses périmées, pas
    // des faits : sans cette purge, une entreprise comme Nexton (137 offres sur
    // SmartRecruiters) resterait marquée introuvable à jamais. Les détections
    // positives sont conservées — elles restent vraies.
    this.version(12).stores({}).upgrade(async (tx) => {
      await tx.table("atsDirectory").filter((e) => e.ats === "none").delete();
    });

    // v13 : champs de synchronisation Supabase. `updated_at` (ISO) est ajouté aux
    // entrées d'historique, qui n'avaient que `created_at`. Les tables applications
    // et jobs gardent leurs timestamps numériques ; la conversion se fait à la volée
    // dans le SyncEngine (cf. syncFields.toIso).
    this.version(13).stores({
      history:      "id, created_at, updated_at, company, role, doc_type, synced_at, deleted_at",
      applications: "id, normKey, createdAt, updatedAt, synced_at, deleted_at",
      jobs:         "id, score, status, createdAt, updatedAt, synced_at, deleted_at",
    }).upgrade(async (tx) => {
      await tx.table("history").toCollection().modify((h) => {
        if (!h.updated_at) h.updated_at = h.created_at;
        h.synced_at = null;
      });
      await tx.table("applications").toCollection().modify((a) => {
        if (!a.updatedAt) a.updatedAt = a.createdAt ?? Date.now();
        a.synced_at = null;
      });
      await tx.table("jobs").toCollection().modify((j) => {
        if (!j.updatedAt) j.updatedAt = j.createdAt ?? Date.now();
        j.synced_at = null;
      });
    });

    // v14 : le serveur Supabase devient la source unique.
    //
    // ⚠️ Cette version NE SUPPRIME PAS les tables migrées, et ne doit jamais le
    // faire. Une déclaration `history: null` (etc.) détruit les magasins à
    // l'OUVERTURE de la base — donc avant toute connexion, donc avant que
    // `reprendreDonneesLocales()` ait pu les lire. La reprise ne trouvait plus
    // rien, posait quand même son drapeau, et les données d'un utilisateur
    // d'avant la bascule étaient perdues sans un mot. Relevé le 15/08/2026 à la
    // relecture, avant tout déploiement.
    //
    // Les tables restent donc déclarées et lisibles. C'est la reprise qui les
    // vide, une fois les données effectivement arrivées sur le compte
    // (`reprise.ts`) : une suppression ordonnée, à un moment où l'on sait ce
    // qu'on efface. Leur retrait du schéma ne pourra se faire qu'une fois tous
    // les utilisateurs repris — pas dans ce chantier.
    this.version(14).stores({});
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

/** Colonnes du catalogue : tout sauf `content`. Voir spec §4.2. */
const DOC_LIST_COLS =
  'id,doc_type,title,company,role,label,notes,job_desc,template_id,application_id,pdf_views,editor_reloads,last_viewed_at,created_at,updated_at';

function rowToSummary(r: Record<string, unknown>): DocumentSummary {
  return {
    id: r.id as string,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) || undefined,
    doc_type: r.doc_type as DocType,
    company: (r.company as string) ?? '',
    role: (r.role as string) ?? '',
    job_desc: (r.job_desc as string) ?? '',
    filename: (r.title as string) ?? '',
    notes: (r.notes as string) ?? '',
    pdf_views: (r.pdf_views as number) ?? 0,
    editor_reloads: (r.editor_reloads as number) ?? 0,
    last_viewed_at: (r.last_viewed_at as string) || undefined,
    applicationId: (r.application_id as string) || undefined,
    label: (r.label as string) || undefined,
    templateId: (r.template_id as TemplateId | null) ?? null,
  };
}

export async function listHistoryEntries(): Promise<DocumentSummary[]> {
  const enMemoire = cacheGet<DocumentSummary[]>('documents:list');
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('documents')
    .select(DOC_LIST_COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new RemoteError('Impossible de charger vos documents.', error);

  const liste = (data ?? []).map(rowToSummary);
  cacheSet('documents:list', liste);
  return liste;
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
  const cle = `documents:detail:${id}`;
  const enMemoire = cacheGet<HistoryEntry>(cle);
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (error) {
    // PGRST116 = aucune ligne : c'est un fait, pas une panne.
    if ((error as { code?: string }).code === 'PGRST116') return undefined;
    throw new RemoteError('Impossible de charger ce document.', error);
  }
  if (!data) return undefined;
  const entree = { ...rowToSummary(data), json: data.content as DocData } as HistoryEntry;
  cacheSet(cle, entree);
  return entree;
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase.from('documents').upsert({
    user_id: userId,
    id: entry.id,
    doc_type: entry.doc_type,
    title: entry.filename,
    company: entry.company,
    role: entry.role,
    label: entry.label ?? null,
    content: entry.json,
    template_id: entry.templateId,
    application_id: entry.applicationId ?? null,
    notes: entry.notes,
    job_desc: entry.job_desc,
    pdf_views: entry.pdf_views,
    editor_reloads: entry.editor_reloads,
    last_viewed_at: entry.last_viewed_at ?? null,
    created_at: entry.created_at,
  });
  if (error) throw new RemoteError("Impossible d'enregistrer ce document.", error);
  cacheInvalidate('documents:');
}

/**
 * Écrit le CONTENU d'un document, et rien d'autre.
 *
 * `saveHistoryEntry` réécrit la ligne entière : parfait pour une création,
 * destructeur pour une mise à jour répétée. L'enregistrement automatique, qui
 * repart du document en cours d'édition, y remettrait à chaque pause de frappe
 * `notes: ""`, `pdf_views: 0`, `editor_reloads: 0` et une `created_at` toute
 * fraîche — soit les notes de l'utilisateur effacées, les compteurs d'usage
 * remis à zéro et une date de création qui rajeunit sans cesse (le même piège
 * que le `createdAt` des candidatures, corrigé le 15/08).
 *
 * Cette écriture ne nomme que les colonnes réellement éditées. À la création,
 * les autres prennent leur valeur par défaut ; à la mise à jour, PostgREST ne
 * touche pas aux colonnes absentes, donc elles survivent.
 */
export async function saveDocumentContent(doc: {
  id: string;
  doc_type: DocType;
  company: string;
  role: string;
  filename: string;
  json: DocData;
  templateId: TemplateId | null;
  applicationId?: string;
}): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase.from('documents').upsert({
    user_id: userId,
    id: doc.id,
    doc_type: doc.doc_type,
    title: doc.filename,
    company: doc.company,
    role: doc.role,
    content: doc.json,
    template_id: doc.templateId,
    application_id: doc.applicationId ?? null,
  });
  if (error) throw new RemoteError("Impossible d'enregistrer ce document.", error);
  cacheInvalidate('documents:');
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new RemoteError('Impossible de supprimer ce document.', error);
  cacheInvalidate('documents:');
}

export async function updateHistoryEntryStat(
  id: string,
  field: 'pdf_views' | 'editor_reloads',
): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { data: current, error: getErr } = await supabase
    .from('documents')
    .select(field)
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (getErr) throw new RemoteError('Impossible de lire les statistiques du document.', getErr);

  const rowData = current as Record<string, unknown> | null;
  const nextVal = (((rowData?.[field] as number) || 0)) + 1;
  const updates: Record<string, unknown> = { [field]: nextVal };
  if (field === 'pdf_views') {
    updates.last_viewed_at = new Date().toISOString();
  }

  const { error: updateErr } = await supabase
    .from('documents')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', id);
  if (updateErr) throw new RemoteError('Impossible de mettre à jour les statistiques du document.', updateErr);
  cacheInvalidate('documents:');
}

// ---------------------------------------------------------------------------
// JOBS API (feature « Offres »)
// ---------------------------------------------------------------------------

export interface RemoteSavedJobRow {
  user_id: string;
  id: string;
  job_data: Record<string, unknown>;
  client_updated_at: string;
}

export function jobToRemoteSavedJob(job: JobEntry, userId: string): RemoteSavedJobRow {
  const isoUpdate = new Date(job.updatedAt || job.createdAt || Date.now()).toISOString();
  return {
    user_id: userId,
    id: job.id,
    job_data: job as unknown as Record<string, unknown>,
    client_updated_at: isoUpdate,
  };
}

export function remoteSavedJobToJob(row: Record<string, unknown>): JobEntry {
  const job = (row.job_data || {}) as unknown as JobEntry;
  return {
    ...job,
    id: row.id as string,
  };
}

/** True si l'offre est déjà en base (retenue ou masquée) — sert au dédoublonnage du scan. */
export async function jobExists(id: string): Promise<boolean> {
  try {
    const { supabase, userId } = await requireRemote();
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_id', userId)
      .eq('id', id)
      .single();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function saveJob(entry: JobEntry): Promise<void> {
  const { supabase, userId } = await requireRemote();
  entry.updatedAt = entry.updatedAt || Date.now();
  const row = jobToRemoteSavedJob(entry, userId);
  const { error } = await supabase.from('saved_jobs').upsert(row);
  if (error) throw new RemoteError("Impossible d'enregistrer l'offre.", error);
  cacheInvalidate('jobs:');
}

/**
 * Clés `normKey` de toutes les offres en base, statuts confondus.
 *
 * Sert au dédoublonnage inter-source du scan. Les statuts sont confondus à
 * dessein : une offre écartée ne doit pas revenir sous l'identifiant d'une autre
 * source.
 */
export async function jobKeys(): Promise<Set<string>> {
  const enMemoire = cacheGet<Set<string>>('jobs:keys');
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('saved_jobs')
    .select('id, job_data')
    .eq('user_id', userId);
  if (error) throw new RemoteError('Impossible de charger les clés des offres.', error);

  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ id: string; job_data?: { company?: string; title?: string } }>) {
    const c = row.job_data?.company || '';
    const t = row.job_data?.title || '';
    const key = normKey(c, t);
    if (key) set.add(key);
    if (row.id) set.add(row.id);
  }
  cacheSet('jobs:keys', set);
  return set;
}

/** Offres d'un statut donné, triées par score décroissant (puis plus récentes d'abord). */
export async function listJobs(status: JobEntry["status"] = "new"): Promise<JobEntry[]> {
  const cacheKey = `jobs:list:${status}`;
  const enMemoire = cacheGet<JobEntry[]>(cacheKey);
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('saved_jobs')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new RemoteError('Impossible de charger les offres enregistrées.', error);

  const all = ((data ?? []) as Array<Record<string, unknown>>).map(remoteSavedJobToJob);
  const filtered = all
    .filter((j) => j.status === status)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

  cacheSet(cacheKey, filtered);
  return filtered;
}

export async function setJobStatus(id: string, status: JobEntry["status"]): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { data, error: getErr } = await supabase
    .from('saved_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (getErr) throw new RemoteError("Impossible de trouver l'offre à modifier.", getErr);
  if (!data) return;

  const job = remoteSavedJobToJob(data as Record<string, unknown>);
  job.status = status;
  job.updatedAt = Date.now();
  const row = jobToRemoteSavedJob(job, userId);
  const { error } = await supabase.from('saved_jobs').upsert(row);
  if (error) throw new RemoteError("Impossible de modifier le statut de l'offre.", error);
  cacheInvalidate('jobs:');
}

/** Mémorise une offre explorée mais sous le seuil (marqueur minimal) pour ne jamais la re-noter. */
export async function saveExplored(id: string, score: number): Promise<void> {
  const entry: JobEntry = {
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
  };
  await saveJob(entry);
}

/** Marque une offre comme consultée (retire le badge « Nouveau »). */
export async function markJobSeen(id: string): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { data, error: getErr } = await supabase
    .from('saved_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single();
  if (getErr || !data) return;

  const job = remoteSavedJobToJob(data as Record<string, unknown>);
  if (job.seen) return;
  job.seen = true;
  job.updatedAt = Date.now();
  const row = jobToRemoteSavedJob(job, userId);
  await supabase.from('saved_jobs').upsert(row);
  cacheInvalidate('jobs:');
}

/** Durée de validité du cache : un trajet entre deux points fixes ne bouge pas. */
const COMMUTE_TTL_MS = 30 * 24 * 3600 * 1000;

/** Temps de trajet mémorisé, ou null si absent/périmé. */
export async function getCachedCommute(key: string): Promise<string | null> {
  try {
    const row = await db.commuteCache.get(key);
    if (!row) return null;
    if (Date.now() - row.at > COMMUTE_TTL_MS) return null;
    return row.text;
  } catch (e) {
    console.warn("getCachedCommute error:", e);
    return null;
  }
}

export async function setCachedCommute(key: string, text: string): Promise<void> {
  try {
    await db.commuteCache.put({ key, text, at: Date.now() });
  } catch (e) {
    console.warn("setCachedCommute error:", e);
  }
}

/**
 * Offres retenues d'au moins la lettre `min`, meilleures d'abord.
 *
 * Toutes les offres sont désormais conservées (le classement est gratuit) :
 * c'est le filtre d'affichage, et non plus un rejet définitif, qui décide de ce
 * qu'on montre.
 */
export async function listJobsByGrade(min: Grade): Promise<JobEntry[]> {
  const plafond = GRADE_ORDER.indexOf(min);
  const all = await listJobs("new");
  return all.filter((j) => GRADE_ORDER.indexOf(j.grade ?? "D") <= plafond);
}

/**
 * Supprime les offres déjà en base dont le score est sous le seuil.
 *
 * ⚠️ Nécessaire parce que la base est CUMULATIVE : une recherche y ajoute des
 * offres, n'en retire jamais. Les offres hors-sujet enregistrées avant que
 * `shouldPersist` ne devienne effectif resteraient affichées indéfiniment, ce
 * qui donne l'impression que les corrections en amont ne servent à rien.
 *
 * Rend le nombre d'offres supprimées.
 */
export async function supprimerJobsSousLeSeuil(seuil: number): Promise<number> {
  const { supabase, userId } = await requireRemote();
  const { data, error: getErr } = await supabase
    .from('saved_jobs')
    .select('id, job_data')
    .eq('user_id', userId);
  if (getErr) throw new RemoteError('Impossible de charger les offres pour nettoyage.', getErr);

  const horsSujet = ((data ?? []) as Array<{ id: string; job_data?: { score?: number } }>)
    .filter((r) => (r.job_data?.score ?? 0) < seuil);

  if (horsSujet.length === 0) return 0;

  const ids = horsSujet.map((r) => r.id);
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('user_id', userId)
    .in('id', ids);
  if (error) throw new RemoteError('Impossible de supprimer les offres sous le seuil.', error);

  cacheInvalidate('jobs:');
  return ids.length;
}

// ---------------------------------------------------------------------------
// TEMPLATES API (modèles lettre/email)
// ---------------------------------------------------------------------------

/**
 * Seed le modèle de départ pour l'utilisateur connecté s'il n'en a pas encore.
 */
export async function ensureDefaultTemplates(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { supabase } = await requireRemote();
  const { data, error } = await supabase
    .from('templates')
    .select('id')
    .eq('user_id', userId);
  if (error) return;

  if (!data || data.length === 0) {
    const rows = DEFAULT_TEMPLATES.map((t) => ({
      user_id: userId,
      id: t.id,
      name: t.name,
      letter_subject: t.letterSubject,
      letter_body: t.letterBody,
    }));
    const { error: seedErr } = await supabase.from('templates').upsert(rows);
    if (seedErr) throw new RemoteError("Impossible d'installer les modèles de départ.", seedErr);
    cacheInvalidate('templates:');
  }
}

export async function listTemplates(): Promise<MailTemplate[]> {
  const enMemoire = cacheGet<MailTemplate[]>('templates:list');
  if (enMemoire) return enMemoire;

  const userId = await currentUserId();
  if (!userId) {
    return DEFAULT_TEMPLATES;
  }

  const { supabase } = await requireRemote();
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw new RemoteError('Impossible de charger vos modèles.', error);

  if (!data || data.length === 0) {
    return DEFAULT_TEMPLATES;
  }

  const liste: MailTemplate[] = (data as Array<{
    id: string;
    name: string;
    letter_subject: string;
    letter_body: string;
    updated_at?: string;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    letterSubject: r.letter_subject,
    letterBody: r.letter_body,
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  }));

  cacheSet('templates:list', liste);
  return liste;
}

export async function saveTemplate(tpl: MailTemplate): Promise<void> {
  const { supabase, userId } = await requireRemote();
  // Noms de colonnes : `letter_subject` / `letter_body`, et pas de `is_default`.
  // Écrits `subject` / `body` / `is_default`, ils ne correspondaient à aucune
  // colonne de `0003_documents_templates.sql` : PostgreSQL refusait chaque
  // écriture, et l'installation des modèles de départ échouait en silence
  // (relevé le 15/08/2026, aucune migration n'ayant encore été appliquée, le
  // défaut n'avait jamais pu se manifester).
  const row = {
    user_id: userId,
    id: tpl.id,
    name: tpl.name,
    letter_subject: tpl.letterSubject,
    letter_body: tpl.letterBody,
  };
  const { error } = await supabase.from('templates').upsert(row);
  if (error) throw new RemoteError("Impossible d'enregistrer le modèle.", error);
  cacheInvalidate('templates:');
}

export async function deleteTemplate(id: string): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new RemoteError('Impossible de supprimer le modèle.', error);
  cacheInvalidate('templates:');
}

// ---------------------------------------------------------------------------
// PROFILE API (profil « Mes informations »)
// ---------------------------------------------------------------------------

export async function loadProfile(): Promise<UserProfile | null> {
  const enMemoire = cacheGet<UserProfile>('settings:profile');
  if (enMemoire) return enMemoire;

  const userId = await currentUserId();
  if (!userId) return null;

  const { supabase } = await requireRemote();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('id', 'profile')
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw new RemoteError('Impossible de charger votre profil.', error);
  }
  if (!data) return null;

  const row = data as { content?: Record<string, unknown>; client_updated_at?: string };
  const c = (row.content || {}) as Partial<UserProfile>;
  const profile: UserProfile = {
    id: 'me',
    prenom: c.prenom ?? '',
    nom: c.nom ?? '',
    email: c.email ?? '',
    telephone: c.telephone ?? '',
    ville: c.ville ?? '',
    linkedin: c.linkedin ?? '',
    updatedAt: c.updatedAt ?? (row.client_updated_at ? new Date(row.client_updated_at).getTime() : Date.now()),
  };

  cacheSet('settings:profile', profile);
  return profile;
}

export async function saveProfile(p: UserProfile): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const nowIso = new Date().toISOString();
  const cleanProfile: UserProfile = {
    ...p,
    id: 'me',
    updatedAt: p.updatedAt || Date.now(),
  };
  const row = {
    user_id: userId,
    id: 'profile',
    content: cleanProfile as unknown as Record<string, unknown>,
    client_updated_at: nowIso,
  };
  const { error } = await supabase.from('user_settings').upsert(row);
  if (error) throw new RemoteError("Impossible d'enregistrer votre profil.", error);
  cacheInvalidate('settings:');
}

// ---------------------------------------------------------------------------
// JOB PROFILE API (critères de recherche paramétrables)
// ---------------------------------------------------------------------------

export async function getJobProfile(): Promise<JobSearchProfile | null> {
  const enMemoire = cacheGet<JobSearchProfile>('settings:jobProfile');
  if (enMemoire) return enMemoire;

  const userId = await currentUserId();
  if (!userId) return null;

  const { supabase } = await requireRemote();
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('id', 'jobProfile')
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw new RemoteError('Impossible de charger vos critères de recherche.', error);
  }
  if (!data) return null;

  const row = data as { content?: { profile?: JobSearchProfile } };
  const profile = row.content?.profile ?? null;
  if (profile) {
    cacheSet('settings:jobProfile', profile);
  }
  return profile;
}

export async function saveJobProfile(profile: JobSearchProfile): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const nowIso = new Date().toISOString();
  const row = {
    user_id: userId,
    id: 'jobProfile',
    content: { profile } as Record<string, unknown>,
    client_updated_at: nowIso,
  };
  const { error } = await supabase.from('user_settings').upsert(row);
  if (error) throw new RemoteError("Impossible d'enregistrer vos critères de recherche.", error);
  cacheInvalidate('settings:');
}

// ---------------------------------------------------------------------------
// APPLICATIONS API (tracker « Mes candidatures »)
// ---------------------------------------------------------------------------

export interface RemoteApplicationRow {
  user_id: string;
  id: string;
  company: string;
  job_title: string;
  url: string;
  status: string;
  notes: string;
  payload: Record<string, unknown>;
  applied_at: string | null;
  client_updated_at: string;
}

export function applicationToRemoteRow(app: Application, userId: string): RemoteApplicationRow {
  const isoUpdate = new Date(app.updatedAt || app.createdAt || Date.now()).toISOString();
  const appliedEvent = app.events?.find((e) => e.type === 'applied');
  const appliedAt = appliedEvent ? new Date(appliedEvent.date).toISOString() : null;
  return {
    user_id: userId,
    id: app.id,
    company: app.company,
    job_title: app.role,
    url: app.jobUrl || '',
    status: 'draft',
    notes: app.notes || '',
    payload: {
      events: app.events || [],
      normKey: app.normKey,
      jobText: app.jobText,
      source: app.source,
      // La date de création est portée par le payload, faute de colonne dédiée.
      // Reconstruite depuis `client_updated_at`, elle se rajeunissait à chaque
      // modification : une candidature de trois semaines redevenait « récente »
      // après une simple retouche de note, et ne passait donc jamais en
      // « sans réponse » (`status.ts`, repli sur `createdAt`).
      createdAt: app.createdAt,
    },
    applied_at: appliedAt,
    client_updated_at: isoUpdate,
  };
}

export function remoteRowToApplication(row: Record<string, unknown>): Application {
  const payload = (row.payload || {}) as Record<string, unknown>;
  const events = Array.isArray(payload.events) ? (payload.events as unknown as Application['events']) : [];
  const ts = row.client_updated_at ? new Date(row.client_updated_at as string).getTime() : Date.now();
  return {
    id: row.id as string,
    createdAt: (payload.createdAt as number) || ts,
    updatedAt: ts,
    company: (row.company as string) || '',
    role: (row.job_title as string) || '',
    normKey: (payload.normKey as string) || '',
    jobText: (payload.jobText as string) || '',
    jobUrl: (row.url as string) || '',
    source: (payload.source as Application['source']) || 'manual',
    events,
    notes: (row.notes as string) || '',
  };
}

export async function listApplicationsRaw(): Promise<Application[]> {
  const enMemoire = cacheGet<Application[]>('applications:list');
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new RemoteError('Impossible de charger vos candidatures.', error);

  const liste = ((data ?? []) as Array<Record<string, unknown>>).map(remoteRowToApplication);
  cacheSet('applications:list', liste);
  return liste;
}

export async function getApplicationByNormKey(key: string): Promise<Application | undefined> {
  const all = await listApplicationsRaw();
  return all.find((a) => a.normKey === key);
}

export async function putApplication(app: Application): Promise<void> {
  const { supabase, userId } = await requireRemote();
  app.updatedAt = app.updatedAt || Date.now();
  const row = applicationToRemoteRow(app, userId);
  const { error } = await supabase.from('applications').upsert(row);
  if (error) throw new RemoteError("Impossible d'enregistrer la candidature.", error);
  cacheInvalidate('applications:');
}

export async function deleteApplicationRecord(id: string): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new RemoteError('Impossible de supprimer la candidature.', error);
  cacheInvalidate('applications:');
}

/** Documents d'historique rattachés à une candidature. */
export async function listHistoryByApplication(applicationId: string): Promise<DocumentSummary[]> {
  const cacheKey = `documents:byApp:${applicationId}`;
  const enMemoire = cacheGet<DocumentSummary[]>(cacheKey);
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('documents')
    .select(DOC_LIST_COLS)
    .eq('user_id', userId)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });
  if (error) throw new RemoteError('Impossible de charger les documents de cette candidature.', error);

  const liste = (data ?? []).map(rowToSummary);
  cacheSet(cacheKey, liste);
  return liste;
}

/** Documents d'historique non rattachés à une candidature (rayon « Mes CV »). */
export async function listUnattachedHistory(): Promise<DocumentSummary[]> {
  const cacheKey = 'documents:unattached';
  const enMemoire = cacheGet<DocumentSummary[]>(cacheKey);
  if (enMemoire) return enMemoire;

  const { supabase, userId } = await requireRemote();
  const { data, error } = await supabase
    .from('documents')
    .select(DOC_LIST_COLS)
    .eq('user_id', userId)
    .is('application_id', null)
    .order('created_at', { ascending: false });
  if (error) throw new RemoteError('Impossible de charger vos CV.', error);

  const liste = (data ?? []).map(rowToSummary);
  cacheSet(cacheKey, liste);
  return liste;
}

export async function updateHistoryFields(
  id: string,
  fields: Partial<HistoryEntry>,
): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const rowUpdates: Record<string, unknown> = {};
  if (fields.filename !== undefined) rowUpdates.title = fields.filename;
  if (fields.company !== undefined) rowUpdates.company = fields.company;
  if (fields.role !== undefined) rowUpdates.role = fields.role;
  if (fields.label !== undefined) rowUpdates.label = fields.label ?? null;
  if (fields.notes !== undefined) rowUpdates.notes = fields.notes;
  if (fields.job_desc !== undefined) rowUpdates.job_desc = fields.job_desc;
  if (fields.templateId !== undefined) rowUpdates.template_id = fields.templateId;
  if (fields.applicationId !== undefined) rowUpdates.application_id = fields.applicationId ?? null;
  if (fields.json !== undefined) rowUpdates.content = fields.json;
  if (fields.last_viewed_at !== undefined) rowUpdates.last_viewed_at = fields.last_viewed_at ?? null;

  const { error } = await supabase
    .from('documents')
    .update(rowUpdates)
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new RemoteError('Impossible de mettre à jour ce document.', error);
  cacheInvalidate('documents:');
}

export async function deleteHistoryEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('user_id', userId)
    .in('id', ids);
  if (error) throw new RemoteError('Impossible de supprimer ces documents.', error);
  cacheInvalidate('documents:');
}

// ---------------------------------------------------------------------------
// QUOTA D'APPELS API
// ---------------------------------------------------------------------------

/** Clé de comptage : une ligne par source et par mois. */
export function usageKey(source: SourceId, at: Date): string {
  const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
  return `${source}-${month}`;
}

/**
 * Incrémente les compteurs du mois courant.
 *
 * Compteur **local et indicatif** : il mesure ce que ce navigateur a consommé,
 * pas ce que le fournisseur a facturé. Il sert à éviter d'épuiser un quota
 * gratuit sans s'en rendre compte, pas à faire autorité.
 */
export async function bumpApiUsage(calls: Partial<Record<SourceId, number>>): Promise<void> {
  const now = new Date();
  try {
    await db.transaction("rw", db.apiUsage, async () => {
      for (const [source, n] of Object.entries(calls) as [SourceId, number][]) {
        if (!n) continue;
        const key = usageKey(source, now);
        const row = await db.apiUsage.get(key);
        await db.apiUsage.put({ key, count: (row?.count ?? 0) + n });
      }
    });
  } catch (e) {
    console.warn("bumpApiUsage error:", e);
  }
}

/** Appels consommés ce mois-ci, par source. */
export async function getApiUsage(): Promise<Record<SourceId, number>> {
  const now = new Date();
  const out: Record<SourceId, number> = { francetravail: 0, adzuna: 0, jsearch: 0, boards: 0 };
  try {
    for (const source of Object.keys(out) as SourceId[]) {
      out[source] = (await db.apiUsage.get(usageKey(source, now)))?.count ?? 0;
    }
  } catch (e) {
    console.warn("getApiUsage error:", e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ANNUAIRE ATS (offres à la source)
// ---------------------------------------------------------------------------

/**
 * Clé de cache d'une entreprise. « Doctolib », « DOCTOLIB » et « doctolib » ne
 * doivent pas occuper trois lignes.
 *
 * Délègue à `normalizeCompany` : si la clé et le slug divergeaient, une
 * entreprise serait résolue en boucle sans jamais se retrouver en cache.
 */
export function atsKey(companyName: string): string {
  return normalizeCompany(companyName);
}

export async function getAtsEntry(companyKey: string): Promise<AtsDirectoryEntry | undefined> {
  try {
    return await db.atsDirectory.get(companyKey);
  } catch (e) {
    console.warn("getAtsEntry error:", e);
    return undefined;
  }
}

export async function saveAtsEntry(entry: AtsDirectoryEntry): Promise<void> {
  try {
    await db.atsDirectory.put(entry);
  } catch (e) {
    console.warn("saveAtsEntry error:", e);
  }
}

/** Tout l'annuaire, pour l'export. Entrées « none » comprises. */
export async function allAtsEntries(): Promise<AtsDirectoryEntry[]> {
  try {
    return await db.atsDirectory.toArray();
  } catch (e) {
    console.warn("allAtsEntries error:", e);
    return [];
  }
}

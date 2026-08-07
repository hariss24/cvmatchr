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
  /** Candidature à laquelle ce document est rattaché (feature « Mes candidatures »). */
  applicationId?: string;
  /** Nom donné à un CV du rayon « Mes CV ». Vide/absent = document anonyme. */
  label?: string;

  json: DocData;
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
  /** Nom d'entreprise normalisé — voir `atsKey`. Clé primaire. */
  companyKey: string;
  ats: AtsProvider | "none";
  /** Identifiant du board chez l'ATS ; "" quand `ats === "none"`. */
  slug: string;
  resolvedAt: number;
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
  jobProfile!: Table<{ id: string; profile: JobSearchProfile }, string>; // Primary key: id (singleton "me")
  applications!: Table<Application, string>; // Primary key: id
  apiUsage!: Table<{ key: string; count: number }, string>; // Primary key: key
  commuteCache!: Table<{ key: string; text: string; at: number }, string>;
  atsDirectory!: Table<AtsDirectoryEntry, string>; // Primary key: companyKey

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

/**
 * Clés `normKey` de toutes les offres en base, statuts confondus.
 *
 * Sert au dédoublonnage inter-source du scan. Les statuts sont confondus à
 * dessein : une offre écartée ne doit pas revenir sous l'identifiant d'une autre
 * source.
 */
export async function jobKeys(): Promise<Set<string>> {
  try {
    const all = await db.jobs.toArray();
    return new Set(all.map((j) => normKey(j.company, j.title)).filter(Boolean));
  } catch (e) {
    console.warn("jobKeys error:", e);
    return new Set();
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
  try {
    const horsSujet = await db.jobs.filter((j) => (j.score ?? 0) < seuil).toArray();
    const ids = horsSujet.map((j) => j.id);
    if (ids.length > 0) {
      await db.jobs.bulkDelete(ids);
    }
    return ids.length;
  } catch (e) {
    console.warn("supprimerJobsSousLeSeuil error:", e);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// TEMPLATES API (modèles lettre/email)
// ---------------------------------------------------------------------------

/**
 * Seed le modèle de départ. Migration unique `pack-templates-v4` (v2 : refonte
 * « lettre seule » ; v3 : lettre personnelle « couteau suisse du web » ; v4 :
 * lettre spontanée courte orientée savoir-être) : chaque bump remplace les
 * modèles une fois, puis on préserve les éditions de l'utilisateur (on ne
 * réécrase plus ensuite).
 */
export async function ensureDefaultTemplates() {
  try {
    const KEY = "pack-templates-v4";
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

// ---------------------------------------------------------------------------
// JOB PROFILE API (critères de recherche paramétrables)
// ---------------------------------------------------------------------------

export async function getJobProfile(): Promise<JobSearchProfile | null> {
  try {
    return (await db.jobProfile.get("me"))?.profile ?? null;
  } catch (e) {
    console.warn("getJobProfile error:", e);
    return null;
  }
}

export async function saveJobProfile(profile: JobSearchProfile): Promise<void> {
  try {
    await db.jobProfile.put({ id: "me", profile });
  } catch (e) {
    console.warn("saveJobProfile error:", e);
  }
}

// ---------------------------------------------------------------------------
// APPLICATIONS API (tracker « Mes candidatures »)
// ---------------------------------------------------------------------------

export async function listApplicationsRaw(): Promise<Application[]> {
  try {
    return await db.applications.toArray();
  } catch (e) {
    console.warn("listApplicationsRaw error:", e);
    return [];
  }
}

export async function getApplicationByNormKey(key: string): Promise<Application | undefined> {
  try {
    return await db.applications.where("normKey").equals(key).first();
  } catch (e) {
    console.warn("getApplicationByNormKey error:", e);
    return undefined;
  }
}

export async function putApplication(app: Application): Promise<void> {
  try {
    await db.applications.put(app);
  } catch (e) {
    console.warn("putApplication error:", e);
  }
}

export async function deleteApplicationRecord(id: string): Promise<void> {
  try {
    await db.applications.delete(id);
  } catch (e) {
    console.warn("deleteApplicationRecord error:", e);
  }
}

/** Documents d'historique rattachés à une candidature. */
export async function listHistoryByApplication(applicationId: string): Promise<HistoryEntry[]> {
  try {
    const all = await db.history.filter((h) => h.applicationId === applicationId).toArray();
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch (e) {
    console.warn("listHistoryByApplication error:", e);
    return [];
  }
}

/** Documents d'historique non rattachés à une candidature (rayon « Mes CV »). */
export async function listUnattachedHistory(): Promise<HistoryEntry[]> {
  try {
    const all = await db.history.filter((h) => !h.applicationId).toArray();
    return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (e) {
    console.warn("listUnattachedHistory error:", e);
    return [];
  }
}

export async function updateHistoryFields(
  id: string,
  fields: Partial<Pick<HistoryEntry, "applicationId" | "label">>,
): Promise<void> {
  try {
    await db.history.update(id, fields);
  } catch (e) {
    console.warn("updateHistoryFields error:", e);
  }
}

export async function deleteHistoryEntries(ids: string[]): Promise<void> {
  try {
    await db.history.bulkDelete(ids);
  } catch (e) {
    console.warn("deleteHistoryEntries error:", e);
  }
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

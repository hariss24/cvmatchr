import { requireRemote, currentUserId, RemoteError } from "@/lib/storage/remote";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/storage/sessionCache";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";

const MASTER_CACHE_KEY = "documents:master";
const MASTER_DOC_ID = "master-cv";

/**
 * Retourne le CV Maître stocké sur le compte distant, ou null s'il n'existe pas / est vide / pas de compte.
 */
export async function loadMasterResume(): Promise<Resume | null> {
  const enMemoire = cacheGet<Resume | null>(MASTER_CACHE_KEY);
  if (enMemoire !== undefined) return enMemoire;

  const userId = await currentUserId();
  if (!userId) return null;

  try {
    const { supabase } = await requireRemote();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId)
      .eq("doc_type", "CV")
      .eq("label", "master")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        cacheSet(MASTER_CACHE_KEY, null);
        return null;
      }
      throw new RemoteError("Impossible de charger le CV Maître.", error);
    }
    if (!data || !data.content) {
      cacheSet(MASTER_CACHE_KEY, null);
      return null;
    }

    const resume = normalizeResume(data.content as Resume);
    const result = isEmptyResume(resume) ? null : resume;
    cacheSet(MASTER_CACHE_KEY, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Enregistre un CV comme CV Maître sur le compte Supabase.
 */
export async function saveMasterResume(resume: Resume, templateId: TemplateId | null = null): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const cleanResume = normalizeResume(structuredClone(resume));
  const row = {
    user_id: userId,
    id: MASTER_DOC_ID,
    doc_type: "CV",
    title: "CV Maître",
    company: "",
    role: "",
    label: "master",
    content: cleanResume,
    template_id: templateId,
    application_id: null,
    notes: "",
    job_desc: "",
    pdf_views: 0,
    editor_reloads: 0,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("documents").upsert(row);
  if (error) throw new RemoteError("Impossible d'enregistrer le CV Maître.", error);

  cacheInvalidate("documents:");
  cacheSet(MASTER_CACHE_KEY, cleanResume);
}

/**
 * Supprime le CV Maître du compte distant.
 */
export async function clearMasterResume(): Promise<void> {
  const { supabase, userId } = await requireRemote();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("user_id", userId)
    .eq("label", "master");

  if (error) throw new RemoteError("Impossible de supprimer le CV Maître.", error);

  cacheInvalidate("documents:");
  cacheSet(MASTER_CACHE_KEY, null);
}

export const getMasterResume = loadMasterResume;
export const setMasterResume = saveMasterResume;

import { loadDraft, saveDraft } from "@/lib/storage/db";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";

/**
 * Le CV Maître est persisté comme n'importe quel document, via son brouillon par type
 * (`draft-Maître` en IndexedDB). On le relit ici pour servir de base à l'adaptation.
 */
const MASTER_DRAFT_ID = "draft-Maître";

/** Retourne le CV Maître stocké, ou null s'il n'existe pas / est vide. */
export async function loadMasterResume(): Promise<Resume | null> {
  const draft = await loadDraft(MASTER_DRAFT_ID);
  if (!draft || !draft.json) return null;
  const resume = normalizeResume(draft.json);
  return isEmptyResume(resume) ? null : resume;
}

/**
 * Enregistre un CV comme CV Maître.
 *
 * Sans lui, l'adaptation retombe sur le CV affiché : chaque offre part du CV
 * réécrit pour l'offre précédente, et le texte dérive d'adaptation en adaptation.
 * D'où ce raccourci, offert là où le manque se voit — dans la modale d'adaptation.
 */
export async function saveMasterResume(resume: Resume, templateId: TemplateId | null) {
  await saveDraft({
    id: MASTER_DRAFT_ID,
    json: structuredClone(resume),
    templateId,
    updatedAt: Date.now(),
  });
}

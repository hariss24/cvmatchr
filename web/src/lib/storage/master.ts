import { getHistoryEntry, saveHistoryEntry } from "@/lib/storage/db";
import { currentUserId } from "@/lib/storage/remote";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/schema";
import type { TemplateId } from "@/lib/resume/templates";

/**
 * Le CV Maître est un document du compte, de type `Maître`, d'identifiant fixe.
 *
 * Il n'est PAS rangé en type `CV` avec une étiquette : `label` est le nom
 * visible d'un document dans le rayon « Mes CV », et le détourner y afficherait
 * le CV Maître sous le nom « master ». Le type `Maître` existe dans `DocType`
 * comme dans la table `documents` — c'est lui qui doit servir.
 */
const MASTER_DOC_ID = "master";

/**
 * Retourne le CV Maître du compte, ou null s'il n'existe pas ou qu'il est vide.
 *
 * Sans compte, la réponse est `null` : ne pas être connecté est un état connu,
 * pas un incident, et l'éditeur reste utilisable sans compte (spec §4.5). En
 * revanche, une panne alors qu'une session existe est levée — la confondre avec
 * une absence relancerait la dérive d'adaptation en silence.
 */
export async function loadMasterResume(): Promise<Resume | null> {
  if (!(await currentUserId())) return null;
  const entry = await getHistoryEntry(MASTER_DOC_ID);
  if (!entry?.json) return null;
  const resume = normalizeResume(entry.json as Resume);
  return isEmptyResume(resume) ? null : resume;
}

/**
 * Enregistre un CV comme CV Maître.
 *
 * Sans lui, l'adaptation retombe sur le CV affiché : chaque offre part du CV
 * réécrit pour l'offre précédente, et le texte dérive d'adaptation en adaptation.
 *
 * Les erreurs ne sont pas attrapées, ici ni dans `loadMasterResume` : une panne
 * qui se ferait passer pour « pas de CV Maître » relancerait silencieusement
 * cette dérive, exactement ce que ce mécanisme existe pour empêcher.
 */
export async function saveMasterResume(resume: Resume, templateId: TemplateId | null) {
  await saveHistoryEntry({
    id: MASTER_DOC_ID,
    created_at: new Date().toISOString(),
    doc_type: "Maître",
    company: "",
    role: "",
    job_desc: "",
    filename: "CV Maître",
    notes: "",
    pdf_views: 0,
    editor_reloads: 0,
    json: structuredClone(resume),
    templateId,
  });
}

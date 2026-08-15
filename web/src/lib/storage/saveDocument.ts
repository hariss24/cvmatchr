import { useDocStore, type DocData } from "@/state/docStore";
import { useAuthStore } from "@/state/authStore";
import { saveHistoryEntry } from "@/lib/storage/db";
import { upsertApplicationForDocument, pruneAnonymousShelf } from "@/lib/applications/store";
import { pushAll } from "@/lib/storage/syncEngine";
import type { Resume, Letter, DocType } from "@/lib/resume/schema";

/** Nom de la personne selon le type : `sender_name` pour une lettre, `name` pour un CV. */
function personNameFor(docType: DocType, json: DocData): string {
  const name = docType === "Lettre" ? (json as Letter).sender_name : (json as Resume).name;
  return name?.trim() || docType;
}

/**
 * Enregistre le document courant dans « Mes candidatures » / « Mes CV », puis
 * tente de l'envoyer sur le compte.
 *
 * Extrait de `TopBar.onConvert`, où il n'était atteignable qu'en téléchargeant
 * un PDF — un CV jamais exporté n'existait donc nulle part (spec §2, constat 1).
 *
 * L'envoi ne peut jamais faire échouer l'enregistrement local : on rend
 * `'device'` et l'interface l'annonce honnêtement.
 */
export async function saveCurrentDocument(): Promise<'account' | 'device'> {
  const { company, role, docType, json, templateId } = useDocStore.getState();
  const name = personNameFor(docType, json);

  const applicationId = await upsertApplicationForDocument({ company, role, source: "generated" });
  const entryId = crypto.randomUUID();
  await saveHistoryEntry({
    id: entryId,
    created_at: new Date().toISOString(),
    doc_type: docType,
    company,
    role,
    job_desc: "",
    filename: `${name} - ${docType}.pdf`,
    notes: "",
    pdf_views: 0,
    editor_reloads: 0,
    last_viewed_at: new Date().toISOString(),
    json: structuredClone(json),
    templateId,
    applicationId,
  });
  if (!applicationId) await pruneAnonymousShelf(docType, entryId);

  if (!useAuthStore.getState().user) return 'device';
  try {
    await pushAll();
    return 'account';
  } catch (e) {
    console.warn("Envoi vers le compte impossible :", e);
    return 'device';
  }
}

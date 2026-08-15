import { useDocStore, type DocData } from "@/state/docStore";
import { useAuthStore } from "@/state/authStore";
import { saveHistoryEntry } from "@/lib/storage/db";
import { upsertApplicationForDocument, pruneAnonymousShelf } from "@/lib/applications/store";
import { RemoteError } from "@/lib/storage/remote";
import type { Resume, Letter, DocType } from "@/lib/resume/schema";

/** Nom de la personne selon le type : `sender_name` pour une lettre, `name` pour un CV. */
function personNameFor(docType: DocType, json: DocData): string {
  const name = docType === "Lettre" ? (json as Letter).sender_name : (json as Resume).name;
  return name?.trim() || docType;
}

/**
 * Enregistre le document courant sur le compte utilisateur.
 *
 * L'ordre change : le contrôle de connexion passe avant l'écriture.
 * Sans compte, l'éditeur reste utilisable mais « Enregistrer » invite à se connecter.
 */
export async function saveCurrentDocument(): Promise<'account'> {
  if (!useAuthStore.getState().user) {
    throw new RemoteError('Connectez-vous pour enregistrer ce document.');
  }
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

  return 'account';
}

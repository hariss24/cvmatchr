import { useDocStore, type DocData } from "@/state/docStore";
import { useAuthStore } from "@/state/authStore";
import { saveDocumentContent } from "@/lib/storage/db";
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
 * Met à jour le document en cours d'édition, ou en crée un s'il n'en existe pas
 * encore. Cette distinction est tout le chantier : la version précédente
 * appelait `crypto.randomUUID()` à chaque envoi, donc elle n'enregistrait pas,
 * elle archivait. Trois clics par jour : invisible. En automatique : une copie
 * du même CV par pause de frappe.
 *
 * Le contrôle de connexion passe avant l'écriture. Sans compte, l'éditeur reste
 * utilisable : une absence de compte n'est pas une panne, et se dit autrement.
 */
export async function saveCurrentDocument(): Promise<'account'> {
  if (!useAuthStore.getState().user) {
    throw new RemoteError('Connectez-vous pour enregistrer ce document.');
  }
  const { company, role, docType, json, templateId, documentId } = useDocStore.getState();
  const name = personNameFor(docType, json);

  const applicationId = await upsertApplicationForDocument({ company, role, source: "generated" });
  const estNouveau = !documentId;
  const entryId = documentId ?? crypto.randomUUID();

  await saveDocumentContent({
    id: entryId,
    doc_type: docType,
    company,
    role,
    filename: `${name} - ${docType}.pdf`,
    json: structuredClone(json),
    templateId,
    applicationId,
  });

  // Posée seulement après une écriture réussie : une identité posée à l'avance
  // survivrait à un échec et ferait croire, au prochain essai, qu'on met à jour
  // un document qui n'existe pas.
  if (estNouveau) useDocStore.getState().setDocumentId(entryId);

  // Le rangement du rayon anonyme ne concerne que les documents fraîchement
  // créés : le refaire à chaque mise à jour serait un appel réseau pour rien.
  if (estNouveau && !applicationId) await pruneAnonymousShelf(docType, entryId);

  return 'account';
}

/**
 * Nom du fichier PDF exporté.
 *
 * Il portait auparavant tout ce qu'on savait du dossier — nom du candidat, type,
 * entreprise, poste, date — et devenait illisible :
 * `Hariss_Hafeji_CV_SharkNinja_EMEA_Chef_de_Projet_Digital_Junior_2026-07-29`.
 * Le nom du candidat est déjà dans le document, l'entreprise sert au suivi de
 * candidature et non au fichier : ni l'un ni l'autre n'a sa place ici.
 *
 * Reste `CV_Poste`, plus la date si l'utilisateur la demande.
 */

/** ASCII, underscores : un nom de fichier que tous les systèmes acceptent. */
export function slug(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * `CV_Chef_de_projet`, `Lettre_Chef_de_projet_2026-07-29`, ou le seul type de
 * document quand le poste n'est pas renseigné.
 */
export function buildPdfFilename(docType: string, role: string, includeDate: boolean): string {
  const parts = [slug(docType), slug(role)];
  if (includeDate) parts.push(new Date().toISOString().slice(0, 10));
  return parts.filter(Boolean).join("_");
}

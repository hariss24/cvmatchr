/**
 * Règle du CV anonyme : il n'existe qu'un seul document anonyme par type de
 * document. Un nouvel export sans entreprise ni poste remplace le précédent,
 * silencieusement — le libellé « Dernier CV exporté » annonce déjà le
 * remplacement. Nommer un document, c'est le garder.
 * Module pur : travaille sur une forme minimale, pas sur `HistoryEntry`.
 */
export interface ShelfCandidate {
  id: string;
  doc_type: string;
  label?: string;
  applicationId?: string;
}

export const ANONYMOUS_LABELS: Record<string, string> = {
  CV: "Dernier CV exporté",
  Lettre: "Dernière lettre exportée",
};

/** Anonyme = dans le rayon (pas de candidature) et sans nom donné par l'utilisateur. */
export function isAnonymous(entry: ShelfCandidate): boolean {
  return !entry.applicationId && !(entry.label || "").trim();
}

/** Ids des anciens documents anonymes du même type à supprimer après un export. */
export function anonymousIdsToDelete(
  entries: ShelfCandidate[],
  docType: string,
  keepId: string,
): string[] {
  return entries
    .filter((e) => e.doc_type === docType && e.id !== keepId && isAnonymous(e))
    .map((e) => e.id);
}

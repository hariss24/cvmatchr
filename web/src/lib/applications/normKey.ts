/**
 * Clé de dédoublonnage d'une candidature : deux candidatures partageant la même
 * clé sont la même candidature. Module pur — aucune dépendance.
 */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `""` si entreprise ET poste sont vides : aucune candidature ne doit être créée. */
export function normKey(company: string, role: string): string {
  const c = norm(company || "");
  const r = norm(role || "");
  if (!c && !r) return "";
  return `${c}|${r}`;
}

/**
 * Domaine du jobboard où une offre est réellement publiée, pour aller chercher
 * son favicon (cf. spec §5.3.1).
 *
 * Le service de favicons échoue sur certains sous-domaines : vérifié en direct,
 * `candidat.francetravail.fr` et `jobs.lilylifestyle.co.uk` renvoient 404 (avec
 * un globe générique, identique à celui d'un domaine inexistant). On produit donc
 * une liste de candidats, du plus précis au plus général, que l'affichage essaie
 * dans l'ordre.
 *
 * Une réduction fixe aux deux derniers labels avait été envisagée : elle casse
 * sur les suffixes composés (`jobs.lilylifestyle.co.uk` → `co.uk`, sans favicon).
 * La cascade n'a pas ce défaut et évite d'embarquer une Public Suffix List.
 */

/** Hôte d'une URL ; "" si l'URL est vide ou invalide. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Domaines à essayer, du plus précis au plus général. On s'arrête à deux labels :
 * en dessous, on ne demanderait plus qu'un TLD.
 */
export function domainCandidates(host: string): string[] {
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i <= parts.length - 2; i++) out.push(parts.slice(i).join("."));
  return out;
}

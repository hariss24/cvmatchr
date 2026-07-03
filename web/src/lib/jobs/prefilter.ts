/**
 * Pré-tri gratuit (sans IA) des offres. Mesure la pertinence d'une offre pour un profil
 * via ses mots-clés de compétences : chaque mot-clé présent dans le titre vaut 2, dans la
 * description vaut 1. 0 = aucun recoupement (offre écartée avant l'IA).
 */
export function relevance(
  offer: { title: string; jobText: string },
  keywords: string[],
): number {
  const title = offer.title.toLowerCase();
  const desc = offer.jobText.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    if (title.includes(k)) score += 2;
    if (desc.includes(k)) score += 1;
  }
  return score;
}

/** Minuscule + suppression des accents (aligné sur includeFilter). */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Pré-tri gratuit (sans IA) des offres. Mesure la pertinence d'une offre pour un profil
 * via ses mots-clés : chaque MOT d'un mot-clé présent dans le titre vaut 2, dans la
 * description vaut 1. 0 = aucun recoupement (offre écartée avant l'IA).
 *
 * On tokenise (et on ignore les accents + les mots ≤ 2 lettres) pour qu'un intitulé
 * multi-mots comme « Développeur web » matche une offre « Développeur Web Senior ».
 * Sans ça, la comparaison littérale de la phrase entière écartait ces offres en silence.
 */
export function relevance(
  offer: { title: string; jobText: string },
  keywords: string[],
): number {
  const title = normalize(offer.title);
  const desc = normalize(offer.jobText);
  let score = 0;
  for (const kw of keywords) {
    for (const word of normalize(kw).split(/\s+/)) {
      if (word.length <= 2) continue;
      if (title.includes(word)) score += 2;
      if (desc.includes(word)) score += 1;
    }
  }
  return score;
}

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exécute `travail` sur chaque élément, au plus `plafond` à la fois.
 *
 * Une tâche qui jette rend `null` plutôt que d'emporter le lot : un balayage de
 * 15 000 boards ne doit pas s'arrêter au premier serveur grognon.
 *
 * `pauseMs` fait souffler chaque ouvrier entre deux éléments. Sans ce frein,
 * une API qui bride finit par tout refuser : mesuré le 05/08/2026 sur
 * SmartRecruiters, 25 000 requêtes à 12 de front donnent 4 825 réponses puis
 * 20 175 refus, alors que 4 de front avec 200 ms de pause tiennent 6 000
 * requêtes sans un seul refus, à 16 par seconde.
 */
export async function enLot(items, plafond, travail, pauseMs = 0) {
  const resultats = new Array(items.length).fill(null);
  let curseur = 0;

  const ouvrier = async () => {
    while (curseur < items.length) {
      const i = curseur++;
      try {
        resultats[i] = await travail(items[i], i);
      } catch {
        resultats[i] = null;
      }
      if (pauseMs) await attendre(pauseMs);
    }
  };

  await Promise.all(Array.from({ length: Math.min(plafond, items.length) }, ouvrier));
  return resultats;
}

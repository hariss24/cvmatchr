/**
 * Exécute `travail` sur chaque élément, au plus `plafond` à la fois.
 *
 * Une tâche qui jette rend `null` plutôt que d'emporter le lot : un balayage de
 * 15 000 boards ne doit pas s'arrêter au premier serveur grognon.
 */
export async function enLot(items, plafond, travail) {
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
    }
  };

  await Promise.all(Array.from({ length: Math.min(plafond, items.length) }, ouvrier));
  return resultats;
}

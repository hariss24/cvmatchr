// Depuis quand connaît-on cette offre ?
//
// Mesuré le 04/08/2026 sur les 9 719 offres moissonnées : âge médian 46 jours,
// 44 % au-delà de 60 jours, seules 617 à moins de 48 h. Ce qui fait la
// concurrence sur une offre, c'est son ancienneté — pas le canal de
// publication. D'où le scan quotidien, et d'où ce champ.
//
// `publieLe` ne peut pas jouer ce rôle : Greenhouse renvoie `updated_at` (une
// simple retouche rajeunit l'offre), Ashby et SmartRecruiters ont leur propre
// notion, et le champ est parfois vide. `decouverteLe` est notre propre
// constat, homogène sur les quatre ATS : le jour où notre scan a vu l'offre
// pour la première fois.

/** Identité stable d'une offre, même clé que le tri de l'index. */
export function cleOffre(o) {
  return `${o.ats}:${o.slug}:${o.id}`;
}

/** Jour UTC, « 2026-08-04 ». */
export function jour(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Reporte `decouverteLe` du passage précédent sur les offres du passage courant.
 *
 * Une offre absente du fichier précédent est nouvelle : elle prend la date du
 * jour. Une offre disparue n'est pas conservée — l'index ne décrit que les
 * offres ouvertes, et une offre pourvue doit sortir.
 */
export function dater(precedentes, courantes, jourCourant) {
  const connues = new Map(precedentes.map((o) => [cleOffre(o), o.decouverteLe]));
  return courantes.map((o) => ({ ...o, decouverteLe: connues.get(cleOffre(o)) ?? jourCourant }));
}

/**
 * Offres du passage précédent appartenant à un board resté INDÉTERMINÉ.
 *
 * Même discipline qu'en Brique 1 : `null` veut dire « on ne sait pas », pas
 * « il n'y a rien ». Sans cette reprise, les offres d'un board momentanément
 * injoignable sortaient du fichier, puis y revenaient le lendemain avec la
 * date du jour — annoncées comme neuves alors qu'elles ne l'étaient pas.
 * Mesuré le 04/08/2026 : 3 boards indéterminés sur 448 en un seul passage.
 */
export function reprendreIndetermines(precedentes, clesIndeterminees) {
  return precedentes.filter((o) => clesIndeterminees.has(`${o.ats}:${o.slug}`));
}

/**
 * Distance à vol d'oiseau, en local. Sert à NOTER la proximité d'une offre ;
 * le temps de trajet réel (Google Maps) est calculé à la demande à l'ouverture
 * d'une offre, jamais pendant le scan — cf. spec §2.7 (354 appels facturés par
 * scan sinon, et 30 à 45 s de latence).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Lit « lat,lng » (format de `commuteDestination` chez France Travail) ; null sinon. */
export function parseLatLng(s: string): LatLng | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const R_TERRE_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance orthodromique entre deux points, en kilomètres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points de proximité : plein tarif dans le rayon souhaité, décroissance
 * linéaire jusqu'à 3× ce rayon, zéro au-delà.
 * Distance inconnue → moitié des points : ne pas condamner une offre sur une
 * donnée absente (12 % des offres Adzuna n'ont pas de coordonnées).
 */
export function distancePoints(km: number | null, radiusKm: number, max: number): number {
  if (km === null) return Math.round(max / 2);
  const rayon = Math.max(1, radiusKm);
  if (km <= rayon) return max;
  const limite = rayon * 3;
  if (km >= limite) return 0;
  return Math.round(max * (1 - (km - rayon) / (limite - rayon)));
}

/**
 * Géocodage du domicile et clé de cache des trajets.
 *
 * Le géocodage passe par l'API Adresse de l'État : gratuite, sans clé, et
 * appelée UNE FOIS par adresse (le résultat est mis en cache par l'appelant).
 * À ne pas confondre avec les 354 appels Google Maps par scan que ce chantier
 * supprime (spec §2.7).
 */

import type { LatLng } from "./geo";

const ADRESSE_URL = "https://api-adresse.data.gouv.fr/search/";

/**
 * Clé de cache d'un temps de trajet. La destination est arrondie à ~1 km pour
 * mutualiser les lieux voisins : sur 150 offres réelles, 107 lieux distincts
 * seulement (spec §2.7).
 */
export function commuteCacheKey(home: string, dest: string, modes: string[]): string {
  const arrondi = dest.replace(/-?\d+\.\d+/g, (n) => Number(n).toFixed(2));
  return `${home.trim().toLowerCase()}|${arrondi}|${[...modes].sort().join(",")}`;
}

/** Coordonnées d'une adresse libre ; null si vide, introuvable ou réseau en panne. */
export async function geocodeHome(address: string): Promise<LatLng | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const res = await fetch(`${ADRESSE_URL}?q=${encodeURIComponent(q)}&limit=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (!c || c.length < 2) return null;
    // GeoJSON : [longitude, latitude].
    return { lat: c[1], lng: c[0] };
  } catch {
    // Le géocodage est un confort : son échec ne doit pas faire échouer le scan.
    return null;
  }
}

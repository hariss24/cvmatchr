import { NextResponse } from "next/server";
import { createServerClientHelper } from "@/lib/supabase/server";

/**
 * Limitation de débit par IP pour les routes API ouvertes aux visiteurs non
 * connectés.
 *
 * Les routes IA sont gardées ailleurs, par `guardAiRequest` (compte requis,
 * crédits décomptés). Celles listées ici doivent rester accessibles sans compte
 * — chercher des offres fait partie de ce qu'on montre avant l'inscription —
 * mais elles dépensent des clés facturées à l'appel. Le débit est donc le seul
 * levier disponible.
 *
 * Le compteur vit en base (`consume_rate_limit`, migration 0004) et non en
 * mémoire : sur Vercel, deux appels consécutifs peuvent tomber sur deux
 * instances différentes, et un compteur local ne verrait qu'une fraction du
 * trafic.
 */

export interface RateLimitRule {
  /** Appels autorisés par IP et par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
}

const HEURE = 3600;

/**
 * Une entrée par route à protéger. Les plafonds sont calés sur l'usage réel
 * d'une personne qui cherche activement un emploi, avec une marge large : ils
 * visent la boucle automatisée, pas l'utilisateur pressé.
 */
export const RATE_LIMITS = {
  /** Force brute sur le mot de passe partagé. */
  login: { limit: 5, windowSeconds: 300 },
  /**
   * Reconnaissance d'un compte Google, appelée seulement après un échec de mot
   * de passe. Plafond serré : c'est le seul point de l'app qui répond quoi que
   * ce soit au sujet d'une adresse, et le compte à protéger est celui d'un
   * utilisateur légitime qui se trompe deux ou trois fois, pas dix.
   */
  "auth-methode": { limit: 10, windowSeconds: 300 },
  /** France Travail + Adzuna + JSearch. Un scan complet par appel. */
  "jobs-search": { limit: 20, windowSeconds: HEURE },
  /** Google Maps, facturé à l'appel. Une offre ouverte = un appel (caché 30 j côté client). */
  "jobs-commute": { limit: 60, windowSeconds: HEURE },
  /** Brandfetch + visites de pages d'accueil : ~9 s et 120 entreprises par appel. */
  "jobs-logos": { limit: 30, windowSeconds: HEURE },
  /** Appels sortants vers Greenhouse/Lever : abuser d'ici fait bannir notre IP. */
  "jobs-ats": { limit: 30, windowSeconds: HEURE },
  /** Scraping d'une URL arbitraire : notre IP et notre temps machine. */
  "extract-job": { limit: 30, windowSeconds: HEURE },
  /** Valide une clé API tierce : sinon on sert de banc d'essai à des clés volées. */
  "test-model": { limit: 10, windowSeconds: HEURE },
  /** Autocomplétion (proxy geo.api.gouv.fr, gratuit) : plafond haut, anti-saturation seulement. */
  "jobs-locations": { limit: 300, windowSeconds: HEURE },
  /** Autocomplétion sur un jeu de données local : coût CPU uniquement. */
  "jobs-metiers": { limit: 300, windowSeconds: HEURE },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitedRoute = keyof typeof RATE_LIMITS;

/**
 * IP de l'appelant. Sur Vercel, `x-forwarded-for` est réécrit par la plateforme :
 * son premier segment est l'adresse réelle et ne peut pas être falsifié par le
 * client. Hors Vercel (proxy maison), cet en-tête devient déclaratif — la limite
 * resterait alors contournable.
 */
export function clientIp(req: Request): string {
  const premier = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (premier) return premier;
  return req.headers.get("x-real-ip")?.trim() || "ip-inconnue";
}

/** Clé du compteur. Composée serveur : rien de ce que le client envoie n'y entre. */
export function bucketFor(route: RateLimitedRoute, ip: string): string {
  return `${route}:${ip}`;
}

/**
 * Consomme un appel. Renvoie `null` si la requête peut continuer, ou la réponse
 * 429 à retourner telle quelle.
 *
 * Deux cas laissent délibérément passer :
 *   - Supabase non configuré : l'app tourne en mode 100 % local, il n'y a ni
 *     base ni clé serveur à protéger.
 *   - Base injoignable ou en erreur : on préfère servir un visiteur légitime
 *     pendant une panne plutôt que de rendre la recherche d'offres inutilisable.
 *     La fenêtre d'exposition est celle de la panne, et l'incident est journalisé.
 */
export async function enforceRateLimit(
  req: Request,
  route: RateLimitedRoute,
): Promise<Response | null> {
  const supabase = await createServerClientHelper();
  if (!supabase) return null;

  const { limit, windowSeconds } = RATE_LIMITS[route];

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: bucketFor(route, clientIp(req)),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.warn(`Limite de débit indisponible sur ${route} :`, error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.allowed) return null;

  const retryAfter = Number(row.retry_after) || windowSeconds;
  return NextResponse.json(
    { error: "Trop de requêtes. Réessayez dans un instant." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

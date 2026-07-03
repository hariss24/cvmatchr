import { DEFAULT_PROFILE, type JobSearchProfile } from "./profile";

/**
 * Résout le profil de recherche à utiliser pour une requête.
 *
 * **Point d'extension multi-utilisateur** : aujourd'hui, une seule config (`DEFAULT_PROFILE`).
 * Demain, cette fonction lira le profil du compte (session) ou du corps de requête — les modules
 * `lib/jobs/` reçoivent déjà le profil en argument, donc rien d'autre ne changera.
 */
export function resolveProfile(req?: Request): JobSearchProfile {
  void req; // réservé pour la résolution par compte (SaaS)
  return DEFAULT_PROFILE;
}

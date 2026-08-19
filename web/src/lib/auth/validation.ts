/**
 * Longueur exigée côté navigateur. Elle doit rester alignée sur le réglage
 * « Minimum password length » du tableau de bord Supabase : si les deux
 * divergent, l'app annonce une règle que le serveur n'applique pas.
 */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/** Renvoie le message d'erreur à afficher, ou `null` si la valeur convient. */
export function validerEmail(valeur: string): string | null {
  const propre = valeur.trim();
  if (!propre) return 'Indiquez votre adresse email.';
  // Volontairement grossier : la seule validation qui fait autorité est l'envoi
  // du courriel. On n'arrête ici que les fautes de frappe évidentes.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) {
    return "Cette adresse email n'est pas valide.";
  }
  return null;
}

/** Renvoie le message d'erreur à afficher, ou `null` si la valeur convient. */
export function validerMotDePasse(valeur: string): string | null {
  if (!valeur) return 'Indiquez un mot de passe.';
  if (valeur.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`;
  }
  return null;
}

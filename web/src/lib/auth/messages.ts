/**
 * Supabase répond en anglais. Cette table traduit les cas réellement
 * rencontrés dans les parcours de connexion ; le reste tombe sur un message
 * générique qui conserve le texte d'origine — un écran muet devant une erreur
 * imprévue est pire qu'une phrase anglaise.
 */
const TRADUCTIONS: ReadonlyArray<{ motif: string; texte: string }> = [
  { motif: 'invalid login credentials', texte: 'Email ou mot de passe incorrect.' },
  { motif: 'user already registered', texte: 'Cette adresse a déjà un compte.' },
  { motif: 'password should be at least', texte: 'Le mot de passe doit faire au moins 8 caractères.' },
  { motif: 'email rate limit exceeded', texte: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  { motif: 'over email send rate limit', texte: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  // Panne d'expédition côté serveur (SMTP absent, refusé, ou quota atteint) :
  // « Error sending confirmation email », « ... recovery email », « ... magic
  // link ». Rien de ce que la personne saisit n'y change quoi que ce soit — le
  // message doit donc la décharger explicitement, sinon elle recommence en
  // boucle en croyant s'être trompée.
  { motif: 'error sending', texte: "L'envoi de l'email a échoué. Le problème vient de nous, pas de vous : réessayez dans quelques minutes." },
  { motif: 'token has expired or is invalid', texte: "Ce code n'est plus valable. Demandez-en un nouveau." },
  { motif: 'email not confirmed', texte: "Confirmez d'abord votre adresse : le code vous a été envoyé par email." },
];

/**
 * Les deux seules réponses de Supabase qu'un compte Google peut expliquer :
 * « identifiants refusés » (le compte n'a jamais eu de mot de passe) et
 * « adresse déjà prise » (elle l'est par le compte Google).
 *
 * Sert à n'interroger `/api/auth/methode` que dans ces cas. Une coupure réseau
 * ou une erreur inconnue ne dit rien sur la méthode d'inscription : poser la
 * question consommerait le compteur de débit sans pouvoir rien apprendre.
 */
export function erreurPeutVenirDeGoogle(brut: string): boolean {
  const normalise = brut.toLowerCase();
  return (
    normalise.includes('invalid login credentials') ||
    normalise.includes('user already registered')
  );
}

/**
 * @param brut       message renvoyé par Supabase
 * @param compteGoogle vrai si la route /api/auth/methode a reconnu un compte
 *                     Google pour cette adresse — le message change alors
 *                     complètement, puisque la personne n'a jamais eu de mot
 *                     de passe à se rappeler.
 */
export function messageErreurAuth(brut: string, compteGoogle = false): string {
  if (compteGoogle) {
    return 'Ce compte a été créé avec Google. Utilisez le bouton Google ci-dessus.';
  }

  const normalise = brut.toLowerCase();
  const trouve = TRADUCTIONS.find(({ motif }) => normalise.includes(motif));
  if (trouve) return trouve.texte;

  if (!brut.trim()) return 'La connexion a échoué. Réessayez dans un instant.';
  return `La connexion a échoué. Détail : ${brut}`;
}

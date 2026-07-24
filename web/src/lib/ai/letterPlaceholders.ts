/**
 * Détection des emplacements à compléter qu'une IA laisse parfois dans un corps de
 * lettre (« en tant que Poste occupé chez Entreprise », « [votre chiffre] »).
 *
 * Le prompt les interdit, mais une consigne n'est pas une garantie : une lettre à
 * trous part telle quelle au recruteur, donc on vérifie avant de la renvoyer.
 *
 * Les variables de modèle `{Entreprise}`, `{Poste}`… sont LÉGITIMES (l'app les
 * remplit) : aucun motif ci-dessous ne porte sur les accolades.
 */

const PATTERNS: RegExp[] = [
  // Crochets : le format que le modèle recopie depuis le MODÈLE DE TON du prompt.
  /\[[^\]\n]{2,80}\]/,
  // Étiquettes de champ écrites en clair, crochets retirés. Pas de `\b` : il ne marque
  // pas de frontière après un accent (« occupé »), qui n'appartient pas à \w en JS.
  /(poste occup[ée]|r[ée]alisation marquante|m[ée]trique chiffr[ée]e|nom du projet|nom de l'entreprise|votre chiffre|[àa] compl[ée]ter|[àa] pr[ée]ciser|ins[ée]rer ici)/i,
  // Chiffres non renseignés : « X ans », « XX % ».
  /\bX{1,3}\s*(ans|ann[ée]es|%)/,
];

/** Renvoie le premier trou trouvé (pour le message d'erreur), sinon null. */
export function findLetterPlaceholder(body: string): string | null {
  for (const re of PATTERNS) {
    const m = re.exec(body);
    if (m) return m[0];
  }
  return null;
}

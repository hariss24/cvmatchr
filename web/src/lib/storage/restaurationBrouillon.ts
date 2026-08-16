let enCours = false;

/**
 * Marque les écritures faites en RESTAURANT un brouillon, par opposition à
 * celles faites en éditant.
 *
 * Les deux passent par le même store, et l'enregistrement automatique ne peut
 * pas les distinguer autrement : au chargement de la page, `useAutoDraft`
 * repose le brouillon dans le document, ce que le hook lisait comme une frappe.
 * Résultat observé à l'écran : « Enregistrement… » dès l'ouverture de l'app,
 * sans que personne n'ait touché à rien — et un document créé sur le compte
 * pour une visite.
 *
 * Le drapeau est levé et baissé de façon synchrone : les abonnés Zustand sont
 * notifiés pendant `setState`, donc ils le voient forcément levé.
 */
export function pendantRestauration<T>(ecrire: () => T): T {
  enCours = true;
  try {
    return ecrire();
  } finally {
    enCours = false;
  }
}

export function estUneRestauration(): boolean {
  return enCours;
}

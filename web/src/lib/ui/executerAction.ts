import { toast } from "@/state/uiStore";
import { RemoteError } from "@/lib/storage/remote";

/**
 * Exécute une écriture et la fait parler si elle échoue.
 *
 * Depuis le passage au serveur, toute écriture peut être refusée (pas de
 * réseau, session expirée, refus de la base). Les lectures l'annoncent déjà
 * (`EtatErreur`) ; les écritures, elles, étaient lancées sans filet dans des
 * gestionnaires de clic : renommer, supprimer, marquer un entretien ou saisir
 * une note échouait en laissant l'écran strictement inchangé — l'utilisateur
 * croyait son geste enregistré.
 *
 * Rend `true` si l'action a abouti, ce qui permet d'enchaîner (rafraîchir la
 * liste, fermer un champ) seulement quand c'est vrai.
 */
export async function executerAction(
  action: () => Promise<unknown>,
  messageParDefaut: string,
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (e) {
    toast(e instanceof RemoteError ? e.message : messageParDefaut, "error");
    return false;
  }
}

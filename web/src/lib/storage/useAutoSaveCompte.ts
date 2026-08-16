import { useEffect } from "react";
import { useDocStore, type DocStore } from "@/state/docStore";
import { useAuthStore } from "@/state/authStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useSaveStateStore } from "@/state/saveStateStore";
import { saveCurrentDocument } from "@/lib/storage/saveDocument";
import { estUneRestauration } from "@/lib/storage/restaurationBrouillon";

/**
 * Délai d'inactivité avant l'envoi au compte, volontairement généreux.
 *
 * Chaque envoi transporte le CV entier, photo en base64 comprise
 * (`LIMITES.md` §1.1). Quatre secondes séparent une pause de frappe d'une vraie
 * pause de travail : on n'envoie pas entre deux mots. Si le poids se fait sentir
 * à l'usage, la réponse sera de sortir les photos vers Supabase Storage — pas de
 * rallonger ce délai jusqu'à perdre du travail.
 */
export const DELAI_ENVOI_MS = 4000;

/** Ce dont dépend le contenu enregistré. Le reste (aperçu, options d'export) ne déclenche rien. */
function empreinte(s: DocStore) {
  return [s.json, s.templateId, s.company, s.role, s.docType];
}

function aChange(a: DocStore, b: DocStore) {
  const avant = empreinte(b);
  return empreinte(a).some((v, i) => v !== avant[i]);
}

/**
 * Envoie le document au compte tout seul, après une pause de frappe.
 *
 * Remplace le bouton « Enregistrer ». Deux indicateurs se contredisaient à
 * l'écran — une pastille « Enregistré » qui parlait du brouillon local, une
 * phrase « Modifications non enregistrées » qui parlait du compte — et
 * l'utilisateur devait, en plus, penser à cliquer.
 *
 * Ne part pas si personne n'est connecté : l'éditeur reste utilisable, l'état le
 * dit autrement qu'une panne. Un échec ne réessaie pas en boucle — il attend la
 * prochaine modification, sans quoi une coupure réseau ferait tourner l'envoi
 * indéfiniment.
 */
export function useAutoSaveCompte() {
  useEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let envoiEnCours = false;
    const { setState } = useSaveStateStore.getState();

    async function envoyer() {
      if (envoiEnCours) return;
      if (!useAuthStore.getState().user) {
        setState("anonymous");
        return;
      }
      envoiEnCours = true;
      setState("saving");
      try {
        await saveCurrentDocument();
        setState("saved");
      } catch {
        // Le message détaillé n'a pas sa place dans la barre du haut, qui doit
        // rester courte ; l'état suffit à ne pas mentir sur ce qui s'est passé.
        setState("error");
      } finally {
        envoiEnCours = false;
      }
    }

    const unsub = useDocStore.subscribe((s, prev) => {
      // `documentId` change quand un envoi RÉUSSIT : le prendre pour une
      // modification relancerait un envoi, qui en relancerait un autre.
      if (!aChange(s, prev)) return;

      // Restaurer le brouillon au chargement de la page n'est pas une
      // modification : sans ce garde-fou, ouvrir l'app enregistrait toute seule
      // — « Enregistrement… » s'affichait avant que l'utilisateur ait touché
      // quoi que ce soit, et une simple visite créait un document sur le compte.
      if (estUneRestauration()) return;

      // Auto-sauvegarde coupée dans les réglages : choix explicite de
      // l'utilisateur, on ne l'enregistre plus à sa place.
      if (useSettingsStore.getState().autosaveDelay === 0) return;

      if (!useAuthStore.getState().user) {
        setState("anonymous");
        return;
      }

      setState("idle");
      clearTimeout(minuterie);
      minuterie = setTimeout(() => void envoyer(), DELAI_ENVOI_MS);
    });

    return () => {
      unsub();
      clearTimeout(minuterie);
    };
  }, []);
}

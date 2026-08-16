import { create } from "zustand";

/**
 * Ce que la barre du haut dit de l'enregistrement.
 *
 * Cinq états, et pas moins : une absence de compte, un refus du serveur et une
 * panne réseau ne se disent jamais de la même façon (règle du chantier
 * « serveur source unique »). Annoncer « Enregistré » alors que l'envoi a
 * échoué est exactement le malentendu que ce chantier répare.
 *
 * `device` a disparu avec le bouton « Enregistrer » : plus rien n'est
 * « enregistré sur cet appareil » du point de vue de l'utilisateur. Le brouillon
 * local existe toujours, mais c'est un filet contre le crash du navigateur, pas
 * une promesse — il n'a donc rien à annoncer.
 */
export type SaveState =
  /** Rien à dire : à jour, ou modifications trop récentes pour être parties. */
  | "idle"
  /** L'envoi est en vol. */
  | "saving"
  /** Le compte a bien reçu la dernière version. */
  | "saved"
  /** Personne n'est connecté : rien ne part, et ce n'est pas une panne. */
  | "anonymous"
  /** L'envoi a échoué. Le prochain aura lieu à la prochaine modification. */
  | "error";

interface SaveStateStore {
  state: SaveState;
  setState: (state: SaveState) => void;
}

export const useSaveStateStore = create<SaveStateStore>((set) => ({
  state: "idle",
  setState: (state) => set({ state }),
}));

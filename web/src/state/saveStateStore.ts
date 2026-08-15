import { create } from "zustand";

/**
 * État d'enregistrement affiché en permanence à côté du bouton.
 *
 * `device` et `account` sont distincts à dessein : annoncer « enregistré sur
 * votre compte » alors que l'envoi a échoué (hors ligne, non connecté) est
 * exactement le malentendu que ce chantier répare.
 */
export type SaveState = "dirty" | "device" | "account";

interface SaveStateStore {
  state: SaveState;
  markDirty: () => void;
  markSaved: (where: "device" | "account") => void;
}

export const useSaveStateStore = create<SaveStateStore>((set) => ({
  state: "dirty",
  markDirty: () => set({ state: "dirty" }),
  markSaved: (where) => set({ state: where }),
}));

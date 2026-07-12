import { create } from "zustand";
import { type DocData, useDocStore } from "./docStore";
import { type TemplateId } from "@/lib/resume/templates";

export type DocumentSnapshot = {
  json: DocData;
  html: string;
  css: string;
  templateId: TemplateId;
};

export type HistoryStore = {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
  isTracking: boolean;

  /** Ajoute un état à l'historique passé et efface le futur. */
  push: (state: DocumentSnapshot) => void;
  /** Applique le retour en arrière, retourne le nouvel état ou null si impossible. */
  undo: (currentState: DocumentSnapshot) => DocumentSnapshot | null;
  /** Applique le rétablissement, retourne le nouvel état ou null si impossible. */
  redo: (currentState: DocumentSnapshot) => DocumentSnapshot | null;
  
  clear: () => void;
  pause: () => void;
  resume: () => void;
};

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  isTracking: true,

  push: (state) => {
    if (!get().isTracking) return;
    set((s) => {
      const last = s.past[s.past.length - 1];
      // Ne pas pousser si c'est identique au dernier état (optimisation)
      if (last && JSON.stringify(last) === JSON.stringify(state)) return s;
      
      // On garde max 50 étapes pour ne pas exploser la RAM
      const newPast = [...s.past, state].slice(-50);
      return { past: newPast, future: [] };
    });
  },

  undo: (currentState) => {
    const s = get();
    if (s.past.length === 0) return null;

    const previous = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      future: [currentState, ...s.future].slice(-50),
    });
    return previous;
  },

  redo: (currentState) => {
    const s = get();
    if (s.future.length === 0) return null;

    const next = s.future[0];
    set({
      past: [...s.past, currentState].slice(-50),
      future: s.future.slice(1),
    });
    return next;
  },

  clear: () => set({ past: [], future: [] }),
  pause: () => set({ isTracking: false }),
  resume: () => set({ isTracking: true }),
}));

// ---- Système de tracking auto (Debounce) ----

let debounceTimer: ReturnType<typeof setTimeout>;
let sequenceStartState: DocumentSnapshot | null = null;

/**
 * Initialise le système d'historique en s'abonnant au docStore.
 * À appeler une seule fois (ex: dans layout ou un wrapper global).
 */
export function initHistoryTracking() {
  if (typeof window === "undefined") return;

  useDocStore.subscribe((state, prevState) => {
    // Si l'historique est en pause (ex: pendant qu'on restaure un undo), on ignore
    if (!useHistoryStore.getState().isTracking) return;

    // On ne tracke que les changements qui affectent le document lui-même
    const hasDocChanged = 
      state.json !== prevState.json || 
      state.html !== prevState.html || 
      state.css !== prevState.css ||
      state.templateId !== prevState.templateId;

    if (!hasDocChanged) return;

    // Si c'est le début d'une nouvelle "séquence" de frappes, on mémorise l'état AVANT la frappe
    if (!sequenceStartState) {
      sequenceStartState = {
        json: prevState.json,
        html: prevState.html,
        css: prevState.css,
        templateId: prevState.templateId,
      };
    }

    clearTimeout(debounceTimer);
    
    // On attend 1 seconde d'inactivité avant de valider la séquence
    debounceTimer = setTimeout(() => {
      if (sequenceStartState) {
        useHistoryStore.getState().push(sequenceStartState);
        sequenceStartState = null; // Prêt pour la prochaine séquence
      }
    }, 1000);
  });
}

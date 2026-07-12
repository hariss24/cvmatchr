"use client";

import { useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { useHistoryStore, initHistoryTracking, type DocumentSnapshot } from "@/state/historyStore";
import { toast } from "@/state/uiStore";

let initialized = false;

export function useGlobalUndoRedo() {
  useEffect(() => {
    if (!initialized) {
      initHistoryTracking();
      initialized = true;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans une modale native ou autre
      // (Optionnel : on peut ignorer les champs texte pour laisser le navigateur faire, 
      // mais si on a un système d'undo global performant, on peut vouloir l'utiliser partout.
      // Dans le cas de formulaires standards, c'est généralement mieux de laisser le navigateur
      // gérer l'undo de texte interne à l'input s'il est focusé).
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputOrTextarea = activeTag === "input" || activeTag === "textarea";
      
      // Monaco editor (mode expert) gère son propre undo, on ne veut pas interférer.
      // Il utilise un textarea (isInputOrTextarea = true).
      // Donc la règle `if (isInputOrTextarea) return;` protège parfaitement Monaco.
      if (isInputOrTextarea) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault(); // Bloquer l'undo natif global

        const docState = useDocStore.getState();
        const currentState = {
          json: docState.json,
          html: docState.html,
          css: docState.css,
          templateId: docState.templateId,
        };

        if (e.shiftKey) {
          // Redo
          const nextState = useHistoryStore.getState().redo(currentState);
          if (nextState) {
            applyState(nextState);
            toast("Rétabli", "info");
          }
        } else {
          // Undo
          const prevState = useHistoryStore.getState().undo(currentState);
          if (prevState) {
            applyState(prevState);
            toast("Annulé", "info");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function applyState(state: DocumentSnapshot) {
  // On met en pause le tracking pendant qu'on applique le retour en arrière
  // pour éviter que le Zustand .set() ne déclenche une nouvelle sauvegarde.
  useHistoryStore.getState().pause();
  
  useDocStore.setState({
    json: state.json,
    html: state.html,
    css: state.css,
    templateId: state.templateId,
  });

  // On relance le tracking après un court délai
  setTimeout(() => {
    useHistoryStore.getState().resume();
  }, 50);
}

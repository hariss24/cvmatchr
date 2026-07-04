import { useEffect } from "react";

/**
 * Ferme une modale à la touche Échap (M4). À appeler AVANT tout `return null`
 * conditionnel (règle des hooks). `active` = modale ouverte et non occupée.
 */
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

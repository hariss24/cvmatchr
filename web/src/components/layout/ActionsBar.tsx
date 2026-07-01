"use client";

import { useState, useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { defaultJsonFor } from "@/state/docStore";
import { takeSnapshot } from "@/lib/storage/snapshots";
import { uiConfirm, toast } from "@/state/uiStore";
import TailorModal from "@/components/modals/TailorModal";

/**
 * Barre d'actions du bas (`.actions`) : adapter à une offre, effacer, rappel des raccourcis.
 * Port de la `.actions` de l'app Flask (templates/index.html).
 */
export default function ActionsBar() {
  const docType = useDocStore((s) => s.docType);
  const setJson = useDocStore((s) => s.setJson);
  const pendingJobDesc = useDocStore((s) => s.pendingJobDesc);
  // Arrivée depuis l'onglet Offres (« Adapter mon CV ») : la page est remontée après navigation,
  // donc l'ouverture initiale se décide ici (TailorModal consomme le pending à l'ouverture).
  const [tailorOpen, setTailorOpen] = useState(
    () => typeof window !== "undefined" && Boolean(useDocStore.getState().pendingJobDesc),
  );

  const canTailor = docType === "CV" || docType === "Maître";

  // Snapshot « avant adaptation » quand une offre arrive (écriture externe, pas de setState).
  useEffect(() => {
    if (pendingJobDesc) takeSnapshot("Avant adaptation");
  }, [pendingJobDesc]);

  const onClear = async () => {
    if (!(await uiConfirm("Effacer le document courant et repartir d'un modèle vierge ?", "Effacer"))) return;
    setJson(defaultJsonFor(docType));
    toast("Document effacé.", "success");
  };

  return (
    <div className="actions">
      {canTailor ? (
        <button
          type="button"
          className="btn-nav btn-orange"
          title="Importer une offre & adapter le CV avec l'IA"
          onClick={() => { takeSnapshot("Avant adaptation"); setTailorOpen(true); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
          Adapter à une offre
        </button>
      ) : null}

      <button type="button" className="ghost" onClick={onClear}>Effacer</button>

      <span className="actions-hint">
        Ctrl+Entrée → PDF &nbsp;·&nbsp; Ctrl+Shift+S → Snapshots
      </span>

      <TailorModal open={tailorOpen} onClose={() => setTailorOpen(false)} />
    </div>
  );
}

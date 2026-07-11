"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDocStore } from "@/state/docStore";
import { defaultJsonFor } from "@/state/docStore";
import { takeSnapshot } from "@/lib/storage/snapshots";
import { uiConfirm, toast } from "@/state/uiStore";
import TailorModal from "@/components/modals/TailorModal";
import HelpModal from "@/components/modals/HelpModal";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();

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
          aria-label="Adapter à une offre"
          onClick={() => { takeSnapshot("Avant adaptation"); setTailorOpen(true); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
          <span className="btn-label mobile-hidden">Adapter à une offre</span>
          <span className="btn-label mobile-only">Adapter</span>
        </button>
      ) : null}

      <button type="button" className="ghost" aria-label="Effacer" onClick={onClear}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        <span className="btn-label">Effacer</span>
      </button>

      <button
        type="button"
        className="ghost"
        aria-label="Mes informations"
        onClick={() => router.push("/profil")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        <span className="btn-label">Mes infos</span>
      </button>

      <button
        type="button"
        className="actions-help"
        aria-label="Comment ça marche"
        onClick={() => setHelpOpen(true)}
        data-testid="help-open"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        <span className="btn-label">Comment ça marche</span>
      </button>

      <TailorModal open={tailorOpen} onClose={() => setTailorOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

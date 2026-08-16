"use client";

import { useState, useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { listSnapshots, deleteSnapshot, saveDraft, type Snapshot } from "@/lib/storage/db";
import { takeManualSnapshot } from "@/lib/storage/snapshots";
import { uiConfirm, toast } from "@/state/uiStore";
import { useEscapeClose } from "@/lib/useEscapeClose";

interface SnapshotsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SnapshotsModal({ open, onClose }: SnapshotsModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const setDocType = useDocStore((s) => s.setDocType);
  const setJson = useDocStore((s) => s.setJson);
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);
  const setCompany = useDocStore((s) => s.setCompany);
  const setRole = useDocStore((s) => s.setRole);

  useEffect(() => {
    if (open) {
      // setState passé en callback (async) : conforme à react-hooks/set-state-in-effect.
      listSnapshots().then(setSnapshots);
    }
  }, [open]);

  useEscapeClose(open, onClose);

  const handleRestore = async (snap: Snapshot) => {
    if (
      !(await uiConfirm(`Restaurer le snapshot "${snap.label}" ? Le contenu actuel sera remplacé.`, "Restaurer le snapshot"))
    ) {
      return;
    }

    // Restaurer un instantané, c'est revenir en arrière DANS le document courant,
    // pas en ouvrir un autre : son identité est conservée tant qu'on reste sur le
    // même type, pour que l'enregistrement automatique le corrige au lieu d'en
    // créer un jumeau à l'ancienne version.
    const { docType: typeCourant, documentId } = useDocStore.getState();
    const identiteConservee = snap.doc_type === typeCourant ? documentId : null;

    await saveDraft({
      id: `draft-${snap.doc_type}`,
      json: snap.json,
      templateId: null,
      documentId: identiteConservee,
      updatedAt: snap.ts,
    });

    setDocType(snap.doc_type);
    setJson(snap.json);
    useDocStore.setState({ documentId: identiteConservee });
    setCompany(snap.company);
    setRole(snap.role);
    setPreviewOverride(null);
    toast("Snapshot restauré.", "success");
    onClose();
  };

  const handleDelete = async (ts: number) => {
    if (!(await uiConfirm("Supprimer définitivement ce snapshot ?", "Supprimer"))) return;
    await deleteSnapshot(ts);
    setSnapshots(await listSnapshots());
  };

  const handleCreate = async () => {
    await takeManualSnapshot();
    setSnapshots(await listSnapshots());
    toast("Snapshot créé.", "success");
  };

  if (!open) return null;

  return (
    <div className="ui-overlay" role="presentation" onClick={onClose}>
      <div
        className="ui-dialog snapshots-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Snapshots / Brouillons"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Snapshots / Brouillons</h2>
          <button type="button" className="ui-dialog__close" onClick={onClose} aria-label="Fermer">
            &times;
          </button>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
          Créés automatiquement toutes les 5 min et avant chaque adaptation. Stockés dans votre navigateur.
        </p>
        <div>
          {snapshots.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Aucun snapshot. Les snapshots sont créés automatiquement toutes les 5 minutes.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {snapshots.map((s) => {
                const date = new Date(s.ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
                const meta = `${date} · ${s.doc_type || "CV"}${s.company ? " · " + s.company : ""}${s.role ? " · " + s.role : ""}`;
                return (
                  <li key={s.ts} className="snap-item">
                    <div className="snap-info">
                      <strong style={{ display: "block", marginBottom: "4px" }}>{s.label}</strong>
                      <span style={{ fontSize: "0.85em", opacity: 0.8 }}>{meta}</span>
                    </div>
                    <div className="snap-actions">
                      <button className="form-btn-mini" onClick={() => handleRestore(s)}>
                        Restaurer
                      </button>
                      <button className="form-btn-mini danger" onClick={() => handleDelete(s.ts)}>
                        Supprimer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="ui-dialog__actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="form-btn-add" onClick={handleCreate}>
            + Créer un snapshot maintenant
          </button>
        </div>
      </div>
    </div>
  );
}

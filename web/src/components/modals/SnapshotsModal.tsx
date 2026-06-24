"use client";

import { useState, useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { listSnapshots, deleteSnapshot, type Snapshot } from "@/lib/storage/db";
import { uiConfirm, toast } from "@/state/uiStore";

interface SnapshotsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SnapshotsModal({ open, onClose }: SnapshotsModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const setDocType = useDocStore((s) => s.setDocType);
  const setJson = useDocStore((s) => s.setJson);
  const setHtml = useDocStore((s) => s.setHtml);
  const setCss = useDocStore((s) => s.setCss);
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);

  useEffect(() => {
    if (open) {
      // setState passé en callback (async) : conforme à react-hooks/set-state-in-effect.
      listSnapshots().then(setSnapshots);
    }
  }, [open]);

  const handleRestore = async (snap: Snapshot) => {
    if (
      !(await uiConfirm(`Restaurer le snapshot "${snap.label}" ? Le contenu actuel sera remplacé.`, "Restaurer le snapshot"))
    ) {
      return;
    }

    setDocType(snap.doc_type);
    if (snap.json) {
      setJson(snap.json);
    } else {
      setHtml(snap.html);
      setCss(snap.css);
    }
    setPreviewOverride(null);
    toast("Snapshot restauré.", "success");
    onClose();
  };

  const handleDelete = async (ts: number) => {
    if (!(await uiConfirm("Supprimer définitivement ce snapshot ?", "Supprimer"))) return;
    await deleteSnapshot(ts);
    setSnapshots(await listSnapshots());
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Snapshots / Brouillons</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {snapshots.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Aucun snapshot disponible.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {snapshots.map((s) => (
                <li key={s.ts} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "var(--bg-surface)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div>
                    <strong style={{ display: "block", marginBottom: "4px" }}>{s.label}</strong>
                    <span style={{ fontSize: "0.85em", opacity: 0.8 }}>Type: {s.doc_type}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="form-btn-mini" onClick={() => handleRestore(s)}>
                      Restaurer
                    </button>
                    <button className="form-btn-mini danger" style={{ backgroundColor: "#ff4444", color: "white" }} onClick={() => handleDelete(s.ts)}>
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

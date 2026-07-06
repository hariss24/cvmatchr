"use client";

import { useEffect, useState } from "react";
import { useDocStore } from "@/state/docStore";
import { generateResumePdfBlob } from "@/lib/pdfgen/generatePdf";
import PdfPreview from "../editor/PdfPreview";
import { useEscapeClose } from "@/lib/useEscapeClose";
import type { Resume } from "@/lib/resume/schema";

interface DiffModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DiffModal({ open, onClose }: DiffModalProps) {
  const tailorBefore = useDocStore((s) => s.tailorBefore);
  const currentJson = useDocStore((s) => s.json);
  const currentTemplate = useDocStore((s) => s.templateId);
  const atsBoost = useDocStore((s) => s.atsBoost);

  const [beforeBlob, setBeforeBlob] = useState<Blob | null>(null);
  const [afterBlob, setAfterBlob] = useState<Blob | null>(null);
  
  useEffect(() => {
    if (!open || !tailorBefore) return;

    const kw = atsBoost.enabled ? atsBoost.keywords : [];

    generateResumePdfBlob(
      tailorBefore.json as Resume,
      (tailorBefore.templateId || "sobre") as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId,
      kw
    ).then(setBeforeBlob).catch(console.error);

    generateResumePdfBlob(
      currentJson as Resume,
      currentTemplate as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId,
      kw
    ).then(setAfterBlob).catch(console.error);
  }, [open, tailorBefore, currentJson, currentTemplate, atsBoost]);

  useEscapeClose(open && !!tailorBefore, onClose);

  if (!open || !tailorBefore) return null;

  return (
    <div className="ui-overlay" role="presentation" onClick={onClose}>
      <div className="ui-dialog diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Différence (Avant / Après)</h2>
          <button type="button" className="ui-dialog__close" onClick={onClose} aria-label="Fermer">&times;</button>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>Avant adaptation</h3>
            <div style={{ flex: 1, border: '1px solid var(--border)', background: 'white' }}>
              {beforeBlob ? (
                <PdfPreview blob={beforeBlob} />
              ) : (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>Génération du PDF...</div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>Après adaptation</h3>
            <div style={{ flex: 1, border: '1px solid var(--border)', background: 'white' }}>
              {afterBlob ? (
                <PdfPreview blob={afterBlob} />
              ) : (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>Génération du PDF...</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

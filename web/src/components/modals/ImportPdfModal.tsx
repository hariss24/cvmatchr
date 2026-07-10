"use client";

import { useRef, useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { pdfToImages } from "@/lib/pdf/pdfToImages";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/schema";
import { toast, uiConfirm } from "@/state/uiStore";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Import PDF → CV (champs structurés). Port de `_pdfToResumeFields` (app.js l.2133-2170).
 *
 * Le PDF est rendu en images PNG **dans le navigateur** (pdf.js), puis envoyé à
 * `/api/pdf-to-resume` qui renvoie un CV JSON déjà normalisé. Garde anti-vidage (`isEmptyResume`)
 * comme `loadData(..., rejectEmpty)`. Le CV importé n'a pas de photo → aucune base64 vers l'IA.
 *
 * CV uniquement : la route extrait le schéma CV (l'import Lettre→HTML historique reste hors périmètre).
 * Snapshot « Avant import PDF » reporté en Phase 6 (storage).
 */

export default function ImportPdfModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEscapeClose(open && !busy, onClose);

  if (!open) return null;

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (
      !(await uiConfirm(
        "L'import remplacera le CV actuellement dans l'éditeur. Continuer ?",
        "Importer un PDF",
      ))
    ) {
      // Vide l'input : re-choisir le même fichier doit redéclencher onChange.
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      setStatus("Lecture du PDF…");
      const images = await pdfToImages(file);
      if (images.length === 0) {
        throw new Error("PDF vide ou illisible.");
      }
      setStatus("Extraction des champs par l'IA…");
      const { resume: raw } = await postJson<{ resume: unknown }>("/api/pdf-to-resume", {
        images,
      });
      const resume = normalizeResume(raw);
      // Garde anti-vidage : une extraction vide ne doit jamais écraser le CV courant.
      if (isEmptyResume(resume)) {
        throw new Error("Extraction vide : aucune donnée de CV exploitable dans ce PDF.");
      }
      useDocStore.getState().setJson(resume as Resume);
      toast("CV importé dans le formulaire.", "success");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'import PDF.", "error");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Importer un PDF"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Importer un PDF</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            &times;
          </button>
        </div>
        <p className="import-hint">
          Choisis un CV au format PDF : ses pages sont analysées et les champs remplis automatiquement.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="import-file"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />


        {status ? <p className="import-status status-busy">{status}</p> : null}

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className="go"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Choisir un PDF…
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { normalizeResume, isEmptyResume, normalizeLetter, isEmptyLetter } from "@/lib/resume/normalize";
import type { Resume, Letter } from "@/lib/resume/schema";
import { toast, uiConfirm } from "@/state/uiStore";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Import texte → données structurées. Port de `btn-text-to-html` (app.js).
 *
 * - CV (et types assimilés) : le texte est envoyé à `/api/text-to-resume` qui renvoie un CV JSON
 *   normalisé → `setJson` (remplit le formulaire). Garde anti-vidage (`isEmptyResume`).
 * - Lettre : conversion texte → HTML en streaming (flux historique conservé), puis CSS d'import.
 */

export default function ImportTextModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const isLetter = useDocStore((s) => s.docType) === "Lettre";
  const docLabel = isLetter ? "ta lettre" : "ton CV";

  useEscapeClose(open && !busy, onClose);

  if (!open) return null;

  const run = async () => {
    const content = text.trim();
    if (!content) {
      toast(`Colle d'abord le contenu de ${docLabel}.`, "error");
      return;
    }
    if (
      !(await uiConfirm(
        "L'import remplacera le document actuellement dans l'éditeur. Continuer ?",
        "Importer un texte",
      ))
    )
      return;
    const { docType, setJson } = useDocStore.getState();
    setBusy(true);
    try {
      if (docType === "Lettre") {
        const { letter: raw } = await postJson<{ letter: unknown }>("/api/text-to-letter", {
          text: content,
        });
        const letter = normalizeLetter(raw);
        if (isEmptyLetter(letter)) {
          throw new Error("Extraction vide : aucune donnée exploitable dans ce texte.");
        }
        setJson(letter as Letter);
        toast("Lettre importée dans le formulaire.", "success");
      } else {
        const { resume: raw } = await postJson<{ resume: unknown }>("/api/text-to-resume", {
          text: content,
        });
        const resume = normalizeResume(raw);
        if (isEmptyResume(resume)) {
          throw new Error("Extraction vide : aucune donnée exploitable dans ce texte.");
        }
        setJson(resume as Resume);
        toast("CV importé dans le formulaire.", "success");
      }
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de la conversion.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Importer un texte"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Importer un texte</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            &times;
          </button>
        </div>
        <p className="import-hint">
          Colle le contenu brut de {docLabel} : l&apos;IA en extrait les données.
        </p>

        <textarea
          className="form-textarea"
          rows={10}
          placeholder={`Colle ici le texte de ${docLabel}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="go" onClick={run} disabled={busy}>
            {busy ? "Conversion…" : "Importer"}
          </button>
        </div>
      </div>
    </div>
  );
}

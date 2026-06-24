"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { streamSse } from "@/lib/ai/client";
import { TEMPLATES } from "@/lib/resume/templates";
import { toast } from "@/state/uiStore";

/**
 * Import texte → HTML (streaming SSE). Port de `btn-text-to-html` (app.js l.2083-2114).
 *
 * Le texte brut est converti par l'IA en HTML, affiché en direct dans l'aperçu (mode expert :
 * on écrit dans `html` au fil du flux). À la fin, on applique le CSS d'import (sobre pour un CV,
 * vide pour une Lettre — port de `_applyImportCss`). Le `doc_type` suit le type courant.
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

  if (!open) return null;

  const run = async () => {
    const content = text.trim();
    if (!content) {
      toast("Colle d'abord le contenu de ton CV.", "error");
      return;
    }
    const { docType, setHtml, setCss } = useDocStore.getState();
    setBusy(true);
    try {
      const html = await streamSse(
        "/api/text-to-html",
        { text: content, doc_type: docType },
        (partial) => setHtml(partial),
      );
      setHtml(html);
      setCss(docType === "Lettre" ? "" : TEMPLATES.sobre.css);
      toast("Texte converti en HTML avec succès.", "success");
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
        <h2 className="ui-dialog__title">Importer un texte</h2>
        <p className="import-hint">
          Colle le contenu brut de ton CV (ou ta lettre) : l&apos;IA le met en forme en HTML.
        </p>

        <textarea
          className="form-textarea"
          rows={10}
          placeholder="Colle ici le texte de ton CV…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="go" onClick={run} disabled={busy}>
            {busy ? "Conversion…" : "Convertir en HTML"}
          </button>
        </div>
      </div>
    </div>
  );
}

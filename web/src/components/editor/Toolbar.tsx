"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { TEMPLATE_IDS, type TemplateId } from "@/lib/resume/templates";
import type { DocType, Resume } from "@/lib/resume/schema";
import { toast, uiAlert } from "@/state/uiStore";
import TailorModal from "@/components/modals/TailorModal";
import ChatPanel from "@/components/modals/ChatPanel";
import AtsPanel from "@/components/modals/AtsPanel";
import PackModal from "@/components/modals/PackModal";
import ImportTextModal from "@/components/modals/ImportTextModal";

const TEMPLATE_LABELS: Record<TemplateId, string> = {
  sobre: "Sobre",
  moderne: "Moderne",
  classique: "Classique",
  minimal: "Minimal",
  graphique: "Graphique",
};

/**
 * Barre d'outils : type de document (CV / Lettre), modèle, et conversion PDF (Phase 3).
 * Composant client : lit/écrit le store.
 */
export default function Toolbar() {
  const docType = useDocStore((s) => s.docType);
  const templateId = useDocStore((s) => s.templateId);
  const setDocType = useDocStore((s) => s.setDocType);
  const setTemplate = useDocStore((s) => s.setTemplate);
  const [busy, setBusy] = useState(false);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const onConvert = async () => {
    const { html, css, json, atsBoost } = useDocStore.getState();
    const name = (json as Resume).name?.trim() || docType;
    const boostKeywords = atsBoost.enabled ? atsBoost.keywords : [];
    setBusy(true);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, css, filename: `${name} - ${docType}`, boostKeywords }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Échec de la conversion." }));
        await uiAlert(error ?? "Échec de la conversion.", "Conversion PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name} - ${docType}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("PDF téléchargé.", "success");
    } catch {
      await uiAlert("Impossible de joindre le serveur de conversion.", "Conversion PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="toolbar">
      <label className="toolbar-field">
        <span className="toolbar-field__label">Document</span>
        <select
          className="toolbar-select"
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
        >
          <option value="CV">CV</option>
          <option value="Lettre">Lettre</option>
        </select>
      </label>

      <label className="toolbar-field">
        <span className="toolbar-field__label">Modèle</span>
        <select
          className="toolbar-select"
          value={templateId}
          onChange={(e) => setTemplate(e.target.value as TemplateId)}
        >
          {TEMPLATE_IDS.map((id) => (
            <option key={id} value={id}>
              {TEMPLATE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      {docType === "CV" ? (
        <button
          className="form-btn-mini toolbar-tailor"
          type="button"
          onClick={() => setTailorOpen(true)}
        >
          Adapter à une offre
        </button>
      ) : null}

      {docType === "CV" ? (
        <button
          className="form-btn-mini toolbar-ats"
          type="button"
          onClick={() => setAtsOpen(true)}
        >
          Score ATS
        </button>
      ) : null}

      {docType === "CV" ? (
        <button
          className="form-btn-mini toolbar-pack"
          type="button"
          onClick={() => setPackOpen(true)}
        >
          Pack candidature
        </button>
      ) : null}

      <button
        className="form-btn-mini toolbar-import"
        type="button"
        onClick={() => setImportOpen(true)}
      >
        Importer un texte
      </button>

      <button
        className="form-btn-mini toolbar-chat"
        type="button"
        onClick={() => setChatOpen(true)}
      >
        Assistant IA
      </button>

      <button
        className="go toolbar-cta"
        type="button"
        onClick={onConvert}
        disabled={busy}
      >
        {busy ? "Conversion…" : "Convertir en PDF"}
      </button>

      <TailorModal open={tailorOpen} onClose={() => setTailorOpen(false)} />
      <AtsPanel open={atsOpen} onClose={() => setAtsOpen(false)} />
      <PackModal open={packOpen} onClose={() => setPackOpen(false)} />
      <ImportTextModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

"use client";

import { useDocStore } from "@/state/docStore";
import { TEMPLATE_IDS, type TemplateId } from "@/lib/resume/templates";
import type { DocType } from "@/lib/resume/schema";

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

      <button className="go toolbar-cta" type="button" disabled title="Disponible en phase 3">
        Convertir en PDF
      </button>
    </div>
  );
}

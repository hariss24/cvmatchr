"use client";

import { useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import type { DocType } from "@/lib/resume/schema";

const DOC_TYPES: DocType[] = ["CV", "Lettre", "Maître"];
const DOC_TYPE_LABELS: Record<DocType, string> = {
  CV: "CV",
  Lettre: "Lettre",
  Maître: "CV Maître",
};

/**
 * Barre meta : Type de document (contrôle segmenté à curseur, design Atelier)
 * + Entreprise + Poste + switch « date dans le nom du fichier ».
 */
export default function MetaBar() {
  const docType = useDocStore((s) => s.docType);
  const company = useDocStore((s) => s.company);
  const role = useDocStore((s) => s.role);
  const includeDate = useDocStore((s) => s.includeDate);
  const setDocType = useDocStore((s) => s.setDocType);
  const setCompany = useDocStore((s) => s.setCompany);
  const setRole = useDocStore((s) => s.setRole);
  const setIncludeDate = useDocStore((s) => s.setIncludeDate);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("pdfIncludeDate") === "true") {
      setIncludeDate(true);
    }
  }, [setIncludeDate]);

  const typeIndex = Math.max(0, DOC_TYPES.indexOf(docType));

  return (
    <div className="meta">
      <div className="field" style={{ flex: "0 0 auto" }}>
        <label id="doc_type_label">Type</label>
        <div
          className="seg"
          role="radiogroup"
          aria-labelledby="doc_type_label"
          style={{ "--seg-w": "88px", "--seg-index": typeIndex } as React.CSSProperties}
        >
          <span className="seg__knob" aria-hidden="true" />
          {DOC_TYPES.map((t, i) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={i === typeIndex}
              className={`seg__btn${i === typeIndex ? " active" : ""}`}
              onClick={() => setDocType(t)}
            >
              {DOC_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="company">Entreprise</label>
        <input
          type="text"
          id="company"
          placeholder="Acme Corp"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="role">Poste</label>
        <input
          type="text"
          id="role"
          placeholder="Software Engineer"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      <div className="field" style={{ flex: "0 0 auto" }}>
        <label htmlFor="include_date">Date dans le nom du fichier</label>
        <button
          type="button"
          id="include_date"
          role="switch"
          aria-checked={includeDate}
          className="ui-switch"
          style={{ marginTop: 6 }}
          onClick={() => setIncludeDate(!includeDate)}
        >
          <div className="ui-switch-knob" />
        </button>
      </div>
    </div>
  );
}

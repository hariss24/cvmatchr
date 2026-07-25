"use client";

import { useState } from "react";
import { upsertApplicationForDocument } from "@/lib/applications/store";
import { toast } from "@/state/uiStore";

/** Ajout manuel : pour une candidature envoyée sans passer par Cvmatchr. */
export default function AddApplicationModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!company.trim() || !role.trim()) {
      toast("Entreprise et poste sont nécessaires.", "error");
      return;
    }
    setBusy(true);
    try {
      await upsertApplicationForDocument({ company: company.trim(), role: role.trim(), source: "manual", jobUrl, jobText });
      toast("Candidature ajoutée.", "success");
      setCompany(""); setRole(""); setJobUrl(""); setJobText("");
      onCreated();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-overlay" onClick={onClose}>
      <div className="ui-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="ui-dialog__title">Ajouter une candidature</h2>
        <div className="form-field">
          <label className="form-label" htmlFor="add-company">Entreprise</label>
          <input id="add-company" className="form-input" value={company} onChange={(e) => setCompany(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-role">Poste</label>
          <input id="add-role" className="form-input" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-url">Lien de l&apos;offre (facultatif)</label>
          <input id="add-url" className="form-input" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-text">Texte de l&apos;offre (facultatif)</label>
          <textarea id="add-text" className="form-textarea" rows={4} value={jobText} onChange={(e) => setJobText(e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="app-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-nav btn-orange" onClick={() => void submit()} disabled={busy}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

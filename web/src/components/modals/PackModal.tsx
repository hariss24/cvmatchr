"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { stripBase64ForChat } from "@/lib/ai/base64";
import { mergeHtml } from "@/lib/resume/mergeHtml";
import { toast } from "@/state/uiStore";
import { saveDraft } from "@/lib/storage/db";
import JobExtractor from "./JobExtractor";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Modale « Pack candidature » : génère une lettre + un email cohérents avec le CV courant,
 * à partir d'une offre d'emploi. Port de `_openPackModal`/`btn-create-pack` (app.js l.2520-2609).
 *
 * Flux métier :
 * - CV only (la lettre est dérivée du CV courant) ;
 * - la photo base64 est strippée avant l'appel (jamais envoyée à l'IA, et inutile à la lettre) ;
 * - aperçu de la lettre + email avec copie / insertion dans l'éditeur (type « Lettre »).
 *
 * Le snapshot « Avant pack candidature » est reporté en Phase 6 (storage).
 */

type PackResult = { letter_html: string; letter_css: string; email: string };

export default function PackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [jobDesc, setJobDesc] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PackResult | null>(null);

  useEscapeClose(open && !busy, onClose);

  if (!open) return null;

  const run = async () => {
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }
    const { html, css } = useDocStore.getState();
    if (!html.trim()) {
      toast("Charge d'abord un CV dans l'éditeur.", "error");
      return;
    }
    // Photo jamais envoyée à l'IA (allègement + inutile à la lettre).
    const { html: cleanHtml } = stripBase64ForChat(html);

    setBusy(true);
    try {
      const res = await postJson<PackResult>("/api/generate-pack", {
        cv_html: cleanHtml,
        cv_css: css,
        job_desc: desc,
        company: company.trim(),
        role: role.trim(),
        // Date du jour côté client (M2) : l'IA ne doit pas inventer la date de la lettre.
        today: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      });
      setResult(res);
      toast("Pack candidature généré.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de la génération.", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyEmail = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.email);
      toast("Email copié dans le presse-papier.", "success");
    } catch {
      toast("Copie automatique impossible — sélectionne et copie manuellement.", "error");
    }
  };

  // Insère la lettre dans l'éditeur en basculant sur le type « Lettre » (mode expert HTML/CSS).
  const loadLetter = async () => {
    if (!result) return;
    const { setDocType, setHtml, setCss, setCompany, setRole } = useDocStore.getState();
    await saveDraft({
      id: "draft-Lettre",
      html: result.letter_html,
      css: result.letter_css,
      json: null,
      templateId: null,
      htmlSource: true,
      updatedAt: 0,
    });
    setDocType("Lettre");
    setHtml(result.letter_html);
    setCss(result.letter_css);
    // Reprend Entreprise/Poste saisis dans la modale (nommage PDF + historique).
    if (company.trim()) setCompany(company.trim());
    if (role.trim()) setRole(role.trim());
    toast("Lettre chargée dans l'éditeur (type « Lettre »).", "success");
    onClose();
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className={result ? "ui-dialog pack-modal pack-modal--result" : "ui-dialog pack-modal"}
        role="dialog"
        aria-modal="true"
        aria-label="Pack candidature"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ui-dialog__title">Pack candidature</h2>

        <JobExtractor onExtracted={(text) => setJobDesc(text)} disabled={busy} />

        <textarea
          className="form-textarea"
          rows={result ? 3 : 5}
          placeholder="Colle ici le texte de l'offre d'emploi, ou utilise l'extracteur ci-dessus…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          disabled={busy}
        />
        <div className="pack-meta">
          <input
            className="form-input"
            placeholder="Entreprise (optionnel)"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={busy}
          />
          <input
            className="form-input"
            placeholder="Poste visé (optionnel)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="ui-dialog__actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="go" onClick={run} disabled={busy}>
            {busy ? "Génération… (jusqu'à 2 min)" : "Générer le pack"}
          </button>
        </div>

        {result ? (
          <div className="pack-result">
            <div className="pack-col">
              <div className="pack-letter-title">Lettre de motivation</div>
              <iframe
                className="pack-letter-frame"
                title="Aperçu de la lettre"
                sandbox=""
                srcDoc={mergeHtml(result.letter_html, result.letter_css)}
              />
              <button type="button" className="go" onClick={loadLetter} disabled={busy}>
                {"Insérer dans l'éditeur (Lettre)"}
              </button>
            </div>

            <div className="pack-col">
              <div className="pack-letter-title">{"Email d'accompagnement"}</div>
              <textarea className="form-textarea pack-email" readOnly value={result.email} />
              <button type="button" className="go" onClick={copyEmail} disabled={busy}>
                {"📋 Copier l'email"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

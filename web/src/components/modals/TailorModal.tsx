"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/schema";
import type { TailorLevel } from "@/lib/ai/prompts";
import { toast } from "@/state/uiStore";

/**
 * Modale d'adaptation IA d'un CV à une offre (4 niveaux). Port de `_tailorResumeFields` (app.js).
 *
 * Flux métier :
 * - la photo (base64) est retirée avant l'appel et restaurée localement au retour (jamais à l'IA) ;
 * - réponse normalisée côté client (comme `loadData`) ; garde anti-vidage (`isEmptyResume`).
 *
 * Le CV Maître (adaptation depuis un CV de référence stocké) est reporté en Phase 6 (storage).
 */

const LEVELS: { id: TailorLevel; label: string; hint: string }[] = [
  { id: "peu", label: "Léger", hint: "Ajustements minimes" },
  { id: "adapte", label: "Adapté", hint: "Équilibré (recommandé)" },
  { id: "hyper", label: "Poussé", hint: "Optimisation forte" },
  { id: "sur-mesure", label: "Sur-mesure", hint: "Adaptation maximale" },
];

export default function TailorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [jobDesc, setJobDesc] = useState("");
  const [level, setLevel] = useState<TailorLevel>("adapte");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const run = async () => {
    const { docType, json, setJson } = useDocStore.getState();
    if (docType !== "CV") {
      toast("L'adaptation IA ne s'applique qu'aux CV.", "error");
      return;
    }
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }

    // Photo jamais envoyée (allègement des tokens) ; restaurée localement au retour.
    const { photo: originalPhoto, ...clean } = json as Resume;

    setBusy(true);
    try {
      const { resume: raw } = await postJson<{ resume: unknown }>("/api/tailor-resume", {
        resume: clean,
        job_desc: desc,
        level,
      });
      const adapted = normalizeResume(raw);
      // Garde anti-vidage : une réponse vide ne doit jamais écraser le CV courant.
      if (isEmptyResume(adapted)) {
        throw new Error("Le CV adapté reçu est vide — CV conservé.");
      }
      setJson({ ...adapted, photo: originalPhoto });
      toast("CV adapté avec succès.", "success");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog tailor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Adapter le CV à une offre"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ui-dialog__title">Adapter à une offre</h2>

        <textarea
          className="form-textarea"
          rows={6}
          placeholder="Colle ici le texte de l'offre d'emploi…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          disabled={busy}
        />

        <div className="tailor-levels" role="radiogroup" aria-label="Niveau d'adaptation">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={level === l.id}
              title={l.hint}
              className={`tab tailor-level${level === l.id ? " active" : ""}`}
              onClick={() => setLevel(l.id)}
              disabled={busy}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button type="button" className="go" onClick={run} disabled={busy}>
            {busy ? "Adaptation…" : "Adapter"}
          </button>
        </div>
      </div>
    </div>
  );
}

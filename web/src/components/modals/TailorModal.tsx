"use client";

import { useState, useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import JobExtractor from "./JobExtractor";
import AtsPanel from "./AtsPanel";
import PackModal from "./PackModal";
import DiffModal from "./DiffModal";
import { loadMasterResume } from "@/lib/storage/master";
import type { Resume } from "@/lib/resume/schema";
import type { TailorLevel } from "@/lib/ai/prompts";
import { toast } from "@/state/uiStore";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Modale d'adaptation IA d'un CV à une offre (4 niveaux). Port de `_tailorResumeFields` (app.js).
 *
 * Disposition 2 colonnes (comme l'original Flask) :
 *  - gauche : extraction d'offre + texte de l'offre ;
 *  - droite : niveau d'adaptation · case « CV Maître » · Adapter · Pack candidature · panneau ATS.
 *
 * Flux métier : la photo (base64) est retirée avant l'appel et restaurée localement ;
 * réponse normalisée + garde anti-vidage (`isEmptyResume`).
 */

const LEVELS: { id: TailorLevel; label: string; hint: string }[] = [
  { id: "peu", label: "Peu adapté", hint: "Ajustements minimes" },
  { id: "adapte", label: "Adapté", hint: "Équilibré (recommandé)" },
  { id: "hyper", label: "Hyper-adapté", hint: "Optimisation forte" },
  { id: "sur-mesure", label: "Sur-mesure 🔥", hint: "Adaptation maximale" },
];

export default function TailorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Pré-remplissage depuis l'onglet Offres : la page est remontée à la navigation, donc l'offre
  // en attente est lue à l'initialisation (évite un setState React dans un effet).
  const [jobDesc, setJobDesc] = useState(() =>
    typeof window !== "undefined" ? useDocStore.getState().pendingJobDesc ?? "" : "",
  );
  const [level, setLevel] = useState<TailorLevel>("adapte");
  const [useMaster, setUseMaster] = useState(true);
  const [busy, setBusy] = useState(false);
  // « Candidater » depuis l'onglet Offres : le Pack s'ouvre directement par-dessus.
  const [packOpen, setPackOpen] = useState(
    () => typeof window !== "undefined" && useDocStore.getState().pendingPackOpen,
  );
  const [diffOpen, setDiffOpen] = useState(false);
  const tailorBefore = useDocStore((s) => s.tailorBefore);

  // Consommer l'offre en attente une fois lue (setter zustand, pas un setState React).
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
    useDocStore.getState().setPendingPackOpen(false);
  }, []);

  // Échap ferme la modale du dessus d'abord : inactif tant que Pack ou Diff est ouverte (M4).
  useEscapeClose(open && !busy && !packOpen && !diffOpen, onClose);

  if (!open) return null;

  const run = async () => {
    const { docType, json, setJson } = useDocStore.getState();
    if (docType !== "CV" && docType !== "Maître") {
      toast("L'adaptation IA ne s'applique qu'aux CV.", "error");
      return;
    }
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }

    // Base de l'adaptation : le CV Maître si la case est cochée et qu'il existe, sinon le CV courant.
    const master = useMaster ? await loadMasterResume() : null;
    const base = (master ?? json) as Resume;

    // Photo jamais envoyée (allègement des tokens) ; restaurée localement au retour.
    const { photo: originalPhoto, ...clean } = base;

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

      const { json, templateId, setTailorBefore } = useDocStore.getState();
      setTailorBefore({ json, templateId });

      setJson({ ...adapted, photo: originalPhoto || (json as Resume).photo || "" });
      toast(
        master ? "CV adapté depuis le CV Maître." : "CV adapté avec succès.",
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog tailor-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="Adapter le CV à une offre"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-dialog__head">
          <h2 className="ui-dialog__title">Adapter à une offre d&apos;emploi</h2>
          <button type="button" className="ui-dialog__close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            &times;
          </button>
        </div>

        <div className="tailor-body-inner">
          {/* Colonne gauche : l'offre */}
          <div className="tailor-col-left">
            <div className="tailor-section-header">
              <span className="tailor-section-title">Offre d&apos;emploi</span>
            </div>
            <JobExtractor onExtracted={(text) => setJobDesc(text)} disabled={busy} />
            <textarea
              id="job-desc-input"
              className="form-textarea"
              placeholder="Colle ici le texte de l'offre d'emploi, ou utilise l'extracteur ci-dessus…"
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Colonne droite : paramètres & actions */}
          <div className="tailor-col-right">
            <div className="tailor-settings-box">
              <div className="level-selector" role="radiogroup" aria-label="Niveau d'adaptation">
                <span className="level-label">Niveau d&apos;adaptation</span>
                <div className="level-segment">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={level === l.id}
                      title={l.hint}
                      className={`level-btn${level === l.id ? " active" : ""}`}
                      onClick={() => setLevel(l.id)}
                      disabled={busy}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="tailor-check">
                <input
                  type="checkbox"
                  checked={useMaster}
                  onChange={(e) => setUseMaster(e.target.checked)}
                  disabled={busy}
                />
                <span>Utiliser le CV Maître comme base <em>(si disponible)</em></span>
              </label>
            </div>

            <div className="tailor-actions-box">
              <div className="tailor-action-group">
                <button type="button" className="tailor-btn tailor-btn-block" onClick={run} disabled={busy}>
                  {busy ? "Adaptation…" : "Adapter le CV"}
                </button>
                {tailorBefore ? (
                  <button type="button" className="form-btn-mini" onClick={() => setDiffOpen(true)} disabled={busy}>
                    Voir les modifications
                  </button>
                ) : null}
              </div>

              <div className="tailor-divider" />

              <div className="tailor-action-group">
                <button
                  type="button"
                  className="tailor-btn tailor-btn-block pack-btn-variant"
                  onClick={() => setPackOpen(true)}
                  disabled={busy}
                >
                  Créer le Pack candidature
                </button>
              </div>
            </div>

            <AtsPanel jobDesc={jobDesc} />
          </div>
        </div>

        <PackModal open={packOpen} onClose={() => setPackOpen(false)} />
        <DiffModal open={diffOpen} onClose={() => setDiffOpen(false)} />
      </div>
    </div>
  );
}

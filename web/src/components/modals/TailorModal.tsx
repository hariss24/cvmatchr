"use client";

import { useState, useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import JobExtractor from "./JobExtractor";
import AtsPanel from "./AtsPanel";
import { useRouter } from "next/navigation";
import DiffModal from "./DiffModal";
import { loadMasterResume } from "@/lib/storage/master";
import type { Resume, Letter } from "@/lib/resume/schema";
import type { TailorLevel } from "@/lib/ai/prompts";
import { toast } from "@/state/uiStore";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Modale d'adaptation IA à une offre. CV : 4 niveaux, port de `_tailorResumeFields` (app.js).
 * Lettre (docType « Lettre ») : adapte le corps de la lettre via `/api/adapt-letter`
 * (UI réduite : pas de niveaux, ni CV Maître, ni panneau ATS).
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
  { id: "sur-mesure", label: "Sur-mesure", hint: "Adaptation maximale" },
];

export default function TailorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // Pré-remplissage depuis l'onglet Offres : la page est remontée à la navigation, donc l'offre
  // en attente est lue à l'initialisation (évite un setState React dans un effet).
  const [jobDesc, setJobDesc] = useState(() =>
    typeof window !== "undefined" ? useDocStore.getState().pendingJobDesc ?? "" : "",
  );
  const [level, setLevel] = useState<TailorLevel>("adapte");
  const [useMaster, setUseMaster] = useState(true);
  const [busy, setBusy] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const tailorBefore = useDocStore((s) => s.tailorBefore);
  const isLetter = useDocStore((s) => s.docType) === "Lettre";

  // Consommer l'offre en attente une fois lue (setter zustand, pas un setState React).
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
  }, []);

  useEscapeClose(open && !busy && !diffOpen, onClose);

  if (!open) return null;

  // Préremplissage de la barre meta (nommage PDF/historique) — champs vides uniquement.
  const prefillMeta = (desc: string) => {
    const { company, role, setCompany, setRole } = useDocStore.getState();
    if (company.trim() && role.trim()) return;
    void fetchJobMeta(desc).then((meta) => {
      if (!meta) return;
      const s = useDocStore.getState();
      if (!s.company.trim() && meta.company) setCompany(meta.company);
      if (!s.role.trim() && meta.role) setRole(meta.role);
    });
  };

  // Adaptation du corps de la lettre courante à l'offre (même flux que la page Pack).
  const runLetter = async (desc: string) => {
    const { json, setJson, company, role } = useDocStore.getState();
    const letter = json as Letter;
    if (!letter.body.trim()) {
      toast("Le corps de la lettre est vide — rédige-le d'abord.", "error");
      return;
    }
    setBusy(true);
    try {
      // Le CV Maître sert de source de faits à l'IA (photo jamais envoyée).
      const master = await loadMasterResume();
      const { body } = await postJson<{ body: string }>("/api/adapt-letter", {
        letter_body: letter.body,
        job_desc: desc,
        cv_json: master ? { ...master, photo: "" } : {},
        company: company.trim(),
        role: role.trim(),
      });
      if (!body.trim()) throw new Error("Le corps adapté reçu est vide — lettre conservée.");
      setJson({ ...letter, body });
      toast("Lettre adaptée à l'offre.", "success");
      prefillMeta(desc);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    const { docType, json, setJson } = useDocStore.getState();
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }
    if (docType === "Lettre") {
      await runLetter(desc);
      return;
    }
    if (docType !== "CV" && docType !== "Maître") {
      toast("L'adaptation IA ne s'applique qu'aux CV et aux lettres.", "error");
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

      prefillMeta(desc);
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
        aria-label={isLetter ? "Adapter la lettre à une offre" : "Adapter le CV à une offre"}
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
            {!isLetter && (
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
            )}

            <div className="tailor-actions-box">
              <div className="tailor-action-group">
                <button type="button" className="tailor-btn tailor-btn-block" onClick={run} disabled={busy}>
                  {busy ? "Adaptation…" : isLetter ? "Adapter la lettre" : "Adapter le CV"}
                </button>
                {!isLetter && tailorBefore ? (
                  <button type="button" className="form-btn-mini" onClick={() => setDiffOpen(true)} disabled={busy}>
                    Voir les modifications
                  </button>
                ) : null}
              </div>

              {!isLetter && (
                <>
                  <div className="tailor-divider" />

                  <div className="tailor-action-group">
                    <button
                      type="button"
                      className="tailor-btn tailor-btn-block pack-btn-variant"
                      onClick={() => {
                        useDocStore.getState().setPendingJobDesc(jobDesc);
                        onClose();
                        router.push("/pack");
                      }}
                      disabled={busy}
                    >
                      Créer une lettre de motivation
                    </button>
                  </div>
                </>
              )}
            </div>

            {!isLetter && <AtsPanel jobDesc={jobDesc} />}
          </div>
        </div>


        <DiffModal open={diffOpen} onClose={() => setDiffOpen(false)} />
      </div>
    </div>
  );
}

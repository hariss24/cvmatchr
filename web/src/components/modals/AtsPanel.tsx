"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { analyzeAts, type AtsAnalysis } from "@/lib/ats/score";
import { toast } from "@/state/uiStore";

/**
 * Panneau Score ATS : analyse statistique locale (sans IA, instantanée) + analyse IA serveur
 * optionnelle. Port de `_renderAts` / `_runAtsAI` (static/js/app.js).
 *
 * Le « booster ATS invisible » (injection des mots-clés absents à l'export) est reporté à
 * l'étape suivante (il touche le chemin d'export PDF).
 */

const scoreClass = (s: number) => (s >= 70 ? "ats-ok" : s >= 45 ? "ats-mid" : "ats-low");

type AiResult = {
  score: number;
  matched_skills: string[];
  missing_hard_skills: string[];
  missing_nice_to_have: string[];
};

function Pills({ items, kind }: { items: string[]; kind: string }) {
  if (!items.length) return null;
  return (
    <div className="ats-pills">
      {items.map((k, i) => (
        <span key={i} className={`ats-pill ${kind}`}>
          {k}
        </span>
      ))}
    </div>
  );
}

export default function AtsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [jobDesc, setJobDesc] = useState("");
  const [local, setLocal] = useState<AtsAnalysis | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState(false);
  // Mots-clés absents de la dernière analyse, candidats au booster invisible.
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const atsBoost = useDocStore((s) => s.atsBoost);

  if (!open) return null;

  const runLocal = () => {
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }
    setAi(null);
    const result = analyzeAts(useDocStore.getState().html, desc);
    setLocal(result);
    setMissingKeywords(result.boostKeywords);
  };

  const runAi = async () => {
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson<AiResult>("/api/ats-score", {
        cv_html: useDocStore.getState().html,
        job_desc: desc,
      });
      setAi(res);
      setMissingKeywords([...res.missing_hard_skills, ...res.missing_nice_to_have]);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'analyse IA.", "error");
    } finally {
      setBusy(false);
    }
  };

  // Active/désactive l'injection invisible des mots-clés absents (port de `_toggleAtsBoost`).
  const toggleBoost = () => {
    const { setAtsBoost } = useDocStore.getState();
    const next = !atsBoost.enabled;
    setAtsBoost({ enabled: next, keywords: next ? missingKeywords : [] });
    toast(
      next
        ? "🧲 Booster actif — mots-clés injectés invisiblement dans le CV."
        : "Booster désactivé.",
      next ? "success" : "info",
    );
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog ats-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Score ATS"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ui-dialog__title">Score ATS</h2>

        <textarea
          className="form-textarea"
          rows={5}
          placeholder="Colle ici le texte de l'offre d'emploi…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          disabled={busy}
        />

        <div className="ui-dialog__actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="go" onClick={runLocal} disabled={busy}>
            Analyser
          </button>
          <button type="button" className="form-btn-mini" onClick={runAi} disabled={busy}>
            {busy ? "Analyse IA…" : "🤖 Analyser avec l'IA"}
          </button>
        </div>

        {local && !ai ? (
          <div className="ats-result">
            <div className="ats-score-row">
              <div className={`ats-score-circle ${scoreClass(local.score)}`}>{local.score}</div>
              <div className="ats-score-label">
                Score ATS estimé
                <span>
                  {local.matched.length} mots-clés présents · {local.missing.length} absents
                </span>
              </div>
            </div>
            {local.matched.length ? <div className="ats-keywords-title">Mots-clés présents</div> : null}
            <Pills items={local.matched} kind="match" />
            {local.missing.length ? <div className="ats-keywords-title">Mots-clés absents</div> : null}
            <Pills items={local.missing} kind="missing" />
            <div className="ats-keywords-title">Sections détectées</div>
            <div className="ats-sections">
              {Object.entries(local.sections).map(([name, ok]) => (
                <span key={name} className={`ats-section-badge ${ok ? "found" : "missing"}`}>
                  {ok ? "✓" : "✗"} {name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {ai ? (
          <div className="ats-result">
            <div className="ats-ai-badge">✨ Analyse IA</div>
            <div className="ats-score-row">
              <div className={`ats-score-circle ${scoreClass(ai.score)}`}>{ai.score}</div>
              <div className="ats-score-label">Adéquation CV / offre</div>
            </div>
            {ai.missing_hard_skills.length ? (
              <div className="ats-keywords-title">⚠️ Compétences clés manquantes</div>
            ) : null}
            <Pills items={ai.missing_hard_skills} kind="missing" />
            {ai.missing_nice_to_have.length ? (
              <div className="ats-keywords-title">Atouts bonus manquants</div>
            ) : null}
            <Pills items={ai.missing_nice_to_have} kind="bonus" />
            {ai.matched_skills.length ? (
              <div className="ats-keywords-title">Compétences présentes</div>
            ) : null}
            <Pills items={ai.matched_skills} kind="match" />
          </div>
        ) : null}

        {missingKeywords.length ? (
          <button
            type="button"
            className={`ats-ai-btn ats-boost-btn${atsBoost.enabled ? " active" : ""}`}
            onClick={toggleBoost}
            disabled={busy}
          >
            🧲 Booster ATS invisible{atsBoost.enabled ? " ✓" : ""}
          </button>
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

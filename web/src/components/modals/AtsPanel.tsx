"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import type { Resume } from "@/lib/resume/schema";
import { resumeToText } from "@/lib/ats/resumeText";
import {
  analyzeResumeAts,
  analyzeWithRequirements,
  type AtsReport,
  type Priority,
  type Requirement,
} from "@/lib/ats/engine";
import { toast } from "@/state/uiStore";

/**
 * Rapport ATS : score global pondéré, 4 axes, corrections prioritaires, mots-clés, sections.
 *
 * Un seul bouton : l'IA extrait les exigences de l'offre (`/api/ats-score`), le score reste
 * calculé par le moteur local (`lib/ats/engine.ts`) — reproductible. Si l'appel IA échoue
 * (clé absente, quota, réseau), on retombe sur l'analyse 100 % locale avec un toast.
 *
 * ⚠️ Le CV vient de `docStore.json`. NE JAMAIS repasser par `docStore.html` : ce champ est
 * un vestige de l'ancien pipeline HTML, toujours vide depuis la migration React PDF — c'est
 * ce qui donnait un score de 0 et listait le baratin de l'offre en « mots-clés absents ».
 */

const scoreClass = (s: number) => (s >= 70 ? "ats-ok" : s >= 45 ? "ats-mid" : "ats-low");

type AiResponse = {
  job_title: string;
  requirements: Requirement[];
  priorities: Priority[];
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

function Axes({ axes }: { axes: AtsReport["axes"] }) {
  return (
    <div className="ats-axes">
      {axes.map((a) => (
        <div key={a.key} className="ats-axis">
          <div className="ats-axis-head">
            <span className="ats-axis-label">{a.label}</span>
            <span className="ats-axis-weight">Poids {a.weight} %</span>
            <span className={`ats-axis-score ${scoreClass(a.score)}`}>{a.score}</span>
          </div>
          <div className="ats-axis-bar">
            <div className={`ats-axis-fill ${scoreClass(a.score)}`} style={{ width: `${a.score}%` }} />
          </div>
          <p className="ats-axis-hint">{a.hint}</p>
        </div>
      ))}
    </div>
  );
}

function Priorities({ items }: { items: Priority[] }) {
  if (!items.length) return null;
  return (
    <>
      <div className="ats-keywords-title">Corrections prioritaires</div>
      <ol className="ats-priorities">
        {items.map((p, i) => (
          <li key={i} className="ats-priority">
            <div className="ats-priority-head">
              <span className="ats-priority-title">{p.title}</span>
              {p.zone ? <span className="ats-priority-zone">{p.zone}</span> : null}
            </div>
            {p.problem ? <p className="ats-priority-text">{p.problem}</p> : null}
            {p.fix ? <p className="ats-priority-text">{p.fix}</p> : null}
            {p.example ? <p className="ats-priority-example">{p.example}</p> : null}
          </li>
        ))}
      </ol>
    </>
  );
}

export default function AtsPanel({ jobDesc }: { jobDesc: string }) {
  const [report, setReport] = useState<AtsReport | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [byAi, setByAi] = useState(false);
  const [busy, setBusy] = useState(false);

  const docType = useDocStore((s) => s.docType);

  const isCv = docType !== "Lettre";

  /** Le CV et l'offre, ou null si l'analyse n'a pas de sens (lettre, offre vide). */
  const inputs = (): { resume: Resume; desc: string; role: string } | null => {
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return null;
    }
    if (!isCv) {
      toast("L'analyse ATS ne s'applique qu'à un CV.", "error");
      return null;
    }
    const { json, role } = useDocStore.getState();
    return { resume: json as Resume, desc, role };
  };

  const runAi = async () => {
    const input = inputs();
    if (!input) return;
    setBusy(true);
    try {
      const res = await postJson<AiResponse>("/api/ats-score", {
        resume_text: resumeToText(input.resume),
        job_desc: input.desc,
        role: input.role,
      });
      setReport(analyzeWithRequirements(input.resume, res.requirements, input.role || res.job_title));
      setPriorities(res.priorities);
      setByAi(true);
    } catch {
      setReport(analyzeResumeAts(input.resume, input.desc, input.role));
      setPriorities([]);
      setByAi(false);
      toast("Analyse IA indisponible — score algorithmique local affiché.", "info");
    } finally {
      setBusy(false);
    }
  };



  return (
    <div className="ats-panel">
      <div className="ats-actions">
        <button type="button" className="ats-action-btn" onClick={runAi} disabled={busy}>
          {busy ? "Analyse IA…" : "Analyse ATS"}
        </button>
      </div>

      {report ? (
        <div className="ats-result">
          {byAi ? <div className="ats-ai-badge">✨ Analyse IA</div> : null}

          <div className="ats-score-row">
            <div className={`ats-score-circle ${scoreClass(report.score)}`}>{report.score}</div>
            <div className="ats-score-label">
              {report.verdict}
              <span>
                {report.matched.length} exigence{report.matched.length > 1 ? "s" : ""} couverte
                {report.matched.length > 1 ? "s" : ""} · {report.missing.length} à combler
              </span>
            </div>
          </div>

          <Axes axes={report.axes} />
          <Priorities items={priorities} />

          {report.missing.length ? (
            <div className="ats-keywords-title">Exigences à combler</div>
          ) : null}
          <Pills items={report.missing.map((k) => k.term)} kind="missing" />

          {report.matched.length ? (
            <div className="ats-keywords-title">Exigences couvertes</div>
          ) : null}
          <Pills items={report.matched.map((k) => k.term)} kind="match" />

          <div className="ats-keywords-title">Sections détectées</div>
          <div className="ats-sections">
            {Object.entries(report.sections).map(([name, ok]) => (
              <span key={name} className={`ats-section-badge ${ok ? "found" : "missing"}`}>
                {ok ? "✓" : "✗"} {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}


    </div>
  );
}

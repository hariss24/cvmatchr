"use client";

import { useState } from "react";
import type { JobEntry } from "@/lib/storage/db";
import { BoardIcon } from "./BoardIcon";

/** Date de publication relative (« il y a 4 jours ») ou null si absente/invalide. */
function relativeDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }} />
  );
}

const PIN = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>';
const CASE = '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>';
const EURO = '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>';
const TRAIN = '<rect x="4" y="3" width="16" height="13" rx="2"/><path d="M4 11h16M8 21l2-3m6 3-2-3"/>';

/**
 * Carte d'une offre retenue. Deux actions visibles seulement — « Adapter mon CV »
 * et « Voir l'offre » — le reste dans le menu « ⋯ » : cinq boutons par carte
 * rendaient la grille illisible (cf. spec §5.3).
 */
export default function JobCard({
  job, onAdapt, onApply, onTrack, onDismiss, onSeen,
}: {
  job: JobEntry;
  onAdapt: (job: JobEntry) => void;
  onApply: (job: JobEntry) => void;
  onTrack: (job: JobEntry) => void;
  onDismiss: (job: JobEntry) => void;
  onSeen: (job: JobEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const tier = job.score >= 85 ? "high" : job.score >= 70 ? "mid" : "low";
  const date = relativeDate(job.publishedAt);

  return (
    <article className={`job-card${open ? " is-open" : ""}`} data-testid="job-card">
      <div className="job-card__head">
        <div className="job-logo">
          {job.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.logoUrl} alt={job.company || "Entreprise"} />
          ) : (
            <span className="job-logo__initial" data-testid="job-logo-initial">
              {job.company.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </div>

        <div className="job-card__id">
          <h2 className="job-title">{job.title || "Sans titre"}</h2>
          <div className="job-company">
            <span className="job-company__name">{job.company || "Entreprise inconnue"}</span>
          </div>
        </div>

        <div className="job-card__aside">
          <span className={`job-score job-score--${tier}`} title="Score de pertinence">
            <span className="job-score__num">{job.score}</span>
            <span className="job-score__max">/100</span>
          </span>
          {job.seen === false ? (
            <span className="job-new" data-testid="job-new">Nouveau</span>
          ) : date ? (
            <span className="job-date">{date}</span>
          ) : null}
        </div>
      </div>

      <div className="job-facts">
        <span className="job-fact"><Icon path={PIN} />{job.location || "Lieu non précisé"}</span>
        <span className={`job-fact${job.contractLabel ? "" : " job-fact--none"}`}>
          <Icon path={CASE} />{job.contractLabel || "Type non précisé"}
        </span>
        <span className={`job-fact${job.salaryLabel ? "" : " job-fact--none"}`}>
          <Icon path={EURO} />{job.salaryLabel || "Salaire non précisé"}
        </span>
        {job.commute ? (
          <span className="job-fact job-fact--commute"><Icon path={TRAIN} />{job.commute}</span>
        ) : null}
      </div>

      {job.jobText ? (
        <>
          <p className="job-desc">{job.jobText}</p>
          <button type="button" className="job-more" onClick={() => setOpen((o) => !o)}>
            {open ? "Voir moins" : "Voir plus"}
          </button>
        </>
      ) : null}

      {menu ? (
        <div className="job-menu">
          <button type="button" className="job-menu__item" data-testid="job-apply"
            onClick={() => { setMenu(false); onApply(job); }}>
            Candidater (CV + lettre)
          </button>
          <button type="button" className="job-menu__item" data-testid="job-track"
            disabled={Boolean(job.applicationId)}
            title={job.applicationId ? "Déjà suivie dans Mes candidatures" : "Suivre cette candidature"}
            onClick={() => { setMenu(false); onTrack(job); }}>
            {job.applicationId ? "Déjà suivie" : "Suivre cette candidature"}
          </button>
          <div className="job-menu__sep" />
          <button type="button" className="job-menu__item job-menu__item--danger" data-testid="job-dismiss"
            onClick={() => { setMenu(false); onDismiss(job); }}>
            Pas intéressé
          </button>
        </div>
      ) : null}

      <div className="job-card__foot">
        <BoardIcon domain={job.boardDomain ?? ""} name={job.boardName ?? ""} />
        <button type="button" className="job-cta" data-testid="job-adapt" onClick={() => onAdapt(job)}>
          Adapter mon CV
        </button>
        <div className="job-card__foot-spacer" />
        {job.url ? (
          <a className="job-ghost" href={job.url} target="_blank" rel="noopener noreferrer"
            onClick={() => onSeen(job)}>
            Voir l&apos;offre
          </a>
        ) : null}
        <button type="button" className="job-kebab" data-testid="job-menu-toggle"
          aria-label="Plus d'actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </div>
    </article>
  );
}

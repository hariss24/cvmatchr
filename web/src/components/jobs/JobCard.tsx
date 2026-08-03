"use client";

import { useState, useEffect } from "react";
import type { JobEntry } from "@/lib/storage/db";
import { BoardIcon } from "./BoardIcon";
import { CompanyLogo } from "./CompanyLogo";

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
  job, onAdapt, onApply, onTrack, onDismiss, onSeen, onCommute, atsLink,
}: {
  job: JobEntry;
  onAdapt: (job: JobEntry) => void;
  onApply: (job: JobEntry) => void;
  onTrack: (job: JobEntry) => void;
  onDismiss: (job: JobEntry) => void;
  onSeen: (job: JobEntry) => void;
  /** Calcule le trajet à la demande (premier dépliage de l'offre). */
  onCommute?: (job: JobEntry) => Promise<string>;
  /** Board public de l'entreprise, si détecté. Absent = rien à afficher. */
  atsLink?: { ats: "greenhouse" | "lever"; slug: string };
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [commute, setCommute] = useState(job.commute);

  // Le trajet réel n'est calculé qu'au dépliage : un appel Google Maps est
  // facturé, on ne le dépense que si l'offre intéresse vraiment.
  useEffect(() => {
    if (!open || commute || !onCommute) return;
    let vivant = true;
    void onCommute(job).then((t) => { if (vivant) setCommute(t); });
    return () => { vivant = false; };
  }, [open, commute, onCommute, job]);
  // La lettre n'est plus affichée : elle sert au tri, pas à l'étiquetage. Une
  // note visible invite à discuter la note ; l'ordre de la liste dit la même
  // chose sans donner de fausse précision. Elle reste calculée et stockée — le
  // tri, et un éventuel filtre, s'appuient dessus.
  const lignes = (job.breakdown ?? []).filter((l) => l.reason !== "");
  const date = relativeDate(job.publishedAt);

  // Les offres du board de l'entreprise échappent souvent aux jobboards saturés :
  // c'est le seul intérêt de ce lien, donc il n'apparaît que s'il mène quelque part.
  const boardUrl = !atsLink
    ? ""
    : atsLink.ats === "greenhouse"
      ? `https://job-boards.greenhouse.io/${atsLink.slug}`
      : `https://jobs.lever.co/${atsLink.slug}`;

  return (
    <article className={`job-card${open ? " is-open" : ""}`} data-testid="job-card">
      <div className="job-card__head">
        <div className="job-logo">
          <CompanyLogo logoUrl={job.logoUrl ?? ""} company={job.company} />
        </div>

        <div className="job-card__id">
          <h2 className="job-title">{job.title || "Sans titre"}</h2>
          {job.company ? (
            <div className="job-company">
              <span className="job-company__name">{job.company}</span>
            </div>
          ) : null}
        </div>

        <div className="job-card__aside">
          {job.seen === false ? (
            <span className="job-new" data-testid="job-new">Nouveau</span>
          ) : date ? (
            <span className="job-date">{date}</span>
          ) : null}
        </div>
      </div>

      {/* Un fait absent ne s'annonce pas : afficher « Salaire non précisé » occupe
          une ligne pour ne rien apprendre. La puce disparaît, le reste se resserre. */}
      <div className="job-facts">
        {job.location ? (
          <span className="job-fact"><Icon path={PIN} />{job.location}</span>
        ) : null}
        {job.contractLabel ? (
          <span className="job-fact"><Icon path={CASE} />{job.contractLabel}</span>
        ) : null}
        {job.salaryLabel ? (
          <span className="job-fact"><Icon path={EURO} />{job.salaryLabel}</span>
        ) : null}
        {commute ? (
          <span className="job-fact job-fact--commute"><Icon path={TRAIN} />{commute}</span>
        ) : null}
        {boardUrl ? (
          <a className="job-fact job-fact--board" href={boardUrl} target="_blank"
            rel="noopener noreferrer" data-testid="job-ats-link">
            Offres directes chez {job.company}
          </a>
        ) : null}
      </div>

      {lignes.length > 0 ? (
        <ul className="job-why" data-testid="job-why">
          {lignes.map((l) => (
            <li key={l.key} className={l.points < 0 ? "job-why__item job-why__item--malus" : "job-why__item"}>
              <span className="job-why__label">{l.label}</span>
              <span className="job-why__reason">{l.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

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

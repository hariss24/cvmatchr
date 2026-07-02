import type { JobEntry } from "@/lib/storage/db";

/** Date de publication lisible (« Publié le 12/06/2026 ») ou null si absente/invalide. */
function publishedLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Publié le ${d.toLocaleDateString("fr-FR")}`;
}

/** Carte d'une offre retenue : infos + score + actions (« Adapter mon CV » / « Pas intéressé »). */
export default function JobCard({
  job,
  onAdapt,
  onDismiss,
  onSeen,
}: {
  job: JobEntry;
  onAdapt: (job: JobEntry) => void;
  onDismiss: (job: JobEntry) => void;
  onSeen: (job: JobEntry) => void;
}) {
  const tier = job.score >= 85 ? "high" : job.score >= 70 ? "mid" : "low";
  const published = publishedLabel(job.publishedAt);

  return (
    <div className="job-card" data-testid="job-card">
      <div className={`job-score job-score-${tier}`} title="Score de pertinence">
        <span className="job-score-num">{job.score}</span>
        <span className="job-score-max">/100</span>
      </div>

      <div className="job-main">
        <div className="job-title">
          {job.seen === false ? <span className="job-new-badge" data-testid="job-new">Nouveau</span> : null}
          {job.title || "Sans titre"}
        </div>
        <div className="job-meta">
          {job.company || "Entreprise inconnue"}
          {job.location ? ` · ${job.location}` : ""}
        </div>
        {published ? <div className="job-date">{published}</div> : null}
        {job.commute ? <div className="job-commute">🚉 {job.commute}</div> : null}
      </div>

      <div className="job-actions">
        <button type="button" className="tailor-btn" onClick={() => onAdapt(job)} data-testid="job-adapt">
          Adapter mon CV
        </button>
        {job.url ? (
          <a
            className="neu-btn-sm"
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSeen(job)}
          >
            Voir l&apos;offre
          </a>
        ) : null}
        <button type="button" className="neu-btn-sm danger" onClick={() => onDismiss(job)} data-testid="job-dismiss">
          Pas intéressé
        </button>
      </div>
    </div>
  );
}

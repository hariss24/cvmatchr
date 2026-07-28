import type { GradeThresholds } from "@/lib/jobs/grade";

type Criterion = { label: string; max: number; description: string };

/** Encart dépliable expliquant comment les offres sont notées (grille issue du profil). */
export default function ScoringInfo({
  criteria,
  thresholds,
}: {
  criteria: Criterion[];
  thresholds: GradeThresholds;
}) {
  return (
    <details className="scoring-info" data-testid="scoring-info">
      <summary className="scoring-info__summary">
        <span className="scoring-info__source">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Offres issues des sources cochées dans «&nbsp;Où chercher&nbsp;»
        </span>
        <span className="scoring-info__toggle">Comment sont-elles notées&nbsp;?</span>
      </summary>
      <div className="scoring-info__body">
        <p>
          Les offres sont classées par un algorithme local, sans IA : instantané,
          gratuit, et surtout reproductible — une même offre obtient toujours la
          même lettre. Chaque carte indique le détail qui a produit sa note.
        </p>
        <table className="scoring-info__table">
          <thead>
            <tr>
              <th>Critère</th>
              <th>Points</th>
              <th>Ce que ça mesure</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>0–{c.max}</td>
                <td>{c.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="scoring-info__threshold">
          Lettres : <strong>S</strong> à partir de {thresholds.S}, <strong>A</strong> à
          partir de {thresholds.A}, <strong>B</strong> à partir de {thresholds.B},{" "}
          <strong>C</strong> à partir de {thresholds.C}, <strong>D</strong> en dessous.
        </p>
      </div>
    </details>
  );
}

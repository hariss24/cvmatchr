type Criterion = { label: string; max: number; description: string };

/** Encart dépliable expliquant comment les offres sont notées (grille issue du profil). */
export default function ScoringInfo({
  criteria,
  minScore,
}: {
  criteria: Criterion[];
  minScore: number;
}) {
  return (
    <details className="scoring-info" data-testid="scoring-info">
      <summary className="scoring-info__summary">
        <span className="scoring-info__source">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Offres issues de France&nbsp;Travail
        </span>
        <span className="scoring-info__toggle">Comment sont-elles notées&nbsp;?</span>
      </summary>
      <div className="scoring-info__body">
        <p>
          Un pré-tri par mots-clés écarte les offres hors-sujet, puis une IA (jouant le rôle
          d&apos;un recruteur) note les autres sur 100 selon cette grille.
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
          Seuil de sélection : <strong>{minScore}/100</strong>.
        </p>
      </div>
    </details>
  );
}

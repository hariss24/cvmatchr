import type { JobsConfig } from "./JobsView";

/** Encart dépliable expliquant comment les offres sont notées (grille issue du profil). */
export default function ScoringInfo({
  criteria,
  minScore,
}: {
  criteria: JobsConfig["criteria"];
  minScore: number;
}) {
  return (
    <details className="scoring-info" data-testid="scoring-info">
      <summary className="scoring-info__summary">Comment les offres sont-elles notées ?</summary>
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

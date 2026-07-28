type Criterion = { label: string; max: number; description: string };

/** Encart dépliable expliquant comment les offres sont classées (grille issue du profil). */
export default function ScoringInfo({ criteria }: { criteria: Criterion[] }) {
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
        <span className="scoring-info__toggle">Comment sont-elles classées&nbsp;?</span>
      </summary>
      <div className="scoring-info__body">
        <p>
          Les offres sont triées de la plus pertinente à la moins pertinente par un
          algorithme local, sans IA : instantané, gratuit, et surtout reproductible —
          une même offre se place toujours au même rang. Aucune note n&apos;est
          affichée : c&apos;est l&apos;ordre de la liste qui la dit. Chaque carte
          indique le détail qui a déterminé son rang.
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
          Un critère que la source ne permet pas de mesurer sort du calcul au lieu de
          compter zéro : une annonce n&apos;est pas pénalisée pour une description que
          le site d&apos;origine a tronquée.
        </p>
      </div>
    </details>
  );
}

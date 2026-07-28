import type { ScanState } from "./JobsView";

/** Barre de progression du scan : phase courante + compteurs (classées / trouvées). */
export default function ScanProgress({ phase, found, retained }: ScanState) {
  // Le classement conserve toutes les offres : `retained` suit donc l'avancement.
  const pct = found > 0 ? Math.round((retained / found) * 100) : 0;
  return (
    <div className="scan-progress" data-testid="scan-progress" role="status" aria-live="polite">
      <div className="scan-progress-bar">
        <div className="scan-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="scan-progress-text">
        {phase}
        {found > 0 ? ` · ${retained}/${found} classées` : ""}
      </div>
    </div>
  );
}

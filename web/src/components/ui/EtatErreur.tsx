export default function EtatErreur({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="etat-erreur" role="alert">
      <p>{message}</p>
      <button type="button" className="btn-nav" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}

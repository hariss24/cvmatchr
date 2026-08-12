/** Logo + nom, pour les en-têtes des pages statiques (aide, pages légales). */
export default function BrandBadge() {
  return (
    <div className="logo-badge">
      <div className="logo-icon--atelier" aria-hidden="true">
        <svg className="logo-mark" viewBox="0 0 120 120" width="26" height="26">
          <path d="M 63 33 A 27 27 0 1 0 63 87" fill="none" stroke="#F5F1EA" strokeWidth="13" strokeLinecap="round" />
          <path d="M 58 57 L 72 73 L 101 37" fill="none" stroke="#EE6A2C" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="logo-text">
        <span className="logo-title">CVMatchr</span>
      </div>
    </div>
  );
}

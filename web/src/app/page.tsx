export default function Home() {
  return (
    <div className="wrap">
      <header className="topbar">
        <div className="logo-badge">
          <div className="logo-icon">
            <div className="logo-icon-inner">CV</div>
          </div>
          <div className="logo-text">
            <span className="logo-title">CV Forge</span>
            <span className="logo-sub">Éditeur de CV · aperçu live · PDF</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="topbar-pill">Réécriture Next.js — phase 0</span>
        </div>
      </header>

      <div className="toolbar">
        <button className="go" type="button" disabled>
          Convertir en PDF
        </button>
      </div>

      <div className="split">
        <section className="pane editor-pane">
          <div className="pane-title">
            <span>Éditeur</span>
          </div>
          <div className="pane-body">
            <div className="pane-placeholder">
              Le formulaire et l’éditeur arriveront en phase 2.
            </div>
          </div>
        </section>

        <section className="pane preview-pane">
          <div className="pane-title">
            <span>Aperçu</span>
          </div>
          <div className="pane-body">
            <div className="pane-placeholder">L’aperçu live arrivera en phase 2.</div>
          </div>
        </section>
      </div>
    </div>
  );
}

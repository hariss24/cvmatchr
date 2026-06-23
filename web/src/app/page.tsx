import PreviewPane from "@/components/editor/PreviewPane";
import EditorPane from "@/components/editor/EditorPane";

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
          <EditorPane />
        </section>

        <section className="pane preview-pane">
          <PreviewPane />
        </section>
      </div>
    </div>
  );
}

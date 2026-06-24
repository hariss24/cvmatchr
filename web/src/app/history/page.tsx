import HistoryList from "@/components/history/HistoryList";
import Link from "next/link";

export const metadata = {
  title: "Historique — CV Forge",
};

export default function HistoryPage() {
  return (
    <div className="wrap">
      <header className="topbar">
        <div className="logo-badge">
          <Link href="/" className="logo-icon" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="logo-icon-inner">CV</div>
          </Link>
          <div className="logo-text">
            <span className="logo-title">CV Forge</span>
            <span className="logo-sub">Historique des exports PDF</span>
          </div>
        </div>
        <div className="topbar-actions">
          <Link href="/" className="neu-btn-sm" style={{ textDecoration: 'none' }}>
            Retour à l'éditeur
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflow: "auto", padding: "20px" }}>
        <div className="section-card" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2>Historique</h2>
          <p style={{ opacity: 0.8, fontSize: "0.9rem", marginBottom: "20px" }}>
            Vos derniers exports PDF sont conservés ici. Vous pouvez les regénérer ou les recharger dans l'éditeur.
          </p>
          <HistoryList />
        </div>
      </div>
    </div>
  );
}

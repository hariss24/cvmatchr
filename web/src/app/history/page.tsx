import HistoryList from "@/components/history/HistoryList";
import HistoryActions from "@/components/history/HistoryActions";
import Link from "next/link";

export const metadata = {
  title: "Historique — CV Tailor",
};

export default function HistoryPage() {
  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Historique</h1>
        <div className="topbar-actions">
          <HistoryActions />
          <Link href="/" className="btn-nav">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Retour
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <HistoryList />
        </div>
      </div>
    </div>
  );
}

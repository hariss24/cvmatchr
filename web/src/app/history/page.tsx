import HistoryList from "@/components/history/HistoryList";
import HistoryActions from "@/components/history/HistoryActions";
import SegmentedNav from "@/components/layout/SegmentedNav";

export const metadata = {
  title: "Historique — CV Tailor",
};

export default function HistoryPage() {
  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Historique</h1>
        <div className="topbar-center">
          <SegmentedNav />
        </div>
        <div className="topbar-actions">
          <HistoryActions />
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

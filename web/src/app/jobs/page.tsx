import JobsView from "@/components/jobs/JobsView";
import SegmentedNav from "@/components/layout/SegmentedNav";
import { resolveProfile } from "@/lib/jobs/resolveProfile";

export const metadata = {
  title: "Offres — CVMatchr",
};

export default function JobsPage() {
  const profile = resolveProfile();
  const config = {
    minScore: profile.minScore,
    aiShortlist: profile.aiShortlist,
    prefilterKeywords: profile.prefilterKeywords,
    criteria: profile.scoringCriteria.map(({ label, max, description }) => ({ label, max, description })),
  };

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Offres</h1>
        <div className="topbar-center">
          <SegmentedNav />
        </div>
        <div className="topbar-actions" />
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <JobsView config={config} />
        </div>
      </div>
    </div>
  );
}

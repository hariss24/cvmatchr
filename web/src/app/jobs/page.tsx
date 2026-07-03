import Link from "next/link";
import JobsView from "@/components/jobs/JobsView";
import { resolveProfile } from "@/lib/jobs/resolveProfile";

export const metadata = {
  title: "Offres — CV Tailor",
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
      <header className="topbar">
        <h1 className="hist-h1">Offres</h1>
        <div className="topbar-actions">
          <Link href="/" style={{ color: "var(--link)", fontWeight: 600, fontSize: "14px" }}>
            ‹ Retour
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <JobsView config={config} />
        </div>
      </div>
    </div>
  );
}

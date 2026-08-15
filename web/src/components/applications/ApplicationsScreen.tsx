"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SegmentedNav from "@/components/layout/SegmentedNav";
import ApplicationsDashboard from "./ApplicationsDashboard";
import ApplicationsFilters, { type FilterKey } from "./ApplicationsFilters";
import ApplicationCard from "./ApplicationCard";
import ResumeShelf from "./ResumeShelf";
import AddApplicationModal from "./AddApplicationModal";
import { listApplications, runBackfillOnce } from "@/lib/applications/store";
import { daysSince, deriveStatus } from "@/lib/applications/status";
import type { Application } from "@/lib/applications/types";
import { useSettingsStore } from "@/state/settingsStore";

export default function ApplicationsScreen() {
  const [apps, setApps] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const staleDays = useSettingsStore((s) => s.staleDays);

  // Rechargement après une action de l'utilisateur : `now` est rafraîchi pour que
  // l'ancienneté affichée suive le temps réel sans recharger la page.
  const load = useCallback(async () => {
    setApps(await listApplications());
    setNow(Date.now());
  }, []);

  // Chargement initial : le rattachement rétroactif peuple le tracker depuis
  // l'historique existant, une seule fois. Les setters passent par `.then()`,
  // seule forme acceptée par react-hooks/set-state-in-effect.
  useEffect(() => {
    void runBackfillOnce().then(listApplications).then(setApps);
  }, []);

  const rows = useMemo(
    () => apps.map((app) => ({
      app,
      status: deriveStatus(app, now, staleDays),
      days: daysSince(app, now),
    })),
    [apps, now, staleDays],
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: rows.length, applied: 0, interview: 0, rejected: 0, stale: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return `${r.app.company} ${r.app.role} ${r.app.jobText}`.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Mes candidatures</h1>
        <div className="topbar-center">
          <SegmentedNav />
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn-nav btn-orange" onClick={() => setAdding(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Ajouter
          </button>
          <Link href="/" className="btn-nav">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="hist-content">
          <ApplicationsDashboard apps={apps} staleDays={staleDays} now={now} />
          <ApplicationsFilters query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} counts={counts} />

          {shown.length === 0 ? (
            <div className="hist-empty">
              {apps.length === 0
                ? "Aucune candidature pour l'instant. Exportez un CV en renseignant entreprise et poste, ou ajoutez-en une à la main."
                : "Aucune candidature ne correspond."}
            </div>
          ) : (
            <div className="card-list">
              {shown.map((r) => (
                <ApplicationCard key={r.app.id} app={r.app} status={r.status} days={r.days} onChanged={() => void load()} />
              ))}
            </div>
          )}

          <ResumeShelf />
        </div>
      </div>

      <AddApplicationModal open={adding} onClose={() => setAdding(false)} onCreated={() => void load()} />
    </div>
  );
}

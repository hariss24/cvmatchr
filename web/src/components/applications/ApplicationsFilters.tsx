"use client";

import { STATUS_LABELS } from "@/lib/applications/status";
import type { ApplicationStatus } from "@/lib/applications/types";

export type FilterKey = "all" | ApplicationStatus;

const KEYS: FilterKey[] = ["all", "applied", "interview", "rejected", "stale"];

export default function ApplicationsFilters({
  query, onQuery, filter, onFilter, counts,
}: {
  query: string;
  onQuery: (v: string) => void;
  filter: FilterKey;
  onFilter: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
}) {
  return (
    <div className="app-filters">
      <input
        type="text"
        className="hist-search"
        placeholder="Rechercher une entreprise, un poste, un mot de l'offre…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <div className="app-chips">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`app-chip ${filter === k ? "active" : ""}`}
            onClick={() => onFilter(k)}
            aria-pressed={filter === k}
          >
            {k === "all" ? "Tout" : STATUS_LABELS[k]}{" "}
            <span className="app-chip__count">{counts[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

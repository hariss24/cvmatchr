"use client";

import { summarize } from "@/lib/applications/status";
import type { Application } from "@/lib/applications/types";

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function frDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Cinq indicateurs, tous dérivés des dates : aucune saisie ne les alimente. */
export default function ApplicationsDashboard({
  apps, staleDays, now,
}: { apps: Application[]; staleDays: number; now: number }) {
  const s = summarize(apps, now, staleDays);
  const tiles: Array<{ label: string; value: string | number; hint: string; cls?: string }> = [
    { label: "Candidatures", value: s.total, hint: s.oldest ? `depuis le ${frDate(s.oldest)}` : "aucune pour l'instant" },
    { label: "En cours", value: s.applied, hint: `moins de ${staleDays} jours` },
    { label: "Entretiens", value: s.interview, hint: "réponses positives", cls: "app-tile--interview" },
    { label: "Taux de réponse", value: `${s.responseRate} %`, hint: `${s.answered} réponses sur ${s.total}` },
    { label: "Sans suite", value: s.stale, hint: `silence > ${staleDays} jours`, cls: "app-tile--stale" },
  ];
  return (
    <div className="app-dash">
      {tiles.map((t) => (
        <div key={t.label} className={`app-tile ${t.cls ?? ""}`}>
          <div className="app-tile__label">{t.label}</div>
          <div className="app-tile__value">{t.value}</div>
          <div className="app-tile__hint">{t.hint}</div>
        </div>
      ))}
    </div>
  );
}

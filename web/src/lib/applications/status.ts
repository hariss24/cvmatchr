import type { Application, ApplicationEvent, ApplicationStatus } from "./types";

const DAY = 86400000;

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "En cours",
  interview: "Entretien",
  rejected: "Refusée",
  stale: "Sans suite",
};

/** Dernier événement qui compte pour l'ancienneté (les notes n'en font pas partie). */
function lastSignificant(app: Application): ApplicationEvent | null {
  const sig = app.events.filter((e) => e.type !== "note");
  return sig.length ? sig[sig.length - 1] : null;
}

/**
 * Le statut n'est jamais stocké : un refus est terminal, un entretien décroché ne
 * vieillit jamais, et au-delà de `staleDays` de silence la candidature s'éteint
 * toute seule. C'est ce qui rend le suivi sans maintenance.
 */
export function deriveStatus(app: Application, now: number, staleDays: number): ApplicationStatus {
  if (app.events.some((e) => e.type === "rejected")) return "rejected";
  if (app.events.some((e) => e.type === "interview")) return "interview";
  const last = lastSignificant(app);
  const days = last ? Math.floor((now - last.date) / DAY) : 0;
  return days > staleDays ? "stale" : "applied";
}

/** Âge de la candidature, en jours, depuis l'envoi. */
export function daysSince(app: Application, now: number): number {
  const first = app.events.find((e) => e.type === "applied");
  return Math.floor((now - (first ? first.date : now)) / DAY);
}

/**
 * Index du dernier événement de statut saisi à la main (entretien ou refus),
 * ou -1 s'il n'y en a aucun. Sert au bouton « Annuler ». L'événement `applied`
 * n'est jamais candidat : l'ancienneté de la candidature ne peut donc pas être
 * perdue par une annulation.
 */
export function indexOfLastStatusEvent(events: ApplicationEvent[]): number {
  return events.reduce<number>(
    (last, e, i) => (e.type === "interview" || e.type === "rejected" ? i : last),
    -1,
  );
}

export interface ApplicationSummary {
  total: number;
  applied: number;
  interview: number;
  rejected: number;
  stale: number;
  answered: number;
  /** Pourcentage entier. 0 si aucune candidature. */
  responseRate: number;
  /** Horodatage de la plus ancienne candidature, `null` si aucune. */
  oldest: number | null;
}

export function summarize(apps: Application[], now: number, staleDays: number): ApplicationSummary {
  const counts = { applied: 0, interview: 0, rejected: 0, stale: 0 };
  let oldest: number | null = null;
  for (const app of apps) {
    counts[deriveStatus(app, now, staleDays)] += 1;
    const first = app.events.find((e) => e.type === "applied");
    const at = first ? first.date : app.createdAt;
    if (oldest === null || at < oldest) oldest = at;
  }
  const answered = counts.interview + counts.rejected;
  const total = apps.length;
  return {
    total,
    ...counts,
    answered,
    responseRate: total ? Math.round((answered / total) * 100) : 0,
    oldest,
  };
}

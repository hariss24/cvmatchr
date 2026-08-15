/** Provenance d'un événement. `"ai"` est réservé aux futurs connecteurs (mail, agenda). */
export type EventSource = "manual" | "system" | "ai";

export interface ApplicationEvent {
  date: number;
  type: "applied" | "interview" | "rejected" | "note";
  source: EventSource;
  detail?: string;
}

export interface Application {
  id: string;
  createdAt: number;
  company: string;
  role: string;
  /** Clé de dédoublonnage — voir `normKey()`. */
  normKey: string;
  /** Texte de l'offre conservé ("" si inconnu). */
  jobText: string;
  jobUrl: string;
  source: "generated" | "ft-job" | "manual";
  /** Journal : le statut n'est jamais stocké, il se déduit d'ici. */
  events: ApplicationEvent[];
  notes: string;
  updatedAt: number;
}

/** `stale` n'est jamais saisi : il est calculé à partir du silence. */
export type ApplicationStatus = "applied" | "interview" | "rejected" | "stale";

export const DEFAULT_STALE_DAYS = 30;

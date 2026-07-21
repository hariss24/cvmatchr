"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listJobs, saveJob, saveExplored, markJobSeen, jobExists, setJobStatus, type JobEntry } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast } from "@/state/uiStore";
import type { JobOffer } from "@/lib/jobs/francetravail";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import { getJobProfile, saveJobProfile } from "@/lib/storage/db";
import { relevance } from "@/lib/jobs/prefilter";
import ScanProgress from "./ScanProgress";
import JobCard from "./JobCard";
import ScoringInfo from "./ScoringInfo";
import { ProfileForm } from "./ProfileForm";

/**
 * Orchestrateur du scan d'offres (piloté par le navigateur, cf. spec §4) :
 * `POST /api/jobs/search` → filtre les offres déjà vues (Dexie) → note chaque offre via
 * `POST /api/jobs/score` (jusqu'au plafond) → enregistre celles au-dessus du seuil. Progression
 * en direct ; arrêt propre sur quota IA (429). Les offres retenues sont stockées localement.
 */

export type ScanState = { phase: string; found: number; scored: number; retained: number };
const ZERO: ScanState = { phase: "", found: 0, scored: 0, retained: 0 };

export type JobsConfig = {
  minScore: number;
  aiShortlist: number;
  prefilterKeywords: string[];
  criteria: { label: string; max: number; description: string }[];
};

export default function JobsView({ config }: { config: JobsConfig }) {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [profile, setProfile] = useState<JobSearchProfile>(EMPTY_PROFILE);
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanState>(ZERO);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const setPendingJobDesc = useDocStore((s) => s.setPendingJobDesc);
  const setCompany = useDocStore((s) => s.setCompany);
  const setRole = useDocStore((s) => s.setRole);
  const router = useRouter();

  useEffect(() => {
    listJobs("new").then(setJobs);
    getJobProfile().then((p) => {
      if (p) setProfile(p);
      else setShowForm(true); // Forcer la saisie initiale
    });
  }, []);

  async function reload() {
    setJobs(await listJobs("new"));
  }

  async function scan(p: JobSearchProfile = profile) {
    setScanning(true);
    setConfigMsg(null);
    setProgress({ ...ZERO, phase: "Recherche des offres…" });
    try {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "config") setConfigMsg(data.message);
        else toast(data.error || "Échec de la recherche d'offres.", "error");
        return;
      }

      const offers: JobOffer[] = data.offers ?? [];
      const minScore = config.minScore;

      // Écarter les offres déjà en base (dédoublonnage local).
      const fresh: JobOffer[] = [];
      for (const o of offers) {
        if (o.id && !(await jobExists(o.id))) fresh.push(o);
      }

      // Pré-filtre « Équilibré » : classer par pertinence mots-clés, écarter les offres
      // à recoupement nul, ne noter que les meilleures (plafond aiShortlist). Zéro appel IA.
      const toScore = fresh
        .map((o) => ({ o, r: relevance(o, config.prefilterKeywords) }))
        .filter((x) => x.r > 0)
        .sort((a, b) => b.r - a.r)
        .map((x) => x.o)
        .slice(0, config.aiShortlist);

      let scored = 0;
      let retained = 0;
      setProgress({ phase: "Notation des offres…", found: toScore.length, scored, retained });

      for (const offer of toScore) {
        const r = await fetch("/api/jobs/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offer, profile: p }),
        });
        if (r.status === 429) {
          toast("Limite IA atteinte. Réessaie plus tard.", "error");
          break;
        }
        const d = await r.json().catch(() => ({}));
        if (r.status === 400 && d.error === "config") {
          setConfigMsg(d.message);
          break;
        }
        if (!r.ok) continue; // offre ponctuellement en échec : on la saute

        scored++;
        if (typeof d.score === "number" && d.score >= minScore) {
          await saveJob({
            id: offer.id,
            createdAt: Date.now(),
            title: offer.title,
            company: offer.company,
            location: offer.location,
            commute: d.commuteText ?? "",
            score: d.score,
            url: offer.url,
            jobText: offer.jobText,
            publishedAt: offer.publishedAt,
            status: "new",
            seen: false,
          });
          retained++;
        } else if (typeof d.score === "number") {
          // Offre explorée mais sous le seuil : mémorisée pour ne jamais la re-noter.
          await saveExplored(offer.id, d.score);
        }
        setProgress({ phase: "Notation des offres…", found: toScore.length, scored, retained });
      }

      setProgress((p) => ({ ...p, phase: "Terminé" }));
      await reload();
    } catch {
      toast("Erreur réseau pendant la recherche.", "error");
    } finally {
      setScanning(false);
    }
  }

  const handleSaveProfile = async (p: JobSearchProfile) => {
    setProfile(p);
    setShowForm(false);
    await saveJobProfile(p);
    scan(p);
  };

  async function adapt(job: JobEntry) {
    await markJobSeen(job.id);
    setPendingJobDesc(job.jobText);
    // Préremplit la barre meta (nommage PDF + historique) depuis l'offre.
    if (job.company) setCompany(job.company);
    if (job.title) setRole(job.title);
    router.push("/");
  }

  /** « Candidater » : ouvre l'éditeur avec le Pack candidature prérempli (offre + meta). */
  async function apply(job: JobEntry) {
    await markJobSeen(job.id);
    setPendingJobDesc(job.jobText);
    if (job.company) setCompany(job.company);
    if (job.title) setRole(job.title);
    router.push("/pack");
  }

  async function dismiss(job: JobEntry) {
    await setJobStatus(job.id, "dismissed");
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    toast("Offre masquée.", "info", {
      label: "Annuler",
      onClick: async () => {
        await setJobStatus(job.id, "new");
        await reload();
      },
    });
  }

  async function seen(job: JobEntry) {
    await markJobSeen(job.id);
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, seen: true } : j)));
  }

  if (configMsg) {
    return (
      <div className="jobs-config" data-testid="jobs-config">
        <p>{configMsg}</p>
        <p className="jobs-config-hint">
          Renseigne <code>FT_CLIENT_ID</code>, <code>FT_CLIENT_SECRET</code> et{" "}
          <code>GOOGLE_MAPS_API_KEY</code> dans les variables d&apos;environnement.
        </p>
      </div>
    );
  }

  return (
    <div className="jobs-view">
      <ScoringInfo criteria={config.criteria} minScore={config.minScore} />

      <div style={{ marginBottom: 16 }}>
        <button className="ui-button" onClick={() => setShowForm(!showForm)} style={{ marginBottom: showForm ? 16 : 0, background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}>
          {showForm ? "Masquer les critères" : "Modifier mes critères de recherche"}
        </button>
        {showForm && (
          <ProfileForm
            initial={profile}
            onSave={handleSaveProfile}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>

      <div className="jobs-toolbar">
        <button
          type="button"
          className="tailor-btn"
          onClick={() => scan()}
          disabled={scanning || showForm}
          data-testid="jobs-scan"
        >
          {scanning ? "Recherche en cours…" : "Chercher des offres"}
        </button>
        {scanning ? <ScanProgress {...progress} /> : null}
      </div>

      {jobs.length === 0 ? (
        <div className="jobs-empty">
          {scanning ? "Recherche en cours…" : "Aucune offre pour l'instant. Lance une recherche."}
        </div>
      ) : (
        <div className="jobs-list" data-testid="jobs-list">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onAdapt={adapt} onApply={apply} onDismiss={dismiss} onSeen={seen} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listJobs, saveJob, saveExplored, markJobSeen, jobExists, setJobStatus, type JobEntry } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast } from "@/state/uiStore";
import type { JobOffer } from "@/lib/jobs/francetravail";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import { parseProfile } from "@/lib/jobs/profileSchema";
import { getJobProfile, saveJobProfile } from "@/lib/storage/db";
import { relevance } from "@/lib/jobs/prefilter";
import { upsertApplicationForDocument } from "@/lib/applications/store";
import { getApiUsage, bumpApiUsage } from "@/lib/storage/db";
import type { SourceId } from "@/lib/jobs/offer";
import { SOURCES } from "@/lib/jobs/sources";
import { summarizeProfile } from "@/lib/jobs/summary";
import ScanProgress from "./ScanProgress";
import JobCard from "./JobCard";
import ScoringInfo from "./ScoringInfo";
import { ProfileForm } from "./ProfileForm";

/**
 * Orchestrateur du scan d'offres (piloté par le navigateur, cf. spec §4) :
 * `POST /api/jobs/search` → filtre les offres déjà vues (Dexie) → note chaque offre via
 * `POST /api/jobs/score` (jusqu'au plafond) → enregistre celles au-dessus du seuil. Progression
 * en direct ; arrêt propre sur quota IA (429). Les offres retenues sont stockées localement.
 *
 * Le profil de recherche est chargé depuis Dexie, édité en direct (auto-save) et envoyé
 * dans le corps de chaque requête ; tous les seuils/critères en dérivent.
 */

export type ScanState = { phase: string; found: number; scored: number; retained: number };
const ZERO: ScanState = { phase: "", found: 0, scored: 0, retained: 0 };

export default function JobsView() {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [profile, setProfile] = useState<JobSearchProfile>(EMPTY_PROFILE);
  const [showForm, setShowForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanState>(ZERO);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<SourceId, number>>({ francetravail: 0, adzuna: 0, jsearch: 0 });
  const setPendingJobDesc = useDocStore((s) => s.setPendingJobDesc);
  const setCompany = useDocStore((s) => s.setCompany);
  const setRole = useDocStore((s) => s.setRole);
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listJobs("new").then(setJobs);
    getApiUsage().then(setUsage);
    getJobProfile().then((p) => {
      // Le profil persisté peut dater d'avant l'ajout d'un champ (ex. `sources`,
      // arrivé avec les sources multiples) : on le repasse par le schéma
      // tolérant, qui complète les manques avec les défauts neutres. Sans ça,
      // un profil existant fait planter le formulaire sur un champ absent.
      if (p) setProfile(parseProfile(p));
      else setShowForm(true); // Profil vide → ouvrir la saisie initiale.
    });
  }, []);

  /** Édition du profil avec sauvegarde automatique (debounce 400 ms). */
  function updateProfile(p: JobSearchProfile) {
    setProfile(p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveJobProfile(p); }, 400);
  }

  // Un lieu n'est pas requis : sans lieu, la recherche France Travail est nationale
  // (le backend omet simplement le filtre géo). Cf. audit B6.
  const canScan = profile.keywords.length >= 1;

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

      // Compteur de quota : local et indicatif, il mesure ce que CE navigateur
      // a consommé, pas ce que le fournisseur a facturé.
      if (data.calls) {
        await bumpApiUsage(data.calls);
        setUsage(await getApiUsage());
      }

      // Une source en panne ne fait pas échouer la recherche : on le dit sans bloquer.
      const failed: SourceId[] = data.failed ?? [];
      if (failed.length > 0) {
        const names = failed.map((s: SourceId) => SOURCES.find((x) => x.id === s)?.label ?? s).join(", ");
        toast(`Source(s) indisponible(s) : ${names}. Les autres résultats sont affichés.`, "error");
      }

      const minScore = p.minScore;

      // Écarter les offres déjà en base (dédoublonnage local).
      const fresh: JobOffer[] = [];
      for (const o of offers) {
        if (o.id && !(await jobExists(o.id))) fresh.push(o);
      }

      // Pré-filtre « Équilibré » : classer par pertinence mots-clés, écarter les offres
      // à recoupement nul, ne noter que les meilleures (plafond aiShortlist). Zéro appel IA.
      // À défaut de compétences renseignées, on retombe sur les intitulés de poste.
      const prefilter = p.prefilterKeywords.length > 0 ? p.prefilterKeywords : p.keywords;
      const toScore = fresh
        .map((o) => ({ o, r: relevance(o, prefilter) }))
        .filter((x) => x.r > 0)
        .sort((a, b) => b.r - a.r)
        .map((x) => x.o)
        .slice(0, p.aiShortlist);

      // Ne pas laisser un « 0 offre » muet : le pré-tri a pu tout écarter (cf. audit B7).
      if (fresh.length > 0 && toScore.length === 0) {
        toast(
          `${fresh.length} offre(s) trouvée(s), mais aucune n'a passé le pré-tri par mots-clés. Élargis tes postes ou renseigne des compétences.`,
          "info",
        );
      }

      let scored = 0;
      let retained = 0;
      setProgress({ phase: "Notation des offres…", found: toScore.length, scored, retained });

      // Notation en parallèle via un pool borné (cf. audit B8) : bien plus rapide que
      // le séquentiel. On stoppe net l'alimentation du pool sur quota IA (429) ou
      // erreur de config ; les requêtes déjà en vol se terminent proprement.
      const CONCURRENCY = 4;
      let next = 0;
      let stopped = false;

      const worker = async () => {
        while (!stopped) {
          const i = next++;
          if (i >= toScore.length) return;
          const offer = toScore[i];
          const r = await fetch("/api/jobs/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offer, profile: p }),
          });
          if (r.status === 429) {
            if (!stopped) toast("Limite IA atteinte. Réessaie plus tard.", "error");
            stopped = true;
            return;
          }
          const d = await r.json().catch(() => ({}));
          if (r.status === 400 && d.error === "config") {
            stopped = true;
            setConfigMsg(d.message);
            return;
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
              source: offer.source,
              logoUrl: offer.logoUrl,
              boardDomain: offer.boardDomain,
              boardName: offer.boardName,
              contractLabel: offer.contractLabel,
              salaryLabel: offer.salaryLabel,
            });
            retained++;
          } else if (typeof d.score === "number") {
            // Offre explorée mais sous le seuil : mémorisée pour ne jamais la re-noter.
            await saveExplored(offer.id, d.score);
          }
          setProgress({ phase: "Notation des offres…", found: toScore.length, scored, retained });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, toScore.length) }, () => worker()),
      );

      setProgress((p) => ({ ...p, phase: "Terminé" }));
      await reload();
    } catch {
      toast("Erreur réseau pendant la recherche.", "error");
    } finally {
      setScanning(false);
    }
  }

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

  /** « Suivre » : crée la candidature et conserve le texte de l'offre pour plus tard. */
  async function track(job: JobEntry) {
    const applicationId = await upsertApplicationForDocument({
      company: job.company,
      role: job.title,
      source: "ft-job",
      jobText: job.jobText,
      jobUrl: job.url,
    });
    if (!applicationId) {
      toast("Cette offre n'a ni entreprise ni intitulé exploitable.", "error");
      return;
    }
    await saveJob({ ...job, applicationId });
    toast("Ajoutée à « Mes candidatures ».", "success");
    await reload();
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
          Renseigne les variables d&apos;environnement des sources que tu as cochées dans
          « Mes critères de recherche ».
        </p>
      </div>
    );
  }

  return (
    <div className="jobs-view">
      <ScoringInfo
        criteria={profile.scoringCriteria.map(({ label, max, description }) => ({ label, max, description }))}
        minScore={profile.minScore}
      />

      <div className="jobs-form-bar">
        <button
          type="button"
          className="ghost jobs-form-toggle"
          onClick={() => setShowForm((s) => !s)}
          aria-expanded={showForm}
        >
          {showForm ? "Masquer les critères" : "Mes critères"}
        </button>
        {/* Le résumé rend le panneau inutile en usage courant : on voit ses
            réglages sans avoir à les ouvrir (cf. spec §5.1). */}
        <div className="jobs-summary">
          {summarizeProfile(profile).map((part, i) => (
            <span key={`${part}-${i}`}>
              {i > 0 && <span className="jobs-summary__dot">•</span>}
              {part}
            </span>
          ))}
        </div>
      </div>

      {showForm && <ProfileForm profile={profile} onChange={updateProfile} usage={usage} />}

      <div className="jobs-toolbar">
        <button
          type="button"
          className="tailor-btn"
          onClick={() => scan()}
          disabled={scanning || !canScan}
          data-testid="jobs-scan"
        >
          {scanning ? "Recherche en cours…" : "Chercher des offres"}
        </button>
        {!scanning && !canScan && (
          <span className="jobs-hint">Renseigne au moins un poste pour lancer une recherche.</span>
        )}
        {scanning ? <ScanProgress {...progress} /> : null}
      </div>

      {jobs.length === 0 ? (
        <div className="jobs-empty">
          {scanning ? "Recherche en cours…" : "Aucune offre pour l'instant. Renseigne tes critères puis lance une recherche."}
        </div>
      ) : (
        <div className="jobs-list" data-testid="jobs-list">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onAdapt={adapt} onApply={apply} onTrack={track} onDismiss={dismiss} onSeen={seen} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listJobs, saveJob, markJobSeen, jobExists, setJobStatus, type JobEntry } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast } from "@/state/uiStore";
import type { JobOffer } from "@/lib/jobs/francetravail";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import { parseProfile } from "@/lib/jobs/profileSchema";
import { getJobProfile, saveJobProfile } from "@/lib/storage/db";
import { rankOffer, buildRankContext, shouldPersist } from "@/lib/jobs/rank";
import { geocodeHome } from "@/lib/jobs/homeCoords";
import { upsertApplicationForDocument } from "@/lib/applications/store";
import { getApiUsage, bumpApiUsage } from "@/lib/storage/db";
import type { SourceId } from "@/lib/jobs/offer";
import { SOURCES } from "@/lib/jobs/sources";
import { FilterBar } from "./FilterBar";
import ScanProgress from "./ScanProgress";
import JobCard from "./JobCard";
import ScoringInfo from "./ScoringInfo";

/**
 * Orchestrateur du scan d'offres : `POST /api/jobs/search` → écarte les offres
 * déjà connues (Dexie) → **classe toutes les autres en local** → enregistre.
 *
 * Plus aucun appel réseau après la recherche : le classement est instantané et
 * gratuit (spec §2). C'est ce qui permet de lever les deux limites qui
 * n'existaient que pour contenir le coût de l'IA — le plafond d'offres notées et
 * le rejet définitif des offres sous le seuil.
 *
 * Le profil de recherche est chargé depuis Dexie, édité en direct (auto-save) et
 * envoyé dans le corps de la requête de recherche.
 */

export type ScanState = { phase: string; found: number; retained: number };
const ZERO: ScanState = { phase: "", found: 0, retained: 0 };

export default function JobsView() {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [profile, setProfile] = useState<JobSearchProfile>(EMPTY_PROFILE);
  const [profileLoaded, setProfileLoaded] = useState(false);
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
      setProfileLoaded(true);
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

      // Écarter les offres déjà en base (dédoublonnage local).
      const fresh: JobOffer[] = [];
      for (const o of offers) {
        if (o.id && !(await jobExists(o.id))) fresh.push(o);
      }

      setProgress({ phase: "Classement des offres…", found: fresh.length, retained: 0 });

      // Une seule requête de géocodage pour tout le scan, et seulement si une
      // adresse est renseignée. Sans domicile, le critère de distance reste neutre.
      const home = await geocodeHome(p.homeAddress);
      const ctx = buildRankContext(p, home);
      const maintenant = Date.now();

      let retained = 0;
      for (const offer of fresh) {
        const result = rankOffer(offer, p, ctx, maintenant);
        if (!shouldPersist(result, p)) continue;
        await saveJob({
          id: offer.id,
          createdAt: maintenant,
          title: offer.title,
          company: offer.company,
          location: offer.location,
          commute: "", // calculé à la demande à l'ouverture de l'offre
          score: result.score,
          grade: result.grade,
          breakdown: result.breakdown,
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
      }

      setProgress({ phase: "Terminé", found: fresh.length, retained });
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
          «&nbsp;Où chercher&nbsp;».
        </p>
      </div>
    );
  }

  return (
    <div className="jobs-view">
      <ScoringInfo
        criteria={[
          { label: "Compétences & missions", max: 45, description: "Ce que la description dit vraiment des missions et des compétences attendues." },
          { label: "Métier", max: 20, description: "Code métier officiel de l'offre et intitulé du poste." },
          { label: "Distance", max: 15, description: "Distance à vol d'oiseau depuis ton adresse." },
          { label: "Contrat & salaire", max: 10, description: "Type de contrat voulu et salaire annoncé." },
          { label: "Expérience", max: 10, description: "Expérience exigée face à ton niveau." },
          { label: "Malus", max: 0, description: "Métier hors-sujet (−20) et signaux négatifs (−15)." },
        ]}
        thresholds={profile.gradeThresholds}
      />

      {/* La barre n'est montée qu'une fois le profil lu : `LocationInput` fige
          le libellé du lieu dans un état local à son montage. Monté avant, il
          capturait le profil vide et le lieu enregistré restait invisible alors
          qu'il continuait de contraindre la recherche. */}
      {profileLoaded && (
        <FilterBar
          profile={profile}
          onChange={updateProfile}
          usage={usage}
          resultCount={jobs.length}
          canScan={canScan}
          scanning={scanning}
          onScan={() => scan()}
        />
      )}

      <div className="jobs-toolbar">
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

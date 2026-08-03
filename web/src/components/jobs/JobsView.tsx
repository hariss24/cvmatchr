"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listJobs, saveJob, markJobSeen, jobExists, jobKeys, setJobStatus, type JobEntry } from "@/lib/storage/db";
import { normKey } from "@/lib/applications/normKey";
import { useDocStore } from "@/state/docStore";
import { toast } from "@/state/uiStore";
import type { JobOffer } from "@/lib/jobs/francetravail";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import { getJobProfile, saveJobProfile, getCachedCommute, setCachedCommute, atsKey, getAtsEntry, saveAtsEntry } from "@/lib/storage/db";
import { rankOffer, buildRankContext, shouldPersist } from "@/lib/jobs/rank";
import type { AtsProvider } from "@/lib/jobs/ats";
import { geocodeHome, commuteCacheKey } from "@/lib/jobs/homeCoords";
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
  const [atsParEntreprise, setAtsParEntreprise] = useState<Record<string, { ats: AtsProvider; slug: string }>>({});
  const setPendingJobDesc = useDocStore((s) => s.setPendingJobDesc);
  const setCompany = useDocStore((s) => s.setCompany);
  const setRole = useDocStore((s) => s.setRole);
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Logos déjà résolus pour cette page ; `""` marque une entreprise sans logo trouvé. */
  const logosConnus = useRef(new Map<string, string>());

  useEffect(() => {
    void reload();
    getApiUsage().then(setUsage);
    getJobProfile().then(async (p) => {
      // Le profil persisté peut dater d'avant l'ajout d'un champ (ex. `sources`,
      // arrivé avec les sources multiples) : on le repasse par le schéma
      // tolérant, qui complète les manques avec les défauts neutres. Sans ça,
      // un profil existant fait planter le formulaire sur un champ absent.
      // parseProfile (zod, ~288 Ko) est chargé à la demande ici plutôt qu'en
      // import statique, pour ne pas alourdir le bundle initial de /jobs.
      if (p) {
        const { parseProfile } = await import("@/lib/jobs/profileSchema");
        setProfile(parseProfile(p));
      }
      setProfileLoaded(true);
    });
    // Au montage seulement. `reload` est redéfinie à chaque rendu ; la mettre en
    // dépendance relancerait la liste — et la résolution des logos — sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const liste = await listJobs("new");
    setJobs(liste);
    void completerLogos(liste);
    void completerAts(liste);
  }

  /**
   * Va chercher les logos manquants une fois les offres à l'écran.
   *
   * Résoudre un logo demande de visiter des pages d'accueil — ~9 s pour une
   * cinquantaine d'entreprises inconnues. Tant que c'était fait pendant la
   * recherche, la liste attendait cet ornement pour s'afficher.
   *
   * Le déport répare au passage un angle mort : le scan écarte les offres déjà
   * en base, donc celles enregistrées avant l'arrivée des logos n'en auraient
   * jamais reçu. Ici on part de ce qui est affiché, sans se soucier de la date
   * d'entrée — un simple retour sur la page suffit à les rattraper.
   */
  async function completerLogos(liste: JobEntry[]) {
    const sansLogo = [...new Set(liste.filter((j) => !j.logoUrl && j.company.trim()).map((j) => j.company))];
    const inconnues = sansLogo.filter((c) => !logosConnus.current.has(c));

    if (inconnues.length > 0) {
      // Le résultat est mémorisé, échecs compris : sans ça, une entreprise
      // introuvable serait redemandée à chaque rechargement de la liste.
      inconnues.forEach((c) => logosConnus.current.set(c, ""));
      try {
        const res = await fetch("/api/jobs/logos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: inconnues }),
        });
        if (res.ok) {
          const { logos } = (await res.json()) as { logos?: Record<string, string> };
          for (const [nom, url] of Object.entries(logos ?? {})) logosConnus.current.set(nom, url);
        }
      } catch {
        // Un logo manquant ne doit jamais remonter comme une panne.
      }
    }

    // Appliqué depuis la mémoire, et pas seulement depuis la réponse : un scan
    // qui ramène une entreprise déjà résolue doit en profiter sans redemander.
    const url = (j: JobEntry) => (j.logoUrl ? "" : logosConnus.current.get(j.company) || "");
    const aPatcher = liste.filter((j) => url(j));
    if (aPatcher.length === 0) return;

    await Promise.all(aPatcher.map((j) => saveJob({ ...j, logoUrl: url(j) })));
    setJobs((actuels) => actuels.map((j) => (url(j) ? { ...j, logoUrl: url(j) } : j)));
  }

  /**
   * Détecte le board public des entreprises affichées, une seule fois chacune.
   *
   * Même déroulé que `completerLogos` : ce qui est déjà en base n'est jamais
   * redemandé, échecs compris — sans ça une entreprise sans ATS serait
   * réinterrogée à chaque affichage de la liste.
   */
  async function completerAts(liste: JobEntry[]) {
    const entreprises = [...new Set(liste.map((j) => j.company).filter((c) => c.trim()))];

    const connues: Record<string, { ats: AtsProvider; slug: string }> = {};
    const inconnues: string[] = [];
    for (const nom of entreprises) {
      const entree = await getAtsEntry(atsKey(nom));
      if (!entree) inconnues.push(nom);
      else if (entree.ats !== "none") connues[nom] = { ats: entree.ats, slug: entree.slug };
    }

    if (inconnues.length > 0) {
      try {
        const res = await fetch("/api/jobs/ats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companies: inconnues }),
        });
        if (res.ok) {
          const { ats } = (await res.json()) as {
            ats?: Record<string, { ats: AtsProvider; slug: string }>;
          };
          for (const nom of inconnues) {
            const trouve = ats?.[nom];
            await saveAtsEntry({
              companyKey: atsKey(nom),
              ats: trouve?.ats ?? "none",
              slug: trouve?.slug ?? "",
              resolvedAt: Date.now(),
            });
            if (trouve) connues[nom] = trouve;
          }
        }
      } catch {
        // Un board non détecté ne doit jamais remonter comme une panne.
      }
    }

    setAtsParEntreprise((actuels) => ({ ...actuels, ...connues }));
  }

  /**
   * Temps de trajet d'une offre, calculé au premier affichage puis mémorisé.
   * Le cache est la raison pour laquelle on peut se permettre l'appel : sans
   * lui, ce serait 354 appels facturés par scan (spec §2.7).
   */
  async function loadCommute(job: JobEntry): Promise<string> {
    const dest = job.location;
    if (!dest) return "";
    const key = commuteCacheKey(profile.homeAddress, dest, profile.commuteModes);
    const cached = await getCachedCommute(key);
    if (cached !== null) return cached;
    try {
      const res = await fetch("/api/jobs/commute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: dest, profile }),
      });
      if (!res.ok) return "";
      const { commuteText } = (await res.json()) as { commuteText?: string };
      const text = commuteText ?? "";
      if (text) await setCachedCommute(key, text);
      return text;
    } catch {
      return "";
    }
  }

  /**
   * Interroge un sous-ensemble de sources, puis classe et enregistre ce qu'il en
   * revient. Rendu à part du reste du scan pour que chaque groupe s'affiche dès
   * qu'il répond, sans attendre les autres.
   *
   * `vues` porte les clés `normKey` déjà retenues : le serveur ne dédoublonne
   * qu'à l'intérieur d'un même appel, donc c'est ici que se joue la fusion entre
   * une offre France Travail et sa republication sur JSearch.
   */
  async function scanGroupe(
    p: JobSearchProfile,
    sources: JobSearchProfile["sources"],
    ctx: Awaited<ReturnType<typeof buildRankContext>>,
    vues: Set<string>,
  ): Promise<number> {
    const res = await fetch("/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { ...p, sources } }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error === "config") setConfigMsg(data.message);
      else toast(data.error || "Échec de la recherche d'offres.", "error");
      return 0;
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

    const maintenant = Date.now();
    let retained = 0;

    for (const offer of offers) {
      if (!offer.id || (await jobExists(offer.id))) continue; // déjà en base, par id
      const cle = normKey(offer.company, offer.title);
      if (cle && vues.has(cle)) continue; // même offre, autre source
      if (cle) vues.add(cle);

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

    await reload();
    return retained;
  }

  async function scan(p: JobSearchProfile = profile) {
    setScanning(true);
    setConfigMsg(null);
    setProgress({ ...ZERO, phase: "Recherche des offres…" });
    try {
      // Les sources ne répondent pas à la même vitesse : France Travail et Adzuna
      // en ~0,5 s, JSearch en ~16 s (leur API met ~5 s par mot-clé). Les attendre
      // ensemble faisait patienter devant un écran vide pour des offres déjà
      // disponibles. On les interroge donc en deux groupes, affichés séparément.
      const groupes = [
        { francetravail: p.sources.francetravail, adzuna: p.sources.adzuna, jsearch: false },
        { francetravail: false, adzuna: false, jsearch: p.sources.jsearch },
      ].filter((s) => s.francetravail || s.adzuna || s.jsearch);

      if (groupes.length === 0) {
        setConfigMsg("Aucune source sélectionnée. Coche au moins une source dans « Où chercher ».");
        return;
      }

      // Une seule requête de géocodage pour tout le scan, et seulement si une
      // adresse est renseignée. Sans domicile, le critère de distance reste neutre.
      const home = await geocodeHome(p.homeAddress);
      const ctx = await buildRankContext(p, home);
      const vues = await jobKeys();

      let retenues = 0;
      await Promise.all(
        groupes.map((sources) =>
          scanGroupe(p, sources, ctx, vues).then((n) => {
            retenues += n;
            setProgress({ phase: "Classement des offres…", found: retenues, retained: retenues });
          }),
        ),
      );

      setProgress({ phase: "Terminé", found: retenues, retained: retenues });
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
            <JobCard key={job.id} job={job} onAdapt={adapt} onApply={apply} onTrack={track} onDismiss={dismiss} onSeen={seen} onCommute={loadCommute} atsLink={atsParEntreprise[job.company]} />
          ))}
        </div>
      )}
    </div>
  );
}

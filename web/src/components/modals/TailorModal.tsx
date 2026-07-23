"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import { normalizeResume, isEmptyResume } from "@/lib/resume/normalize";
import JobExtractor from "./JobExtractor";
import AtsPanel from "./AtsPanel";
import { useRouter } from "next/navigation";
import DiffModal from "./DiffModal";
import { loadMasterResume } from "@/lib/storage/master";
import { renderTemplate } from "@/lib/templates/render";
import type { Resume, Letter } from "@/lib/resume/schema";
import type { TailorLevel } from "@/lib/ai/prompts";
import { toast } from "@/state/uiStore";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Modale d'adaptation IA à une offre. CV : 3 niveaux, port de `_tailorResumeFields` (app.js).
 * Lettre (docType « Lettre ») : adapte le corps de la lettre via `/api/adapt-letter`
 * (UI réduite : pas de niveaux, ni CV Maître, ni panneau ATS).
 *
 * Disposition : CV en modale 2 colonnes (comme l'original Flask) —
 *  gauche : extraction d'offre + texte de l'offre ; droite : niveau d'adaptation ·
 *  case « CV Maître » · Adapter · Pack candidature · panneau ATS.
 * Lettre en drawer gauche (.ui-drawer--left --md) : l'aperçu PDF reste visible à droite.
 *
 * Flux métier : la photo (base64) est retirée avant l'appel et restaurée localement ;
 * réponse normalisée + garde anti-vidage (`isEmptyResume`).
 */

const LEVELS: { id: TailorLevel; label: string; hint: string }[] = [
  { id: "peu", label: "Peu adapté", hint: "Modifie uniquement le titre et l'accroche. Le reste du CV est conservé tel quel." },
  { id: "adapte", label: "Adapté", hint: "Ajuste l'accroche, réordonne les compétences et reformule les expériences pour coller à l'offre." },
  { id: "hyper", label: "Hyper-adapté", hint: "Réécrit entièrement l'accroche, les compétences et les expériences sans inventer de nouveaux faits." },
];

export default function TailorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // Pré-remplissage depuis l'onglet Offres : la page est remontée à la navigation, donc l'offre
  // en attente est lue à l'initialisation (évite un setState React dans un effet).
  const [jobDesc, setJobDesc] = useState(() =>
    typeof window !== "undefined" ? useDocStore.getState().pendingJobDesc ?? "" : "",
  );
  const [level, setLevel] = useState<TailorLevel>("adapte");
  const [useMaster, setUseMaster] = useState(true);
  const [busy, setBusy] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const tailorBefore = useDocStore((s) => s.tailorBefore);
  const isLetter = useDocStore((s) => s.docType) === "Lettre";

  // Consommer l'offre en attente une fois lue (setter zustand, pas un setState React).
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
  }, []);

  // ---- Bottom sheet à ressort (design « Refonte Atelier ») ----
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  // Physique hors React : position y (px depuis la position ouverte), vitesse, drag.
  const phys = useRef({
    y: 100000, v: 0, raf: 0,
    dragging: false, startY: 0, startSheet: 0,
    hist: [] as { t: number; y: number }[],
  });

  const sheetHeight = useCallback(() => {
    const el = sheetRef.current;
    return el ? el.offsetHeight + 30 : Math.min(640, window.innerHeight * 0.86);
  }, []);

  const apply = useCallback(() => {
    const p = phys.current;
    const el = sheetRef.current;
    if (!el) return;
    const H = sheetHeight();
    const y = Math.min(p.y, H + 10);
    el.style.transform = `translate(-50%, ${y}px)`;
    const scrim = scrimRef.current;
    if (scrim) {
      const prog = Math.max(0, Math.min(1, 1 - y / H));
      scrim.style.opacity = String(prog);
      scrim.style.pointerEvents = prog > 0.05 ? "auto" : "none";
    }
  }, [sheetHeight]);

  // Ressort à 2 paramètres (damping ratio + response) — cf. Designing Fluid Interfaces.
  const spring = useCallback((target: number, v0: number, zeta: number, resp: number, done?: () => void) => {
    const p = phys.current;
    cancelAnimationFrame(p.raf);
    const k = Math.pow((2 * Math.PI) / resp, 2);
    const c = 2 * zeta * Math.sqrt(k);
    p.v = v0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const a = -k * (p.y - target) - c * p.v;
      p.v += a * dt;
      p.y += p.v * dt;
      apply();
      if (Math.abs(p.y - target) < 0.5 && Math.abs(p.v) < 20) {
        p.y = target; p.v = 0; apply();
        done?.();
        return;
      }
      p.raf = requestAnimationFrame(step);
    };
    p.raf = requestAnimationFrame(step);
  }, [apply]);

  const reducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fermeture animée : la sheet glisse hors écran, puis on démonte.
  const requestClose = useCallback(() => {
    if (busy) return;
    const H = sheetHeight();
    if (reducedMotion() || (typeof navigator !== "undefined" && navigator.webdriver)) { onClose(); return; }
    
    // Fallback de sécurité (tests E2E ou rAF throttlé)
    const fallbackId = setTimeout(onClose, 600);
    spring(H, phys.current.v, 1, 0.34, () => {
      clearTimeout(fallbackId);
      onClose();
    });
  }, [busy, onClose, sheetHeight, spring]);

  // Ouverture : la sheet monte depuis le bas avec un léger rebond.
  useEffect(() => {
    if (!open) return;
    const p = phys.current;
    const H = sheetHeight();
    p.y = H;
    apply();
    if (reducedMotion() || (typeof navigator !== "undefined" && navigator.webdriver)) { p.y = 0; apply(); return; }
    spring(0, 0, 0.8, 0.42);
    return () => cancelAnimationFrame(p.raf);
  }, [open, apply, spring, sheetHeight]);

  // Amortissement caoutchouc au-delà de la position ouverte.
  const rubber = (o: number) => {
    const d = sheetHeight(), c = 0.55;
    return (o * d * c) / (d + c * o);
  };

  const onGrabDown = (e: React.PointerEvent) => {
    const p = phys.current;
    p.dragging = true;
    cancelAnimationFrame(p.raf);
    e.currentTarget.setPointerCapture(e.pointerId);
    p.startY = e.clientY;
    p.startSheet = p.y;
    p.hist = [{ t: e.timeStamp, y: p.y }];
  };
  const onGrabMove = (e: React.PointerEvent) => {
    const p = phys.current;
    if (!p.dragging) return;
    let ny = p.startSheet + (e.clientY - p.startY);
    if (ny < 0) ny = -rubber(-ny);
    p.y = ny;
    apply();
    p.hist.push({ t: e.timeStamp, y: ny });
    if (p.hist.length > 6) p.hist.shift();
  };
  const onGrabUp = () => {
    const p = phys.current;
    if (!p.dragging) return;
    p.dragging = false;
    let v = 0;
    if (p.hist.length > 1) {
      const a = p.hist[0], b = p.hist[p.hist.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.001) v = (b.y - a.y) / dt;
    }
    const H = sheetHeight();
    // Projection de momentum : où finirait la sheet si on la lâchait ?
    const proj = p.y + ((v / 1000) * 0.998) / (1 - 0.998);
    if (!busy && (proj > H * 0.42 || v > 900)) {
      spring(H, v, 1, 0.34, onClose);
    } else {
      spring(0, v, 0.85, 0.36);
    }
  };

  useEscapeClose(open && !busy && !diffOpen, requestClose);

  if (!open || typeof document === "undefined") return null;

  // Préremplissage de la barre meta (nommage PDF/historique) — champs vides uniquement.
  const prefillMeta = (desc: string) => {
    const { company, role, setCompany, setRole } = useDocStore.getState();
    if (company.trim() && role.trim()) return;
    void fetchJobMeta(desc).then((meta) => {
      if (!meta) return;
      const s = useDocStore.getState();
      if (!s.company.trim() && meta.company) setCompany(meta.company);
      if (!s.role.trim() && meta.role) setRole(meta.role);
    });
  };

  // Adaptation du corps de la lettre courante à l'offre (même flux que la page Pack).
  const runLetter = async (desc: string) => {
    const { json, setJson, company, role, setCompany, setRole } = useDocStore.getState();
    const letter = json as Letter;
    if (!letter.body.trim()) {
      toast("Le corps de la lettre est vide — rédige-le d'abord.", "error");
      return;
    }
    setBusy(true);
    try {
      // Le CV Maître sert de source de faits à l'IA (photo jamais envoyée).
      const master = await loadMasterResume();
      const { body } = await postJson<{ body: string }>("/api/adapt-letter", {
        letter_body: letter.body,
        job_desc: desc,
        cv_json: master ? { ...master, photo: "" } : {},
        company: company.trim(),
        role: role.trim(),
      });
      if (!body.trim()) throw new Error("Le corps adapté reçu est vide — lettre conservée.");

      // En plus du corps, on renseigne les champs objectifs de l'en-tête (destinataire,
      // objet, date) à partir de l'offre — comme le fait le Pack (buildLetterFromTemplate).
      // company/role viennent de la barre meta ; si vides, on les extrait de l'offre.
      let comp = company.trim();
      let rol = role.trim();
      if (!comp || !rol) {
        const meta = await fetchJobMeta(desc);
        if (meta) {
          comp = comp || meta.company.trim();
          rol = rol || meta.role.trim();
        }
      }
      const city = (master?.location ?? "").split(",")[0].trim();
      const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

      // L'IA peut recopier les variables de modèle ({Entreprise}, {Poste}, {Prénom}…),
      // comportement prévu pour le Pack : on les substitue ici, sinon elles resteraient
      // littérales dans l'éditeur. Prénom/Nom viennent de la signature de la lettre courante.
      const [prenom, ...rest] = (letter.signature || letter.sender_name || "").trim().split(/\s+/);
      const renderedBody = renderTemplate(body, {
        Entreprise: comp,
        Poste: rol,
        Date: today,
        "Prénom": prenom ?? "",
        Nom: rest.join(" "),
        "M/Mme Nom": "",
      });

      const patch: Partial<Letter> = { body: renderedBody, date: city ? `${city}, le ${today}` : `Le ${today}` };
      if (comp) patch.recipient_name = comp;
      if (rol) patch.subject = `Candidature au poste de ${rol}`;
      setJson({ ...letter, ...patch });

      // Renseigne aussi la barre meta (nommage PDF/historique) avec ce qu'on a résolu.
      if (comp && !company.trim()) setCompany(comp);
      if (rol && !role.trim()) setRole(rol);

      toast("Lettre adaptée à l'offre.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    const { docType, json, setJson } = useDocStore.getState();
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi.", "error");
      return;
    }
    if (docType === "Lettre") {
      await runLetter(desc);
      return;
    }
    if (docType !== "CV" && docType !== "Maître") {
      toast("L'adaptation IA ne s'applique qu'aux CV et aux lettres.", "error");
      return;
    }

    // Base de l'adaptation : le CV Maître si la case est cochée et qu'il existe, sinon le CV courant.
    const master = useMaster ? await loadMasterResume() : null;
    const base = (master ?? json) as Resume;

    // Photo jamais envoyée (allègement des tokens) ; restaurée localement au retour.
    const { photo: originalPhoto, ...clean } = base;

    setBusy(true);
    try {
      const { resume: raw } = await postJson<{ resume: unknown }>("/api/tailor-resume", {
        resume: clean,
        job_desc: desc,
        level,
      });
      const adapted = normalizeResume(raw);
      // Garde anti-vidage : une réponse vide ne doit jamais écraser le CV courant.
      if (isEmptyResume(adapted)) {
        throw new Error("Le CV adapté reçu est vide — CV conservé.");
      }

      const { json, templateId, setTailorBefore } = useDocStore.getState();
      setTailorBefore({ json, templateId });

      setJson({ ...adapted, photo: originalPhoto || (json as Resume).photo || "" });
      toast(
        master ? "CV adapté depuis le CV Maître." : "CV adapté avec succès.",
        "success",
      );

      prefillMeta(desc);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  // Blocs partagés CV / lettre, composés différemment par chaque mode.
  const offerSection = (
    <>
      <div className="tailor-section-header">
        <span className="tailor-section-title">Offre d&apos;emploi</span>
      </div>
      <JobExtractor onExtracted={(text) => setJobDesc(text)} disabled={busy} />
      <textarea
        id="job-desc-input"
        className="form-textarea"
        placeholder="Colle ici le texte de l'offre d'emploi, ou utilise l'extracteur ci-dessus…"
        value={jobDesc}
        onChange={(e) => setJobDesc(e.target.value)}
        disabled={busy}
      />
    </>
  );

  const adaptButton = (
    <button type="button" className="tailor-btn tailor-btn-block" onClick={run} disabled={busy}>
      {busy ? "Adaptation…" : isLetter ? "Adapter la lettre" : "Adapter le CV"}
    </button>
  );

  const content = (
    <>
      <div
        ref={scrimRef}
        className="sheet-scrim"
        role="presentation"
        onClick={busy ? undefined : requestClose}
      />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={isLetter ? "Adapter la lettre à une offre" : "Adapter le CV à une offre"}
      >
        <div
          className="sheet__grab"
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        >
          <div className="sheet__handle" />
          <div className="sheet__head">
            <div>
              <h2 className="sheet__title">Adapter à une offre</h2>
              <div className="sheet__sub">
                {isLetter
                  ? "L'IA adapte le corps de ta lettre — ta voix reste la tienne."
                  : "Un snapshot du CV est pris avant chaque adaptation."}
              </div>
            </div>
            <button
              type="button"
              className="ui-icon-btn"
              aria-label="Fermer"
              onClick={requestClose}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={busy}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="sheet__body">
          {offerSection}

          {isLetter ? null : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="form-label" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Niveau d&apos;adaptation
                </span>
                <div className="sheet-levels" role="radiogroup" aria-label="Niveau d'adaptation">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={level === l.id}
                      className={`sheet-level${level === l.id ? " active" : ""}`}
                      onClick={() => setLevel(l.id)}
                      disabled={busy}
                    >
                      <span className="sheet-level__head">
                        <span className="sheet-level__radio"><span className="sheet-level__dot" /></span>
                        <span className="sheet-level__title">{l.label}</span>
                      </span>
                      <span className="sheet-level__desc">{l.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="ui-switch-row"
                onClick={() => { if (!busy) setUseMaster(!useMaster); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!busy) setUseMaster(!useMaster);
                  }
                }}
              >
                <div className="ui-switch-label">
                  <span className="ui-switch-title">Utiliser le CV Principal</span>
                  <span className="ui-switch-hint">Recommandé si disponible</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useMaster}
                  className="ui-switch"
                  disabled={busy}
                  tabIndex={-1}
                >
                  <div className="ui-switch-knob" />
                </button>
              </div>

              <AtsPanel jobDesc={jobDesc} />
            </>
          )}
        </div>

        <div className="sheet__foot">
          {adaptButton}
          {isLetter ? null : (
            <>
              {tailorBefore ? (
                <button type="button" className="diffx-trigger" onClick={() => setDiffOpen(true)} disabled={busy}>
                  <span>Voir les modifications</span>
                  <svg className="diffx-trigger__arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                className="tailor-btn tailor-btn-block pack-btn-variant"
                onClick={() => {
                  useDocStore.getState().setPendingJobDesc(jobDesc);
                  onClose();
                  router.push("/pack");
                }}
                disabled={busy}
              >
                Créer une lettre de motivation
              </button>
            </>
          )}
        </div>

        <DiffModal open={diffOpen} onClose={() => setDiffOpen(false)} />
      </div>
    </>
  );

  return createPortal(content, document.body);
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import VariableEditor from "./VariableEditor";
import { TEMPLATE_VARIABLES, type TemplateVars } from "@/lib/templates/render";
import type { Resume } from "@/lib/resume/schema";
import type { MailTemplate } from "@/lib/templates/defaults";
import { buildLetterFromTemplate } from "@/lib/templates/build";
import { ensureDefaultTemplates, listTemplates, saveTemplate, saveDraft, loadProfile } from "@/lib/storage/db";
import { resolveLetterIdentity, type UserProfile } from "@/lib/profile/profile";
import { toast } from "@/state/uiStore";
import JobExtractor from "../modals/JobExtractor";

/**
 * Page « Lettre de motivation » (/pack) : un éditeur à étiquettes plein écran
 * (objet + corps) qui construit la lettre depuis un modèle unique à variables
 * locales — zéro email, zéro aperçu séparé. IA optionnelle : « Adapter à l'offre »
 * réécrit le corps au texte de l'offre (la photo du CV n'est jamais envoyée).
 */
export default function PackView() {
  const router = useRouter();
  const [tpl, setTpl] = useState<MailTemplate | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompanyLocal] = useState(() => useDocStore.getState().company);
  const [role, setRoleLocal] = useState(() => useDocStore.getState().role);
  const [contact, setContact] = useState("");
  const [jobDesc, setJobDesc] = useState(() =>
    typeof window !== "undefined" ? useDocStore.getState().pendingJobDesc ?? "" : "",
  );
  const [busy, setBusy] = useState(false);
  // Déplie l'adaptation IA d'emblée si on arrive avec une offre en attente.
  const [showAdapt, setShowAdapt] = useState(
    () => typeof window !== "undefined" && !!useDocStore.getState().pendingJobDesc,
  );

  // Consomme l'offre en attente (depuis TailorModal ou « Candidater ») une fois lue.
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
  }, []);

  // Charge le modèle unique (seed/migration au premier lancement).
  useEffect(() => {
    (async () => {
      await ensureDefaultTemplates();
      const [all, p] = await Promise.all([listTemplates(), loadProfile()]);
      setTpl((cur) => cur ?? all[0] ?? null);
      setProfile(p || null);
    })();
  }, []);

  const cvRaw = useDocStore((s) => s.json) as Resume;
  const isCv = "name" in (cvRaw as object);
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const identity = useMemo(() => isCv ? resolveLetterIdentity(cvRaw, profile) : null, [cvRaw, profile, isCv]);

  const vars: TemplateVars = useMemo(() => {
    return {
      Entreprise: company.trim(),
      Poste: role.trim(),
      "M/Mme Nom": contact.trim(),
      "Prénom": identity?.prenom ?? "",
      Nom: identity?.nom ?? "",
      Date: today,
    };
  }, [company, role, contact, identity, today]);

  const letter = useMemo(
    () => (tpl && isCv && identity ? buildLetterFromTemplate(tpl, vars, identity.cv, today) : null),
    [tpl, vars, identity, isCv, today],
  );

  const patchTpl = (patch: Partial<MailTemplate>) => setTpl((t) => (t ? { ...t, ...patch } : t));

  // Persistance silencieuse des éditions du modèle (débounce 800 ms).
  useEffect(() => {
    if (!tpl) return;
    const t = setTimeout(() => void saveTemplate(tpl), 800);
    return () => clearTimeout(t);
  }, [tpl]);

  // Préremplissage silencieux depuis l'offre — ne remplit QUE les champs vides.
  const prefillFromJob = async (desc: string) => {
    if (company.trim() && role.trim()) return;
    const meta = await fetchJobMeta(desc);
    if (!meta) return;
    if (!company.trim() && meta.company) setCompanyLocal(meta.company);
    if (!role.trim() && meta.role) setRoleLocal(meta.role);
  };

  const adaptWithAi = async () => {
    if (!tpl) return;
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi pour adapter la lettre.", "error");
      return;
    }
    if (!isCv) {
      toast("Charge d'abord un CV dans l'éditeur.", "error");
      return;
    }
    setBusy(true);
    try {
      // Photo jamais envoyée à l'IA.
      const { body } = await postJson<{ body: string }>("/api/adapt-letter", {
        letter_body: tpl.letterBody,
        job_desc: desc,
        cv_json: { ...(identity?.cv ?? cvRaw), photo: "" },
        company: company.trim(),
        role: role.trim(),
      });
      patchTpl({ letterBody: body });
      toast("Corps de la lettre adapté à l'offre.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'adaptation.", "error");
    } finally {
      setBusy(false);
    }
  };

  const loadLetter = async () => {
    if (!letter) return;
    const { setDocType, setJson, setCompany, setRole } = useDocStore.getState();
    await saveDraft({
      id: "draft-Lettre",
      html: "",
      css: "",
      json: letter,
      templateId: null,
      htmlSource: false,
      updatedAt: 0,
    });
    setDocType("Lettre");
    setJson(letter);
    if (company.trim()) setCompany(company.trim());
    if (role.trim()) setRole(role.trim());
    toast("Lettre chargée dans l'éditeur (type « Lettre »).", "success");
    router.push("/");
  };

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Lettre de motivation</h1>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn-nav"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Retour
          </button>
        </div>
      </header>

      <div className="pane pack-page" style={{ overflowY: "auto" }}>
        <p className="pack-hint">
          Ces champs remplacent automatiquement les variables (les pastilles) dans ta lettre.
        </p>

        <div className="pack-vars">
          <input className="form-input" placeholder="Entreprise" value={company}
            onChange={(e) => setCompanyLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Poste visé" value={role}
            onChange={(e) => setRoleLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Contact — ex. Madame Dupont (optionnel)" value={contact}
            onChange={(e) => setContact(e.target.value)} disabled={busy} />
        </div>

        {tpl ? (
          <>
            <label className="form-label">Objet</label>
            <VariableEditor
              value={tpl.letterSubject}
              onChange={(v) => patchTpl({ letterSubject: v })}
              disabled={busy}
              ariaLabel="Objet de la lettre"
              showPalette={false}
              singleLine
              minHeightPx={0}
            />

            <label className="form-label">Corps de la lettre</label>
            <VariableEditor
              value={tpl.letterBody}
              onChange={(v) => patchTpl({ letterBody: v })}
              variables={TEMPLATE_VARIABLES}
              disabled={busy}
              ariaLabel="Corps de la lettre"
              minHeightPx={340}
            />
          </>
        ) : null}

        <button
          type="button"
          className="form-btn-mini pack-advanced-toggle"
          aria-expanded={showAdapt}
          onClick={() => setShowAdapt((v) => !v)}
        >
          {showAdapt ? "▾ Adapter à une offre (IA)" : "▸ Adapter à une offre (IA)"}
        </button>
        {showAdapt ? (
          <div className="pack-advanced">
            <JobExtractor onExtracted={(text) => { setJobDesc(text); void prefillFromJob(text); }} disabled={busy} />
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Colle l'offre d'emploi ici — l'IA réécrit le corps de la lettre pour coller au poste."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              onBlur={() => void prefillFromJob(jobDesc)}
              disabled={busy}
            />
            <button type="button" className="go" onClick={adaptWithAi} disabled={busy || !tpl}>
              {busy ? "Adaptation…" : "✨ Adapter le corps à l'offre"}
            </button>
          </div>
        ) : null}

        <div className="pack-actions">
          <button type="button" className="go" onClick={loadLetter} disabled={busy || !letter}>
            Créer ma lettre (ouvrir dans l&apos;éditeur)
          </button>
          {!isCv ? (
            <p className="pack-hint">Charge d&apos;abord un CV dans l&apos;éditeur pour générer la lettre.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

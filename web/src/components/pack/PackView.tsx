"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import { generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import PdfPreview from "../editor/PdfPreview";
import TemplateEditorPanel from "./TemplateEditorPanel";
import VariableEditor from "./VariableEditor";
import { TEMPLATE_VARIABLES } from "@/lib/templates/render";
import type { Resume } from "@/lib/resume/schema";
import type { MailTemplate } from "@/lib/templates/defaults";
import { buildLetterFromTemplate, renderEmail } from "@/lib/templates/build";
import type { TemplateVars } from "@/lib/templates/render";
import { ensureDefaultTemplates, listTemplates, saveTemplate, deleteTemplate, saveDraft } from "@/lib/storage/db";
import { toast, uiConfirm } from "@/state/uiStore";
import JobExtractor from "../modals/JobExtractor";

/**
 * Page « Pack candidature » (/pack) : lettre + email construits depuis un modèle à
 * variables (bibliothèque locale, zéro IA par défaut). IA optionnelle : « Adapter à
 * l'offre » ajuste le corps de la lettre au texte de l'offre (photo jamais envoyée).
 */
export default function PackView() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [tpl, setTpl] = useState<MailTemplate | null>(null);
  const [company, setCompanyLocal] = useState(() => useDocStore.getState().company);
  const [role, setRoleLocal] = useState(() => useDocStore.getState().role);
  const [contact, setContact] = useState("");
  const [jobDesc, setJobDesc] = useState(() =>
    typeof window !== "undefined" ? useDocStore.getState().pendingJobDesc ?? "" : "",
  );
  const [busy, setBusy] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Consomme l'offre en attente (depuis TailorModal ou « Candidater ») une fois lue.
  useEffect(() => {
    if (useDocStore.getState().pendingJobDesc) useDocStore.getState().setPendingJobDesc(null);
  }, []);

  // Chargement de la bibliothèque à l'ouverture (seed au premier lancement).
  useEffect(() => {
    (async () => {
      await ensureDefaultTemplates();
      const all = await listTemplates();
      setTemplates(all);
      setTpl((cur) => cur ?? all[0] ?? null);
    })();
  }, []);

  const cv = useDocStore((s) => s.json) as Resume;
  const isCv = "name" in (cv as object);
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const vars: TemplateVars = useMemo(() => {
    const name = (isCv ? cv.name : "").trim();
    const [prenom, ...rest] = name.split(/\s+/);
    return {
      Entreprise: company.trim(),
      Poste: role.trim(),
      "M/Mme Nom": contact.trim(),
      "Prénom": prenom ?? "",
      Nom: rest.join(" "),
      Date: today,
    };
  }, [company, role, contact, cv, isCv, today]);

  const letter = useMemo(
    () => (tpl && isCv ? buildLetterFromTemplate(tpl, vars, cv, today) : null),
    [tpl, vars, cv, isCv, today],
  );
  const email = useMemo(() => (tpl ? renderEmail(tpl, vars) : null), [tpl, vars]);

  // Aperçu PDF debouncé (600 ms) — régénérer à chaque frappe serait trop lourd.
  useEffect(() => {
    if (!letter) return;
    const t = setTimeout(() => {
      generateLetterPdfBlob(letter, []).then(setPdfBlob).catch(console.error);
    }, 600);
    return () => clearTimeout(t);
  }, [letter]);

  const patchTpl = (patch: Partial<MailTemplate>) => setTpl((t) => (t ? { ...t, ...patch } : t));

  const selectTpl = (id: string) => {
    const found = templates.find((t) => t.id === id);
    if (found) setTpl({ ...found });
  };

  // Préremplissage silencieux depuis l'offre — ne remplit QUE les champs vides.
  const prefillFromJob = async (desc: string) => {
    if (company.trim() && role.trim()) return;
    const meta = await fetchJobMeta(desc);
    if (!meta) return;
    if (!company.trim() && meta.company) setCompanyLocal(meta.company);
    if (!role.trim() && meta.role) setRoleLocal(meta.role);
  };

  const onSaveTpl = async () => {
    if (!tpl) return;
    await saveTemplate(tpl);
    setTemplates(await listTemplates());
    toast("Modèle enregistré.", "success");
  };

  const onDuplicateTpl = async () => {
    if (!tpl) return;
    const copy = { ...tpl, id: crypto.randomUUID(), name: `${tpl.name} (copie)` };
    await saveTemplate(copy);
    setTemplates(await listTemplates());
    setTpl(copy);
    toast("Modèle dupliqué.", "success");
  };

  const onDeleteTpl = async () => {
    if (!tpl) return;
    if (templates.length <= 1) {
      toast("Impossible de supprimer le dernier modèle.", "error");
      return;
    }
    if (!(await uiConfirm(`Supprimer le modèle « ${tpl.name} » ?`, "Supprimer"))) return;
    await deleteTemplate(tpl.id);
    const all = await listTemplates();
    setTemplates(all);
    setTpl(all[0] ? { ...all[0] } : null);
    toast("Modèle supprimé.", "success");
  };

  const adaptWithAi = async () => {
    if (!tpl) return;
    const desc = jobDesc.trim();
    if (!desc) {
      toast("Colle d'abord une offre d'emploi pour adapter le modèle.", "error");
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
        cv_json: { ...cv, photo: "" },
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

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(`Objet : ${email.subject}\n\n${email.body}`);
      toast("Email copié dans le presse-papier.", "success");
    } catch {
      toast("Copie automatique impossible — sélectionne et copie manuellement.", "error");
    }
  };

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Pack candidature</h1>
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
        <div className="pack-tpl-bar">
          <select
            className="form-input"
            value={tpl?.id ?? ""}
            onChange={(e) => selectTpl(e.target.value)}
            disabled={busy}
            aria-label="Choisir un modèle"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>Enregistrer</button>
          <button type="button" className="form-btn-mini" onClick={onDuplicateTpl} disabled={busy || !tpl}>Dupliquer</button>
          <button type="button" className="form-btn-mini" onClick={onDeleteTpl} disabled={busy || !tpl}>Supprimer</button>
        </div>

        <div className="pack-vars">
          <input className="form-input" placeholder="Entreprise" value={company}
            onChange={(e) => setCompanyLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Poste visé" value={role}
            onChange={(e) => setRoleLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Contact — ex. Madame Dupont (optionnel)" value={contact}
            onChange={(e) => setContact(e.target.value)} disabled={busy} />
        </div>

        <JobExtractor onExtracted={(text) => { setJobDesc(text); void prefillFromJob(text); }} disabled={busy} />
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Offre d'emploi (optionnel) — sert au bouton « Adapter à l'offre » et au préremplissage des champs…"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          onBlur={() => void prefillFromJob(jobDesc)}
          disabled={busy}
        />

        <div className="pack-result">
          <div className="pack-col">
            {tpl ? (
              <>
                <label className="form-label">Corps de la lettre</label>
                <VariableEditor
                  value={tpl.letterBody}
                  onChange={(v) => patchTpl({ letterBody: v })}
                  variables={TEMPLATE_VARIABLES}
                  disabled={busy}
                  ariaLabel="Corps de la lettre"
                  minHeightPx={160}
                />
                <label className="form-label">Corps de l&apos;email</label>
                <VariableEditor
                  value={tpl.emailBody}
                  onChange={(v) => patchTpl({ emailBody: v })}
                  variables={TEMPLATE_VARIABLES}
                  disabled={busy}
                  ariaLabel="Corps de l'email"
                  minHeightPx={120}
                />
                <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} />
              </>
            ) : null}
            <button type="button" className="go" onClick={adaptWithAi} disabled={busy || !tpl}>
              {busy ? "Adaptation…" : "✨ Adapter à l'offre (IA)"}
            </button>
          </div>

          <div className="pack-col">
            <div className="pack-letter-title">Lettre de motivation</div>
            {pdfBlob ? (
              <PdfPreview blob={pdfBlob} />
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isCv ? "Génération de l'aperçu…" : "Charge d'abord un CV dans l'éditeur."}
              </div>
            )}
            <button type="button" className="go" onClick={loadLetter} disabled={busy || !letter}>
              {"Insérer dans l'éditeur (Lettre)"}
            </button>

            <div className="pack-letter-title">{"Email d'accompagnement"}</div>
            <textarea
              className="form-textarea pack-email"
              readOnly
              value={email ? `Objet : ${email.subject}\n\n${email.body}` : ""}
            />
            <button type="button" className="go" onClick={copyEmail} disabled={busy || !email}>
              {"📋 Copier l'email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

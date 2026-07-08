"use client";

import { useState, useEffect, useMemo } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import { fetchJobMeta } from "@/lib/ai/jobMeta";
import { generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import PdfPreview from "../editor/PdfPreview";
import TemplateEditorPanel from "../pack/TemplateEditorPanel";
import type { Resume } from "@/lib/resume/schema";
import type { MailTemplate } from "@/lib/templates/defaults";
import { buildLetterFromTemplate, renderEmail } from "@/lib/templates/build";
import type { TemplateVars } from "@/lib/templates/render";
import { ensureDefaultTemplates, listTemplates, saveTemplate, deleteTemplate, saveDraft } from "@/lib/storage/db";
import { toast, uiConfirm } from "@/state/uiStore";
import JobExtractor from "./JobExtractor";
import { useEscapeClose } from "@/lib/useEscapeClose";

/**
 * Modale « Pack candidature » : lettre + email construits depuis un modèle à variables
 * (bibliothèque locale, zéro IA par défaut). IA optionnelle : « Adapter à l'offre »
 * ajuste le corps de la lettre au texte de l'offre (photo jamais envoyée).
 */
export default function PackModal({
  open,
  onClose,
  initialJobDesc = "",
}: {
  open: boolean;
  onClose: () => void;
  /** Offre déjà saisie dans TailorModal (flux « Candidater » depuis les Offres). */
  initialJobDesc?: string;
}) {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [tpl, setTpl] = useState<MailTemplate | null>(null);
  const [company, setCompanyLocal] = useState(() => useDocStore.getState().company);
  const [role, setRoleLocal] = useState(() => useDocStore.getState().role);
  const [contact, setContact] = useState("");
  const [jobDesc, setJobDesc] = useState(initialJobDesc);
  const [busy, setBusy] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Reprend l'offre saisie dans TailorModal à chaque ouverture, si le champ local est
  // encore vide (ajustement pendant le rendu — pas de setState dans un effet).
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && !jobDesc && initialJobDesc) setJobDesc(initialJobDesc);
  }

  // Chargement de la bibliothèque à l'ouverture (seed au premier lancement).
  useEffect(() => {
    if (!open) return;
    (async () => {
      await ensureDefaultTemplates();
      const all = await listTemplates();
      setTemplates(all);
      setTpl((cur) => cur ?? all[0] ?? null);
    })();
  }, [open]);

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

  useEscapeClose(open && !busy, onClose);

  if (!open) return null;

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
    onClose();
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
    <div className="ui-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="ui-dialog pack-modal pack-modal--result"
        role="dialog"
        aria-modal="true"
        aria-label="Pack candidature"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ui-dialog__title">Pack candidature</h2>

        {/* Barre modèle */}
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
          <button type="button" className="form-btn-mini" onClick={onSaveTpl} disabled={busy || !tpl}>💾 Enregistrer</button>
          <button type="button" className="form-btn-mini" onClick={onDuplicateTpl} disabled={busy || !tpl}>Dupliquer</button>
          <button type="button" className="form-btn-mini" onClick={onDeleteTpl} disabled={busy || !tpl}>Supprimer</button>
        </div>

        {/* Variables */}
        <div className="pack-vars">
          <input className="form-input" placeholder="Entreprise" value={company}
            onChange={(e) => setCompanyLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Poste visé" value={role}
            onChange={(e) => setRoleLocal(e.target.value)} disabled={busy} />
          <input className="form-input" placeholder="Contact — ex. Madame Dupont (optionnel)" value={contact}
            onChange={(e) => setContact(e.target.value)} disabled={busy} />
        </div>

        {/* Offre (IA optionnelle + préremplissage) */}
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
          {/* Colonne gauche : édition du modèle */}
          <div className="pack-col">
            {tpl ? <TemplateEditorPanel tpl={tpl} onChange={patchTpl} disabled={busy} /> : null}
            <button type="button" className="go" onClick={adaptWithAi} disabled={busy || !tpl}>
              {busy ? "Adaptation…" : "✨ Adapter à l'offre (IA)"}
            </button>
          </div>

          {/* Colonne droite : aperçus */}
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

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose} disabled={busy}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

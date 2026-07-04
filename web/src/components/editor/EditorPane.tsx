"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import FormEditor from "@/components/form/FormEditor";
import LetterForm from "@/components/form/LetterForm";
import { useDocStore } from "@/state/docStore";
import { TEMPLATE_IDS, type TemplateId } from "@/lib/resume/templates";
import { normalizeResume, normalizeLetter } from "@/lib/resume/normalize";
import { resumeToJsonResume } from "@/lib/resume/jsonResume";
import { toast, uiPrompt, uiConfirm } from "@/state/uiStore";
import SnapshotsModal from "@/components/modals/SnapshotsModal";
import ImportTextModal from "@/components/modals/ImportTextModal";
import ImportPdfModal from "@/components/modals/ImportPdfModal";
import type { Resume } from "@/lib/resume/schema";

const TEMPLATE_LABELS: Record<TemplateId, string> = {
  sobre: "Sobre",
  moderne: "Moderne",
  classique: "Classique",
  minimal: "Minimal",
  graphique: "Graphique",
};

type Tab = "form" | "html" | "css" | "import";

/**
 * Panneau d'édition : onglet Formulaire + mode expert (HTML / CSS / Importer).
 * Outils intégrés à la barre de titre : Coller/Copier JSON, export Reactive Resume,
 * sélection de modèle, indicateur de brouillon dynamique, snapshots ⟲.
 * Port de la barre d'outils éditeur de l'app Flask (templates/index.html).
 */
export default function EditorPane() {
  const [tab, setTab] = useState<Tab>("form");
  const [expert, setExpert] = useState(false);
  const [saveLabel, setSaveLabel] = useState("✓ Brouillon sauvegardé");
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [importTextOpen, setImportTextOpen] = useState(false);
  const [importPdfOpen, setImportPdfOpen] = useState(false);

  const docType = useDocStore((s) => s.docType);
  const htmlSource = useDocStore((s) => s.htmlSource);
  const html = useDocStore((s) => s.html);
  const css = useDocStore((s) => s.css);
  const templateId = useDocStore((s) => s.templateId);
  const setHtml = useDocStore((s) => s.setHtml);
  const setCss = useDocStore((s) => s.setCss);
  const setJson = useDocStore((s) => s.setJson);
  const setTemplate = useDocStore((s) => s.setTemplate);

  const isResumeType = docType !== "Lettre";

  // Indicateur de sauvegarde dynamique : « Enregistrement… » puis « ✓ Brouillon sauvegardé »
  // (calqué sur le debounce de 1 s de useAutoDraft).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsub = useDocStore.subscribe((state, prev) => {
      if (state.html === prev.html && state.css === prev.css && state.json === prev.json) return;
      setSaveLabel("Enregistrement…");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveLabel("✓ Brouillon sauvegardé"), 1100);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    const openSnapshots = () => setSnapshotsOpen(true);

    window.addEventListener("cvforge:open-snapshots", openSnapshots);
    return () => window.removeEventListener("cvforge:open-snapshots", openSnapshots);
  }, []);

  const toggleExpert = () => {
    const next = !expert;
    setExpert(next);
    setTab(next ? "html" : "form");
  };

  const onPasteJson = async () => {
    const raw = await uiPrompt("Colle le JSON du document :", "", "Coller un JSON");
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw);
      setJson(isResumeType ? normalizeResume(parsed) : normalizeLetter(parsed));
      toast("JSON importé.", "success");
    } catch {
      toast("JSON invalide.", "error");
    }
  };

  const onCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(useDocStore.getState().json, null, 2),
      );
      toast("JSON copié dans le presse-papier.", "success");
    } catch {
      toast("Impossible de copier le JSON.", "error");
    }
  };

  // C1 : le HTML a été édité directement (mode expert / IA) → le formulaire est désynchronisé.
  // On bloque la saisie et on demande une confirmation explicite avant de re-rendre depuis le JSON.
  const onResumeFromForm = async () => {
    if (
      !(await uiConfirm(
        "Le document a été modifié en mode expert (HTML) ou par l'IA. Reprendre avec le formulaire régénérera le document depuis les champs et ÉCRASERA ces modifications. Continuer ?",
        "Formulaire désynchronisé",
      ))
    )
      return;
    const { json, setJson } = useDocStore.getState();
    setJson(json);
    toast("Document régénéré depuis le formulaire.", "success");
  };

  const onExportRr = () => {
    const json = JSON.stringify(
      resumeToJsonResume(useDocStore.getState().json as Resume),
      null,
      2,
    );
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (useDocStore.getState().json as Resume).name?.trim() || "cv";
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, "_") || "cv"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CV exporté (format Reactive Resume).", "success");
  };

  return (
    <>
      <div className="pane-title">
        <div className="tabs">
          <button
            type="button"
            className={`tab${tab === "form" ? " active" : ""}`}
            onClick={() => setTab("form")}
          >
            Formulaire
          </button>

          <button
            type="button"
            className={`tab tab--expert${expert && tab !== "form" ? " active" : ""}`}
            title="Activer le mode expert (HTML/CSS)"
            onClick={toggleExpert}
          >
            Mode Expert
          </button>

          {expert ? (
            <div className="expert-tabs">
              <span className="expert-divider" />
              <button
                type="button"
                className={`tab${tab === "html" ? " active" : ""}`}
                onClick={() => setTab("html")}
              >
                HTML
              </button>
              <button
                type="button"
                className={`tab${tab === "css" ? " active" : ""}`}
                onClick={() => setTab("css")}
              >
                CSS
              </button>
              <button
                type="button"
                className={`tab${tab === "import" ? " active" : ""}`}
                onClick={() => setTab("import")}
              >
                Importer
              </button>
            </div>
          ) : null}
        </div>

        <span className="autosave">{saveLabel}</span>

        <div className="actions-mini">
          <button type="button" className="form-btn-mini" title="Coller/Importer un document au format JSON" onClick={onPasteJson}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            Coller
          </button>
          <button type="button" className="form-btn-mini" title="Copier les données JSON" onClick={onCopyJson}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copier
          </button>
          {isResumeType ? (
            <button type="button" className="form-btn-mini form-btn-icon-only" title="Exporter au format JSON Resume (Reactive Resume)" onClick={onExportRr}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          ) : null}
          <select
            className="toolbar-select"
            value={templateId}
            title="Charger un modèle"
            onChange={(e) => setTemplate(e.target.value as TemplateId)}
          >
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {TEMPLATE_LABELS[id]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-snapshots"
            title="Snapshots de brouillons"
            onClick={() => setSnapshotsOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </button>
        </div>
      </div>

      {tab === "form" ? (
        htmlSource ? (
          <div className="import-pane">
            <p className="import-hint">
              ⚠️ Ce document a été modifié en mode expert (HTML) ou par l&apos;IA : le formulaire
              n&apos;est plus synchronisé avec l&apos;aperçu. Modifier un champ écraserait ces
              changements.
            </p>
            <div className="import-pane-actions">
              <button type="button" className="form-btn-add" onClick={onResumeFromForm}>
                Reprendre avec le formulaire (écrase le HTML)
              </button>
              <button
                type="button"
                className="form-btn-add"
                onClick={() => {
                  setExpert(true);
                  setTab("html");
                }}
              >
                Continuer en mode expert
              </button>
            </div>
          </div>
        ) : docType === "Lettre" ? (
          <LetterForm />
        ) : (
          <FormEditor onImportPdf={() => setImportPdfOpen(true)} />
        )
      ) : tab === "import" ? (
        <div className="import-pane">
          <p className="import-hint">
            Importe un CV existant : l&apos;IA en extrait les données pour remplir le formulaire.
          </p>
          <div className="import-pane-actions">
            <button type="button" className="form-btn-add" onClick={() => setImportTextOpen(true)}>
              Importer un texte
            </button>
            {isResumeType ? (
              <button type="button" className="form-btn-add" onClick={() => setImportPdfOpen(true)}>
                Importer un PDF
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="pane-body editor-monaco">
          <Editor
            language={tab === "html" ? "html" : "css"}
            theme="vs-dark"
            value={tab === "html" ? html : css}
            onChange={(value) => (tab === "html" ? setHtml(value ?? "") : setCss(value ?? ""))}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      )}

      <SnapshotsModal open={snapshotsOpen} onClose={() => setSnapshotsOpen(false)} />
      <ImportTextModal open={importTextOpen} onClose={() => setImportTextOpen(false)} />
      <ImportPdfModal open={importPdfOpen} onClose={() => setImportPdfOpen(false)} />
    </>
  );
}

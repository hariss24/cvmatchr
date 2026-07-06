"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useDocStore, docEngine } from "@/state/docStore";
import { DEFAULT_RESUME, type Resume, type Letter, type DocType } from "@/lib/resume/schema";
import type { DocData } from "@/state/docStore";
import { generateResumePdfBlob } from "@/lib/pdfgen/generatePdf";
import { promptApiKey } from "@/lib/settings";
import { toast, uiAlert, uiConfirm } from "@/state/uiStore";
import { saveHistoryEntry } from "@/lib/storage/db";
import { takeSnapshot } from "@/lib/storage/snapshots";
import ChatPanel from "@/components/modals/ChatPanel";

function slug(s: string): string {
  return s.trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Nom de la personne selon le type : `sender_name` pour une lettre, `name` pour un CV (M3). */
function personNameFor(docType: DocType, json: DocData): string {
  const name = docType === "Lettre" ? (json as Letter).sender_name : (json as Resume).name;
  return name?.trim() || docType;
}

function buildFilename(name: string, docType: string, company: string, role: string, includeDate: boolean): string {
  const parts = [slug(name), slug(docType)];
  if (company) parts.push(slug(company));
  if (role) parts.push(slug(role));
  if (includeDate) parts.push(new Date().toISOString().slice(0, 10));
  return parts.filter(Boolean).join("_");
}

/**
 * Barre du haut : logo, nom du fichier PDF, et actions globales
 * (Nouveau CV, Historique, thème, paramètres API, conversion PDF).
 * Porté du design original Flask (templates/index.html + static/css/main.css).
 */
export default function TopBar() {
  const docType = useDocStore((s) => s.docType);
  const templateId = useDocStore((s) => s.templateId);
  const json = useDocStore((s) => s.json);
  const company = useDocStore((s) => s.company);
  const role = useDocStore((s) => s.role);
  const includeDate = useDocStore((s) => s.includeDate);
  const setJson = useDocStore((s) => s.setJson);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const personName = personNameFor(docType, json);
  const filename = buildFilename(personName, docType, company, role, includeDate);

  const toggleTheme = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const onNewCv = async () => {
    if (!(await uiConfirm("Repartir d'un CV vierge ? Le contenu actuel sera remplacé.", "Nouveau CV"))) return;
    setJson(structuredClone(DEFAULT_RESUME));
    toast("Nouveau CV.", "success");
  };

  const onSettings = () => { void promptApiKey(); };

  const onConvert = useCallback(async () => {
    if (busy) return;
    const { html, css, atsBoost, company, role, htmlSource, includeDate } = useDocStore.getState();
    const name = personNameFor(docType, json);
    const boostKeywords = atsBoost.enabled ? atsBoost.keywords : [];
    const filename = buildFilename(name, docType, company, role, includeDate);
    setBusy(true);
    try {
      let blob: Blob;
      if (docEngine({ docType, templateId, htmlSource }) === "pdf") {
        // Moteur react-pdf : le PDF est généré dans le navigateur — aucun appel serveur.
        blob = await generateResumePdfBlob(
          json as Resume,
          templateId as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId,
          boostKeywords
        );
      } else {
        const res = await fetch("/api/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, css, filename, boostKeywords }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Échec de la conversion." }));
          await uiAlert(error ?? "Échec de la conversion.", "Conversion PDF");
          return;
        }
        blob = await res.blob();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("PDF téléchargé.", "success");

      await saveHistoryEntry({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        doc_type: docType,
        company,
        role,
        job_desc: "",
        filename: `${name} - ${docType}.pdf`,
        notes: "",
        pdf_views: 1,
        editor_reloads: 0,
        last_viewed_at: new Date().toISOString(),
        html,
        css,
        // json périmé quand le HTML est la source (M1) : on ne le sauvegarde pas,
        // le rechargement depuis l'historique repartira du HTML.
        json: htmlSource ? null : structuredClone(json),
        templateId,
      });
    } catch {
      await uiAlert("Impossible de générer le PDF.", "Conversion PDF");
    } finally {
      setBusy(false);
    }
  }, [busy, docType, json, templateId]);

  useEffect(() => {
    const handleConvert = () => {
      void onConvert();
    };

    window.addEventListener("cvforge:convert", handleConvert);
    return () => window.removeEventListener("cvforge:convert", handleConvert);
  }, [onConvert]);

  return (
    <>
    <header className="topbar">
      <div className="logo-badge">
        <div className="logo-icon"><div className="logo-icon-inner">T</div></div>
        <div className="logo-text">
          <span className="logo-title">CV Tailor</span>
        </div>
      </div>

      <div className="topbar-pill" title="Nom du fichier PDF">{filename}</div>

      <div className="topbar-actions">
        <button type="button" className="btn-nav" onClick={onNewCv}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        <button type="button" className="btn-nav" onClick={() => { takeSnapshot("Avant chat IA"); setChatOpen(true); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
          Assistant IA
        </button>

        <Link href="/jobs" className="btn-nav">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          Offres
        </Link>

        <Link href="/history" className="btn-nav">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
          Historique
        </Link>

        <div id="btn-theme" role="button" tabIndex={0} title="Basculer thème clair/sombre" aria-label="Basculer thème" onClick={toggleTheme} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleTheme(); }}>
          <span className="toggle-icon toggle-sun">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
          </span>
          <span className="toggle-knob"></span>
          <span className="toggle-icon toggle-moon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          </span>
        </div>

        <button id="btn-settings" type="button" title="Paramètres API" onClick={onSettings}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>

        <button className="go go-top" type="button" onClick={onConvert} disabled={busy}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {busy ? "Conversion…" : "Convertir en PDF"}
        </button>
      </div>
    </header>
    <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}

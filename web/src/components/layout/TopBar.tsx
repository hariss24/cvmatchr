"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useDocStore } from "@/state/docStore";
import { DEFAULT_RESUME, type Resume, type Letter, type DocType } from "@/lib/resume/schema";
import type { DocData } from "@/state/docStore";
import { generateResumePdfBlob, generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
// import removed
import { toast, uiAlert, uiConfirm } from "@/state/uiStore";
import { saveHistoryEntry, loadProfile } from "@/lib/storage/db";
import { applyProfileToResume } from "@/lib/profile/profile";
import { takeSnapshot } from "@/lib/storage/snapshots";
import ChatPanel from "@/components/modals/ChatPanel";
import MobileMenu from "@/components/layout/MobileMenu";
import SegmentedNav from "@/components/layout/SegmentedNav";

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
  const isConverting = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    const profile = await loadProfile();
    setJson(applyProfileToResume(structuredClone(DEFAULT_RESUME), profile));
    const { setCompany, setRole } = useDocStore.getState();
    setCompany("");
    setRole("");
    toast("Nouveau CV.", "success");
  };

  // onSettings removed

  const onConvert = useCallback(async () => {
    if (isConverting.current) return;
    const { company, role, includeDate } = useDocStore.getState();
    const name = personNameFor(docType, json);

    const filename = buildFilename(name, docType, company, role, includeDate);
    isConverting.current = true;
    setBusy(true);
    try {
      let blob: Blob;
      if (docType === "Lettre") {
        blob = await generateLetterPdfBlob(json as Letter);
      } else {
        blob = await generateResumePdfBlob(
          json as Resume,
          templateId as import("@/lib/pdfgen/ResumeDocument").PdfTemplateId
        );
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
        json: structuredClone(json),
        templateId,
      });
    } catch {
      await uiAlert("Impossible de générer le PDF.", "Conversion PDF");
    } finally {
      isConverting.current = false;
      setBusy(false);
    }
  }, [docType, json, templateId]);

  useEffect(() => {
    const handleConvert = () => {
      void onConvert();
    };

    window.addEventListener("cvforge:convert", handleConvert);
    return () => window.removeEventListener("cvforge:convert", handleConvert);
  }, [onConvert]);

  const openChat = () => {
    takeSnapshot("Avant chat IA");
    setChatOpen(true);
  };

  return (
    <>
    <header className="topbar">
      {/* ZONE GAUCHE : Logo + Nav */}
      <div className="topbar-left">
        <div className="logo-badge">
          <div className="logo-icon--atelier">
            <span className="logo-t">T</span>
            <span className="logo-dash" />
          </div>
          <div className="logo-text">
            <span className="logo-title">CV Tailor</span>
            <span className="logo-sub mobile-hidden">Atelier de candidatures</span>
          </div>
        </div>
      </div>

      {/* ZONE CENTRE : navigation segmentée des trois écrans */}
      <div className="topbar-center mobile-hidden">
        <SegmentedNav />
      </div>

      {/* ZONE DROITE : Utilitaires + Actions */}
      <div className="topbar-right">
        <div className="topbar-pill" title="Nom du fichier PDF" suppressHydrationWarning>{filename}</div>
        <button type="button" className="btn-nav topbar-icon mobile-hidden" onClick={openChat} title="Assistant IA">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
        </button>

        <button type="button" id="btn-theme" className="btn-nav topbar-icon mobile-hidden" title="Basculer le thème clair/sombre" aria-label="Basculer le thème" onClick={toggleTheme}>
          <svg className="theme-ico theme-ico--sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
          <svg className="theme-ico theme-ico--moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        </button>

        <Link href="/settings" id="btn-settings" className="mobile-hidden" title="Paramètres">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </Link>

        <Link href="/profil" className="btn-avatar mobile-hidden" title="Mes infos">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </Link>

        <div className="expert-divider mobile-hidden" style={{ margin: "0 4px" }} />

        <button type="button" className="btn-nav mobile-hidden" onClick={onNewCv} title="Nouveau CV">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        <button className="go go-top" type="button" onClick={onConvert} disabled={busy}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          <span className="mobile-hidden">{busy ? "Téléchargement…" : "Télécharger"}</span>
        </button>

        <button
          type="button"
          className="btn-nav mobile-only"
          aria-label="Modifier le contenu"
          onClick={() => window.dispatchEvent(new CustomEvent("cvforge:toggle-form"))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
        </button>
        <button
          type="button"
          className="btn-nav mobile-only topbar-burger"
          aria-label="Menu"
          onClick={() => setMenuOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
      </div>
    </header>
    <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    <MobileMenu
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      onNewCv={onNewCv}
      onOpenChat={openChat}
      onToggleTheme={toggleTheme}
    />
    </>
  );
}

"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
import UserMenu from "@/components/layout/UserMenu";

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
    const { company, role, includeDate, docType: currentDocType, json: currentJson } = useDocStore.getState();
    const name = personNameFor(currentDocType, currentJson);

    const filename = buildFilename(name, currentDocType, company, role, includeDate);
    isConverting.current = true;
    setBusy(true);
    try {
      let blob: Blob;
      if (currentDocType === "Lettre") {
        blob = await generateLetterPdfBlob(currentJson as Letter);
      } else {
        blob = await generateResumePdfBlob(
          currentJson as Resume,
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
        doc_type: currentDocType,
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
          <div className="logo-icon--atelier" aria-hidden="true">
            <svg className="logo-mark" viewBox="0 0 120 120" width="26" height="26">
              <path d="M 63 33 A 27 27 0 1 0 63 87" fill="none" stroke="#F5F1EA" strokeWidth="13" strokeLinecap="round" />
              <path d="M 58 57 L 72 73 L 101 37" fill="none" stroke="#EE6A2C" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-title">CVMatchr</span>
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
          <svg className="ai-sparkle-icon" width="14" height="14" viewBox="0 0 24 24" fill="#FBBF24" stroke="none">
            <path className="ai-star ai-star--big" d="M10 6 Q 10 14 18 14 Q 10 14 10 22 Q 10 14 2 14 Q 10 14 10 6 Z" />
            <path className="ai-star ai-star--small" d="M18 1 Q 18 5 22 5 Q 18 5 18 9 Q 18 5 14 5 Q 18 5 18 1 Z" />
          </svg>
        </button>

        <UserMenu onToggleTheme={toggleTheme} />

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

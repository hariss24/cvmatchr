"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useDocStore } from "@/state/docStore";
import { type Resume, type Letter, type DocType } from "@/lib/resume/schema";
import type { DocData } from "@/state/docStore";
import { generateResumePdfBlob, generateLetterPdfBlob } from "@/lib/pdfgen/generatePdf";
import { buildPdfFilename } from "@/lib/pdfgen/filename";
// import removed
import { toast, uiAlert, uiConfirm } from "@/state/uiStore";
import { saveCurrentDocument } from "@/lib/storage/saveDocument";
import { startNewResume } from "@/lib/storage/newResume";
import { takeSnapshot } from "@/lib/storage/snapshots";
import ChatPanel from "@/components/modals/ChatPanel";
import MobileMenu from "@/components/layout/MobileMenu";
import SegmentedNav from "@/components/layout/SegmentedNav";
import UserMenu from "@/components/layout/UserMenu";

/**
 * Barre du haut : logo, nom du fichier PDF, et actions globales
 * (Nouveau CV, Historique, thème, paramètres API, conversion PDF).
 * Porté du design original Flask (templates/index.html + static/css/main.css).
 */
export default function TopBar() {
  const docType = useDocStore((s) => s.docType);
  const templateId = useDocStore((s) => s.templateId);
  const json = useDocStore((s) => s.json);
  const role = useDocStore((s) => s.role);
  const includeDate = useDocStore((s) => s.includeDate);
  const [busy, setBusy] = useState(false);
  const isConverting = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const filename = buildPdfFilename(docType, role, includeDate);

  const toggleTheme = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const onNewCv = async () => {
    if (!(await uiConfirm("Repartir d'un CV vierge ? Le contenu actuel sera remplacé.", "Nouveau CV"))) return;
    await startNewResume();
    toast("Nouveau CV.", "success");
  };

  // onSettings removed

  const onConvert = useCallback(async () => {
    if (isConverting.current) return;
    const { role, includeDate, docType: currentDocType, json: currentJson } = useDocStore.getState();

    // L'entreprise reste dans le store (suivi de candidature, historique) mais ne
    // rentre plus dans le nom du fichier, qui devenait interminable.
    const filename = buildPdfFilename(currentDocType, role, includeDate);
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

      // Le téléchargement enregistre toujours, comme avant — il n'en est
      // simplement plus le seul moyen (bouton « Enregistrer », task 6).
      await saveCurrentDocument();
    } catch {
      await uiAlert("Impossible de générer le PDF.", "Conversion PDF");
    } finally {
      isConverting.current = false;
      setBusy(false);
    }
  }, [templateId]);

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

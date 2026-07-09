"use client";

import { useEffect, useState } from "react";
import { listHistoryEntries, deleteHistoryEntry, updateHistoryEntryStat, saveDraft, type HistoryEntry } from "@/lib/storage/db";
import { uiConfirm, uiAlert, toast } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { useRouter } from "next/navigation";

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function HistoryList() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState("");
  const router = useRouter();

  const setDocType = useDocStore(s => s.setDocType);
  const setJson = useDocStore(s => s.setJson);
  const setHtml = useDocStore(s => s.setHtml);
  const setCss = useDocStore(s => s.setCss);
  const setPreviewOverride = useDocStore(s => s.setPreviewOverride);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const reload = () => { void load(); };
    window.addEventListener("cvforge:history-changed", reload);
    return () => window.removeEventListener("cvforge:history-changed", reload);
  }, []);

  async function load() {
    setEntries(await listHistoryEntries());
  }

  async function handleViewPdf(id: string) {
    const entry = entries.find(e => e.id === id);
    if (!entry || !entry.html) {
      await uiAlert("HTML introuvable. Chargez ce document dans l'éditeur et générez le PDF au moins une fois.", "PDF indisponible");
      return;
    }
    try {
      toast("Génération du PDF...", "info");
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: entry.html, css: entry.css, format: "A4", margin: "0", background: true, filename: entry.filename }),
      });
      if (!res.ok) { await uiAlert("Erreur lors de la génération du PDF.", "Erreur"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      await updateHistoryEntryStat(id, "pdf_views");
      await load();
    } catch {
      await uiAlert("Erreur réseau.", "Erreur");
    }
  }

  async function handleReload(id: string) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    if (!(await uiConfirm("Recharger ce document dans l'éditeur ? Votre travail actuel sera remplacé.", "Recharger"))) return;
    await updateHistoryEntryStat(id, "editor_reloads");
    await saveDraft({
      id: `draft-${entry.doc_type}`,
      html: entry.html,
      css: entry.css,
      json: entry.json,
      templateId: entry.templateId,
      updatedAt: Date.now(),
    });
    setDocType(entry.doc_type);
    if (entry.json) setJson(entry.json);
    else setHtml(entry.html);
    setCss(entry.css);
    setPreviewOverride(null);
    toast("Document rechargé.", "success");
    router.push("/");
  }

  async function handleDelete(id: string) {
    if (!(await uiConfirm("Supprimer cette entrée ? Action irréversible.", "Supprimer"))) return;
    await deleteHistoryEntry(id);
    await load();
  }

  const filtered = entries.filter(e => {
    const f = filter.toLowerCase();
    if (!f) return true;
    return (
      (e.company || "").toLowerCase().includes(f) ||
      (e.role || "").toLowerCase().includes(f) ||
      (e.doc_type || "").toLowerCase().includes(f) ||
      (e.notes || "").toLowerCase().includes(f) ||
      (e.job_desc || "").toLowerCase().includes(f) ||
      (e.filename || "").toLowerCase().includes(f)
    );
  });

  return (
    <>
      <input
        type="text"
        className="hist-search"
        placeholder="Rechercher entreprise, poste, notes..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="hist-empty">Aucun document.</div>
      ) : (
        <div className="card-list">
          {filtered.map(e => {
            const dateStr = fmtDate(e.created_at);
            const [day, time] = dateStr.split(", ");
            const typeKey = (e.doc_type || "").toLowerCase();
            const pdfViews = e.pdf_views || 0;
            const editorReloads = e.editor_reloads || 0;

            return (
              <div key={e.id} className="history-card">
                <div className="card-date">
                  <div className="card-date-day">{day || dateStr}</div>
                  <div className="card-date-time">{time || ""}</div>
                </div>

                <div className="card-type">
                  <span className={`type-badge type-${typeKey}`}>{e.doc_type}</span>
                </div>

                <div className="card-company">
                  <div className="card-label">Entreprise</div>
                  <div className="card-val">{e.company || "-"}</div>
                </div>

                <div className="card-role">
                  <div className="card-label">Poste</div>
                  <div className="card-val" title={e.job_desc || ""}>{e.role || "-"}</div>
                </div>

                <div className="card-filename">
                  <span title={e.filename || ""}>{e.filename || ""}</span>
                  {(pdfViews > 0 || editorReloads > 0) && (
                    <div className="card-stats">
                      {pdfViews > 0 && (
                        <span className="stat-chip" title={e.last_viewed_at ? `Vu ${pdfViews} fois · dernier : ${fmtDate(e.last_viewed_at)}` : `Vu ${pdfViews} fois`}>
                          👁 {pdfViews}
                        </span>
                      )}
                      {editorReloads > 0 && (
                        <span className="stat-chip" title="Chargements dans l'éditeur">↩ {editorReloads}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button className="neu-btn-sm view-pdf" onClick={() => handleViewPdf(e.id)} aria-label="Voir PDF" title="Voir PDF">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    <span className="btn-label">Voir PDF</span>
                  </button>
                  <button className="neu-btn-sm" onClick={() => handleReload(e.id)} aria-label="Recharger" title="Recharger dans l'éditeur">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                    <span className="btn-label">Recharger</span>
                  </button>
                  <button className="neu-btn-sm danger" onClick={() => handleDelete(e.id)} aria-label="Supprimer" title="Supprimer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    <span className="btn-label">Supprimer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { listHistoryEntries, deleteHistoryEntry, updateHistoryEntryStat, type HistoryEntry } from "@/lib/storage/db";
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

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setEntries(await listHistoryEntries());
  }

  async function handleViewPdf(id: string) {
    const entry = entries.find((e) => e.id === id);
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
      if (!res.ok) {
        await uiAlert("Erreur lors de la génération du PDF.", "Erreur");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      
      await updateHistoryEntryStat(id, "pdf_views");
      await load();
    } catch (e) {
      await uiAlert("Erreur réseau.", "Erreur");
    }
  }

  async function handleReload(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    if (!(await uiConfirm("Recharger ce document dans l'éditeur ? Votre travail actuel sera remplacé.", "Recharger"))) {
      return;
    }

    await updateHistoryEntryStat(id, "editor_reloads");

    setDocType(entry.doc_type);
    if (entry.json) {
      setJson(entry.json);
    } else {
      setHtml(entry.html);
      setCss(entry.css);
    }
    setPreviewOverride(null);
    toast("Document rechargé.", "success");
    router.push("/");
  }

  async function handleDelete(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    
    if (!(await uiConfirm(`Supprimer cette entrée ? Action irréversible.`, "Supprimer"))) return;

    await deleteHistoryEntry(id);
    await load();
  }

  const filtered = entries.filter((e) => {
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
    <div>
      <input
        type="text"
        className="form-input"
        placeholder="Rechercher (entreprise, poste, type...)"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ marginBottom: "20px", width: "100%", maxWidth: "400px" }}
      />

      {filtered.length === 0 ? (
        <div style={{ opacity: 0.6, padding: "20px 0" }}>Aucun document dans l'historique.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((e) => {
            const dateStr = fmtDate(e.created_at);
            const [day, time] = dateStr.split(", ");
            const isCV = e.doc_type === "CV";

            return (
              <div key={e.id} style={{ display: "flex", gap: "15px", padding: "15px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", alignItems: "center" }}>
                <div style={{ minWidth: "80px", textAlign: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{day || dateStr}</div>
                  <div style={{ opacity: 0.7, fontSize: "0.8rem" }}>{time}</div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", background: isCV ? "#3b82f633" : "#10b98133", color: isCV ? "#60a5fa" : "#34d399", fontWeight: 600 }}>
                      {e.doc_type}
                    </span>
                    <span style={{ fontWeight: 600 }}>{e.filename || "Sans nom"}</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    {e.pdf_views > 0 && <span style={{ marginRight: "10px" }}>👁 {e.pdf_views} {e.last_viewed_at && `(dernier: ${fmtDate(e.last_viewed_at)})`}</span>}
                    {e.editor_reloads > 0 && <span>↩ {e.editor_reloads} rechargements</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="neu-btn-sm" onClick={() => handleViewPdf(e.id)}>Voir PDF</button>
                  <button className="neu-btn-sm" onClick={() => handleReload(e.id)}>Recharger</button>
                  <button className="neu-btn-sm danger" onClick={() => handleDelete(e.id)}>Supprimer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef } from "react";
import { listHistoryEntries, saveHistoryEntry, type HistoryEntry } from "@/lib/storage/db";
import { uiAlert, toast } from "@/state/uiStore";

/**
 * Boutons Exporter / Importer de l'historique (sauvegarde JSON des entrées + leur HTML/CSS/JSON).
 * Port de `exportData`/`importData` (static/js/history.js). L'historique Next.js est stocké
 * dans une seule table Dexie (`db.history`), donc l'export/import est direct (pas de fallback serveur).
 */
export default function HistoryActions() {
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    const entries = await listHistoryEntries();
    if (entries.length === 0) {
      await uiAlert("Aucune entrée à exporter.", "Export");
      return;
    }
    const payload = { exported_at: new Date().toISOString(), entries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cv-archive-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Données exportées.", "success");
  };

  const onImportFile = async (file: File | null) => {
    if (!file) return;

    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      await uiAlert("Fichier invalide : JSON mal formé.", "Import impossible");
      return;
    }

    const entries = (payload as { entries?: unknown })?.entries;
    if (!Array.isArray(entries)) {
      await uiAlert("Fichier invalide : clé « entries » manquante.", "Import impossible");
      return;
    }

    const existing = await listHistoryEntries();
    const existingIds = new Set(existing.map((e) => e.id));
    let imported = 0;

    for (const raw of entries) {
      const entry = raw as HistoryEntry;
      if (!entry || !entry.id) continue;
      if (!existingIds.has(entry.id)) {
        imported++;
        existingIds.add(entry.id);
      }
      await saveHistoryEntry(entry);
    }

    window.dispatchEvent(new CustomEvent("cvforge:history-changed"));
    await uiAlert(`Import terminé : ${imported} nouvelle(s) entrée(s) ajoutée(s).`, "Import réussi");
  };

  return (
    <>
      <button type="button" className="btn-nav" onClick={() => fileRef.current?.click()}>
        ↑ Importer
      </button>
      <button type="button" className="btn-nav" onClick={onExport}>
        ↓ Exporter
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          onImportFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listShelfEntries, setShelfLabel } from "@/lib/applications/store";
import { ANONYMOUS_LABELS, isAnonymous } from "@/lib/applications/shelf";
import { deleteHistoryEntry, getHistoryEntry, saveDraft, updateHistoryEntryStat, type DocumentSummary } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast, uiConfirm } from "@/state/uiStore";
import { onSyncChange } from "@/lib/storage/syncEvents";
import { pushAll } from "@/lib/storage/syncEngine";

/**
 * Rayon « Mes CV » : les documents non rattachés à une candidature.
 * Un seul document anonyme par type — nommer un document, c'est le garder.
 */
export default function ResumeShelf() {
  const [entries, setEntries] = useState<DocumentSummary[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const router = useRouter();
  const setDocType = useDocStore((s) => s.setDocType);
  const setJson = useDocStore((s) => s.setJson);
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);

  const load = useCallback(async () => { setEntries(await listShelfEntries()); }, []);
  // Chargement initial : la liste arrive via `.then(setEntries)` plutôt que par un
  // appel direct dans l'effet, seule forme que react-hooks/set-state-in-effect accepte.
  useEffect(() => { void listShelfEntries().then(setEntries); }, []);

  useEffect(() => onSyncChange(() => { void load(); }), [load]);

  async function commitLabel(id: string) {
    await setShelfLabel(id, draftLabel);
    setEditing(null);
    setDraftLabel("");
    await load();
  }

  async function reload(doc: DocumentSummary) {
    if (!(await uiConfirm("Recharger ce document dans l'éditeur ? Votre travail actuel sera remplacé.", "Recharger"))) return;
    await updateHistoryEntryStat(doc.id, "editor_reloads");
    const full = await getHistoryEntry(doc.id);
    if (full?.json) {
      await saveDraft({ id: `draft-${doc.doc_type}`, json: full.json, templateId: doc.templateId, updatedAt: Date.now() });
      setDocType(doc.doc_type);
      setJson(full.json);
      setPreviewOverride(null);
      toast("Document rechargé.", "success");
      router.push("/");
    }
  }

  async function remove(doc: DocumentSummary) {
    if (!(await uiConfirm("Supprimer ce document ? Action irréversible.", "Supprimer"))) return;
    await deleteHistoryEntry(doc.id);
    void pushAll();
    await load();
  }

  if (entries.length === 0) return null;

  return (
    <section className="app-shelf">
      <div className="app-shelf__head">
        <h2 className="app-shelf__title">Mes CV</h2>
        <span className="app-shelf__count">{entries.length}</span>
      </div>
      <p className="app-shelf__hint">
        Les CV qui ne visent pas une entreprise précise — CV d&apos;intérim, CV en anglais, CV généraliste.
        Un seul CV anonyme est gardé à la fois : <strong>nommez-le pour le conserver</strong>.
      </p>
      <div className="app-shelf__list">
        {entries.map((doc) => {
          const anon = isAnonymous(doc);
          const name = anon ? (ANONYMOUS_LABELS[doc.doc_type] ?? "Dernier document exporté") : doc.label;
          return (
            <article key={doc.id} className="app-cv">
              <div>
                {editing === doc.id ? (
                  <input
                    className="app-rename"
                    autoFocus
                    value={draftLabel}
                    placeholder="Ex : Intérim manutention"
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={() => void commitLabel(doc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitLabel(doc.id);
                      if (e.key === "Escape") { setEditing(null); setDraftLabel(""); }
                    }}
                  />
                ) : (
                  <div
                    className={`app-cv__name ${anon ? "app-cv__name--unnamed" : ""}`}
                    onClick={() => { setEditing(doc.id); setDraftLabel(doc.label || ""); }}
                    title={anon ? "Cliquer pour nommer et conserver" : "Cliquer pour renommer"}
                  >
                    {name}
                  </div>
                )}
                <div className="app-cv__meta">
                  <span>{doc.doc_type}</span>
                  <span className="app-dot">•</span>
                  <span>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                  <span className="app-dot">•</span>
                  <span className={anon ? "app-cv__warn" : "app-cv__kept"}>
                    {anon ? "sera remplacé au prochain export" : "conservé"}
                  </span>
                </div>
              </div>
              <div className="app-actions">
                {anon ? (
                  <button type="button" className="app-btn app-btn--interview" onClick={() => { setEditing(doc.id); setDraftLabel(""); }}>
                    Nommer pour garder
                  </button>
                ) : null}
                <button type="button" className="app-btn" onClick={() => void reload(doc)}>Ouvrir dans l&apos;éditeur</button>
                <button type="button" className="app-btn app-btn--reject app-btn--icon" onClick={() => void remove(doc)} title="Supprimer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

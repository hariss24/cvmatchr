"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/applications/status";
import type { Application, ApplicationStatus } from "@/lib/applications/types";
import {
  addApplicationEvent, undoLastStatusEvent, saveApplicationNotes,
  deleteApplication, listApplicationDocuments,
} from "@/lib/applications/store";
import { getHistoryEntry, saveDraft, updateHistoryEntryStat, type DocumentSummary } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { toast, uiConfirm } from "@/state/uiStore";
import { executerAction } from "@/lib/ui/executerAction";

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const frDate = (ts: number) => `${new Date(ts).getDate()} ${MONTHS[new Date(ts).getMonth()]}`;
const EVENT_LABELS: Record<string, string> = {
  applied: "Candidature envoyée",
  interview: "Entretien décroché",
  rejected: "Refus enregistré",
  note: "Note",
};

function ageClass(status: ApplicationStatus, days: number): string {
  if (status === "stale") return "app-age--stale";
  if (status === "interview") return "app-age--interview app-age--warm";
  return days < 7 ? "app-age--fresh" : "app-age--warm";
}

export default function ApplicationCard({
  app, status, days, onChanged,
}: { app: Application; status: ApplicationStatus; days: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [notes, setNotes] = useState(app.notes);
  const router = useRouter();
  const setDocType = useDocStore((s) => s.setDocType);
  const setJson = useDocStore((s) => s.setJson);
  const setPreviewOverride = useDocStore((s) => s.setPreviewOverride);

  useEffect(() => {
    if (!open) return;
    void listApplicationDocuments(app.id)
      .then(setDocs)
      .catch((e) => toast(e instanceof Error ? e.message : "Impossible de charger les documents.", "error"));
  }, [open, app.id]);

  // Autosave de la note, même délai perçu que l'éditeur.
  useEffect(() => {
    if (notes === app.notes) return;
    const t = setTimeout(() => {
      // Les notes vivent sur le compte : un échec doit se voir. `void` laissait
      // la note perdue et l'écran inchangé.
      void executerAction(() => saveApplicationNotes(app.id, notes), "Votre note n'a pas pu être enregistrée.");
    }, 800);
    return () => clearTimeout(t);
  }, [notes, app.id, app.notes]);

  const applied = app.events.find((e) => e.type === "applied");
  const interview = app.events.find((e) => e.type === "interview");
  const rejected = app.events.find((e) => e.type === "rejected");

  const meta: string[] = [];
  if (applied) meta.push(`Postulée le ${frDate(applied.date)}`);
  if (interview) meta.push(interview.detail || "Entretien décroché");
  if (rejected) meta.push(`Refus reçu le ${frDate(rejected.date)}`);
  if (status === "stale") meta.push("Aucune réponse");

  async function mark(type: "interview" | "rejected") {
    if (await executerAction(() => addApplicationEvent(app.id, type), "Impossible de mettre à jour cette candidature.")) {
      onChanged();
    }
  }
  async function undo() {
    if (await executerAction(() => undoLastStatusEvent(app.id), "Impossible d'annuler ce changement.")) {
      onChanged();
    }
  }
  async function remove() {
    if (!(await uiConfirm(`Supprimer la candidature ${app.company} ? Les documents générés sont conservés.`, "Supprimer"))) return;
    if (!(await executerAction(() => deleteApplication(app.id), "Impossible de supprimer cette candidature."))) return;
    toast("Candidature supprimée.", "success");
    onChanged();
  }
  async function reload(doc: DocumentSummary) {
    if (!(await uiConfirm("Recharger ce document dans l'éditeur ? Votre travail actuel sera remplacé.", "Recharger"))) return;
    // Compteur d'usage : le seul échec passé sous silence ici — l'annoncer ferait
    // passer une statistique ratée pour un document inaccessible.
    await updateHistoryEntryStat(doc.id, "editor_reloads").catch(() => {});
    let full;
    try {
      full = await getHistoryEntry(doc.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Impossible d'ouvrir ce document.", "error");
      return;
    }
    if (full?.json) {
      // L'identité suit le document rouvert : l'enregistrement automatique le
      // met à jour au lieu d'en déposer une copie.
      // eslint-disable-next-line react-hooks/purity -- appel confiné à un gestionnaire de clic derrière une confirmation, inatteignable pendant le render.
      await saveDraft({ id: `draft-${doc.doc_type}`, json: full.json, templateId: doc.templateId, documentId: doc.id, updatedAt: Date.now() });
      setDocType(doc.doc_type);
      setJson(full.json);
      useDocStore.setState({ documentId: doc.id });
      setPreviewOverride(null);
      toast("Document rechargé.", "success");
      router.push("/");
    }
  }

  return (
    <article className={`app-card ${status === "stale" ? "app-card--stale" : ""} ${open ? "app-card--open" : ""}`} data-testid="application-card">
      <div className={`app-age ${ageClass(status, days)}`}>
        <span className="app-age__num">{days}</span>
        <span className="app-age__unit">jours</span>
      </div>

      <div className="app-main">
        <div className="app-company">{app.company || "Entreprise non précisée"}</div>
        <div className="app-role">{app.role || "Poste non précisé"}</div>
        <div className="app-meta">
          {/* Puce et texte sont frères, pas imbriqués : c'est l'espacement flex de
              .app-meta qui les sépare, comme dans la maquette validée. */}
          {meta.map((m, i) => (
            <Fragment key={i}>
              {i > 0 ? <span className="app-dot">•</span> : null}
              <span>{m}</span>
            </Fragment>
          ))}
          {app.jobUrl ? (
            <>
              <span className="app-dot">•</span>
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer">Voir l&apos;offre</a>
            </>
          ) : null}
        </div>
      </div>

      <div className="app-right">
        <span className={`app-badge app-badge--${status}`}>{STATUS_LABELS[status]}</span>
        <div className="app-actions">
          {status !== "interview" && status !== "rejected" ? (
            <button type="button" className="app-btn app-btn--interview" onClick={() => void mark("interview")}>Entretien</button>
          ) : null}
          {status !== "rejected" ? (
            <button type="button" className="app-btn app-btn--reject" onClick={() => void mark("rejected")}>Refusée</button>
          ) : null}
          {status === "interview" || status === "rejected" ? (
            <button type="button" className="app-btn" onClick={() => void undo()} title="Annuler la dernière action">Annuler</button>
          ) : null}
          <button
            type="button"
            className="app-btn app-btn--icon"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title={open ? "Replier" : "Déplier"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="app-expand">
          <div>
            <div className="app-block__label">Documents rattachés</div>
            {docs.length === 0 ? (
              <div className="app-tile__hint">Aucun document généré pour cette candidature.</div>
            ) : docs.map((doc) => (
              <div key={doc.id} className="app-doc-row">
                <span className="app-doc-name">{doc.filename || doc.doc_type}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="app-doc-date">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                  <button type="button" className="app-btn" onClick={() => void reload(doc)}>Ouvrir dans l&apos;éditeur</button>
                </span>
              </div>
            ))}
          </div>

          {app.jobText ? (
            <div>
              <div className="app-block__label">Offre conservée</div>
              <div className="app-offer">{app.jobText}</div>
            </div>
          ) : null}

          <div>
            <div className="app-block__label">Journal</div>
            <div className="app-timeline">
              {app.events.map((e, i) => (
                <div key={i} className="app-event">
                  <span className="app-event__date">{new Date(e.date).toLocaleDateString("fr-FR")}</span>
                  <span>{EVENT_LABELS[e.type]}</span>
                  <span className="app-event__src">{e.source === "system" ? "auto" : e.source === "ai" ? "ia" : "vous"}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="app-block__label">Note</div>
            <textarea
              className="app-note"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Un détail à retenir (facultatif)…"
            />
          </div>

          <div>
            <button type="button" className="app-btn app-btn--reject" onClick={() => void remove()}>Supprimer la candidature</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

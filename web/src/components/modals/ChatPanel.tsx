"use client";

import { useEffect, useRef, useState } from "react";
import { useDocStore } from "@/state/docStore";
import { postJson } from "@/lib/ai/client";
import type { DocData } from "@/state/docStore";
import type { Resume } from "@/lib/resume/schema";
import StarterPromptMarquee from "@/components/modals/StarterPromptMarquee";

/**
 * Panneau latéral « Assistant IA » : chat éditeur. Port de `_sendChat`/`_appendProposals` (app.js).
 *
 * Flux métier :
 * - la photo base64 est retirée du JSON avant l'appel et restaurée dans les
 *   propositions au retour — jamais envoyée à l'IA ;
 * - chaque proposition se prévisualise (override transitoire de l'aperçu), s'applique (JSON du
 *   store, mode expert) ou se rejette.
 *
 * Le snapshot « Avant chat IA » avant application est reporté en Phase 6 (storage).
 */

type Proposal = { id: string; title: string; summary: string; json: DocData };
type Item =
  | { kind: "msg"; role: "user" | "assistant"; text: string }
  | { kind: "proposal"; data: Proposal; status: "open" | "applied" | "rejected" };
type ChatMessage = { role: "user" | "assistant"; content: string };

export default function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Échap ferme le panneau et annule un éventuel aperçu transitoire.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll en bas à chaque nouvel item.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [items]);

  function handleClose() {
    useDocStore.getState().setPreviewOverride(null);
    onClose();
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const { json, docType } = useDocStore.getState();

    setItems((prev) => [...prev, { kind: "msg", role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });

    // Photo retirée avant l'appel ; mémorisée pour restauration dans les propositions.
    const strippedJson = structuredClone(json);
    let photoData = "";
    if (strippedJson && typeof strippedJson === "object" && "photo" in strippedJson && typeof strippedJson.photo === "string" && strippedJson.photo.startsWith("data:image")) {
      photoData = strippedJson.photo;
      strippedJson.photo = "";
    }

    setBusy(true);
    try {
      const res = await postJson<{ reply: string; proposals?: Proposal[] }>("/api/editor-chat", {
        messages: historyRef.current,
        doc_json: strippedJson,
        doc_type: docType,
      });
      setItems((prev) => [...prev, { kind: "msg", role: "assistant", text: res.reply }]);
      historyRef.current.push({ role: "assistant", content: res.reply });

      const restored = (res.proposals ?? []).map(p => {
        if (photoData && p.json && typeof p.json === "object" && "photo" in p.json) {
          (p.json as Resume).photo = photoData;
        }
        return p;
      });
      
      if (restored.length) {
        setItems((prev) => [
          ...prev,
          ...restored.map(
            (data): Item => ({ kind: "proposal", data, status: "open" }),
          ),
        ]);
      }
    } catch (err) {
      // Échec : on retire le tour utilisateur de l'historique envoyé (fidèle à l'original).
      historyRef.current.pop();
      setItems((prev) => [
        ...prev,
        {
          kind: "msg",
          role: "assistant",
          text: err instanceof Error ? err.message : "Erreur inconnue.",
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function previewProposal(p: Proposal) {
    useDocStore.getState().setPreviewOverride(p.json);
  }

  function applyProposal(idx: number, p: Proposal) {
    const { setJson, setPreviewOverride } = useDocStore.getState();
    setJson(p.json);
    setPreviewOverride(null);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx && it.kind === "proposal" ? { ...it, status: "applied" } : it,
      ),
    );
  }

  function rejectProposal(idx: number) {
    useDocStore.getState().setPreviewOverride(null);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx && it.kind === "proposal" ? { ...it, status: "rejected" } : it,
      ),
    );
  }

  return (
    <>
      <div
        className={`chat-overlay${open ? " open" : ""}`}
        role="presentation"
        onClick={handleClose}
      />
      <aside
        className={`chat-panel${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Assistant IA"
        aria-hidden={!open}
        // inert : panneau fermé = ni focusable ni cliquable (aria-hidden seul laisse le focus passer).
        inert={!open}
      >
        <div className="chat-panel__head">
          <span className="chat-panel__title">Assistant IA</span>
          <button
            type="button"
            className="form-btn-mini"
            onClick={handleClose}
            aria-label="Fermer l'assistant"
          >
            ✕
          </button>
        </div>

        <div className="chat-messages" ref={listRef}>
          {items.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><path d="M10 6 Q 10 14 18 14 Q 10 14 10 22 Q 10 14 2 14 Q 10 14 10 6 Z M 18 1 Q 18 5 22 5 Q 18 5 18 9 Q 18 5 14 5 Q 18 5 18 1 Z" /></svg>
                <h3>Que souhaitez-vous faire ?</h3>
              </div>
              <StarterPromptMarquee onSelect={(text) => {
                setInput(text);
                // On simule un submit
                setTimeout(() => {
                  if (document.getElementById('btn-send-chat')) {
                    document.getElementById('btn-send-chat')?.click();
                  }
                }, 100);
              }} />
            </div>
          ) : null}
          {items.map((it, i) =>
            it.kind === "msg" ? (
              <div key={i} className={`chat-message chat-message--${it.role}`}>
                <div className="chat-bubble">{it.text}</div>
              </div>
            ) : (
              <div
                key={i}
                className={`chat-proposal${
                  it.status === "applied"
                    ? " proposal--applied"
                    : it.status === "rejected"
                      ? " proposal--rejected"
                      : ""
                }`}
              >
                <span className="proposal-title">{it.data.title}</span>
                <span className="proposal-summary">{it.data.summary}</span>
                <div className="proposal-actions">
                  <button
                    type="button"
                    className="proposal-btn"
                    disabled={it.status !== "open"}
                    onClick={() => previewProposal(it.data)}
                  >
                    Prévisualiser
                  </button>
                  <button
                    type="button"
                    className="proposal-btn proposal-apply"
                    disabled={it.status !== "open"}
                    onClick={() => applyProposal(i, it.data)}
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    className="proposal-btn"
                    disabled={it.status !== "open"}
                    onClick={() => rejectProposal(i)}
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ),
          )}
          {busy ? <div className="chat-message chat-message--assistant chat-loading">L&apos;IA génère une proposition…</div> : null}
        </div>

        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="form-textarea chat-input"
            rows={2}
            placeholder="Votre demande…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy}
          />
          <button id="btn-send-chat" type="button" className="chat-send-btn" onClick={send} disabled={busy} aria-label="Envoyer">
            {busy ? (
              <span className="chat-loading-dots">...</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

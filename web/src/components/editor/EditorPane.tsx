"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import FormEditor from "@/components/form/FormEditor";
import { useDocStore } from "@/state/docStore";

type Tab = "form" | "html" | "css";

/**
 * Panneau d'édition : onglets Formulaire / HTML / CSS.
 * - Formulaire : `FormEditor` (édition structurée → store.setJson).
 * - HTML / CSS : éditeurs Monaco liés au store (mode expert, édition directe).
 *
 * Note : éditer le HTML/CSS écrase directement le rendu (setHtml/setCss) ; repasser au
 * formulaire et y modifier un champ régénère le HTML depuis le JSON (comportement attendu,
 * identique à l'app vanilla).
 */
export default function EditorPane() {
  const [tab, setTab] = useState<Tab>("form");
  const html = useDocStore((s) => s.html);
  const css = useDocStore((s) => s.css);
  const setHtml = useDocStore((s) => s.setHtml);
  const setCss = useDocStore((s) => s.setCss);

  return (
    <>
      <div className="pane-title">
        <div className="tabs">
          <button
            type="button"
            className={`tab${tab === "form" ? " active" : ""}`}
            onClick={() => setTab("form")}
          >
            Formulaire
          </button>
          <button
            type="button"
            className={`tab${tab === "html" ? " active" : ""}`}
            onClick={() => setTab("html")}
          >
            HTML
          </button>
          <button
            type="button"
            className={`tab${tab === "css" ? " active" : ""}`}
            onClick={() => setTab("css")}
          >
            CSS
          </button>
        </div>
      </div>

      {tab === "form" ? (
        <FormEditor />
      ) : (
        <div className="pane-body editor-monaco">
          <Editor
            language={tab === "html" ? "html" : "css"}
            theme="vs-dark"
            value={tab === "html" ? html : css}
            onChange={(value) => (tab === "html" ? setHtml(value ?? "") : setCss(value ?? ""))}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";

/** Éditeur de liste de tags (mots-clés, mots exclus, compétences, codes ROME). */
export function TagInput({
  values,
  onChange,
  placeholder,
  id,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft("");
  }
  return (
    <div className="jf-tags-field">
      {values.length > 0 && (
        <div className="jf-tags">
          {values.map((v) => (
            <span key={v} className="jf-tag">
              {v}
              <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        className="ui-input"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

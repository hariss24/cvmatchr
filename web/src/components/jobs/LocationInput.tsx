"use client";

import { useState, useEffect } from "react";
import type { JobSearchProfile } from "@/lib/jobs/profile";

export function LocationInput({
  value,
  onChange,
}: {
  value: JobSearchProfile["location"];
  onChange: (loc: JobSearchProfile["location"]) => void;
}) {
  const [query, setQuery] = useState(value.label || "");
  const [suggestions, setSuggestions] = useState<Array<{ kind: "commune", code: string, label: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Si la requête est trop courte, on vide les suggestions.
      // Mais on évite aussi de chercher si query correspond exactement au label choisi.
      if (query.length < 3 || query === value.label) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/jobs/locations?q=${encodeURIComponent(query)}`);
        if (res.ok) setSuggestions(await res.json());
      } catch (_err) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, value.label]);

  return (
    <div className="location-input" style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Saisissez une commune..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) {
             onChange({ kind: "commune", code: "", label: "", radiusKm: value.radiusKm });
          }
        }}
        style={{ width: "100%", padding: "8px" }}
      />
      {loading && <span style={{ position: "absolute", right: 12, top: 10, fontSize: 12, color: "var(--text-muted, #666)" }}>...</span>}
      
      {suggestions.length > 0 && (
        <ul className="ui-suggestions" style={{ position: "absolute", background: "var(--bg, #fff)", border: "1px solid var(--border, #ccc)", width: "100%", zIndex: 10, listStyle: "none", margin: 0, padding: 0, maxHeight: 200, overflowY: "auto", borderRadius: 4, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
          {suggestions.map((s) => (
            <li
              key={s.code}
              onClick={() => {
                onChange({ ...value, kind: s.kind, code: s.code, label: s.label });
                setQuery(s.label);
                setSuggestions([]);
              }}
              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light, #eee)" }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {value.code && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 14 }}>Rayon de recherche (km) :</label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.radiusKm}
            onChange={(e) => onChange({ ...value, radiusKm: parseInt(e.target.value) || 0 })}
            style={{ width: 80, padding: "4px 8px" }}
          />
        </div>
      )}
    </div>
  );
}

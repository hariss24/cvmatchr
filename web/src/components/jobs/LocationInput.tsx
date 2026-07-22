"use client";

import { useRef, useState } from "react";
import type { LocationFilter, LocationKind } from "@/lib/jobs/profile";

type Suggestion = { kind: LocationKind; code: string; label: string };

/** Champ lieu avec autocomplétion commune/région (geo.api.gouv.fr) + rayon pour les communes. */
export function LocationInput({
  value,
  onChange,
}: {
  value: LocationFilter;
  onChange: (loc: LocationFilter) => void;
}) {
  const [query, setQuery] = useState(value.label || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  function onType(next: string) {
    setQuery(next);
    // Dès que le texte s'écarte du lieu validé, on invalide le code retenu :
    // sinon une recherche partirait en silence sur l'ancienne commune (cf. audit B3).
    if (value.code && next !== value.label) {
      onChange({ kind: "commune", code: "", label: "", radiusKm: value.radiusKm });
    }
    if (timer.current) clearTimeout(timer.current);
    if (next.trim().length < 2 || next === value.label) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort(); // annule la requête précédente (évite les réponses hors ordre)
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/jobs/locations?q=${encodeURIComponent(next)}`, { signal: ctrl.signal });
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        if (!ctrl.signal.aborted) setSuggestions([]);
      }
    }, 250);
  }

  function pick(s: Suggestion) {
    onChange({ kind: s.kind, code: s.code, label: s.label, radiusKm: value.radiusKm ?? 10 });
    setQuery(s.label);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="loc-field">
      <div className="loc-input-wrap">
        <input
          type="text"
          className="ui-input"
          placeholder="Ville, commune ou région…"
          value={query}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Lieu de recherche"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="loc-suggestions" role="listbox">
            {suggestions.map((s) => (
              <li key={`${s.kind}-${s.code}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                  <span>{s.label}</span>
                  <span className="loc-kind">{s.kind === "commune" ? "Commune" : s.kind === "departement" ? "Département" : "Région"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.kind === "commune" && value.code && (
        <label className="loc-radius" title="Rayon autour de la commune">
          <span>Rayon</span>
          <input
            type="number"
            className="ui-input"
            min={0}
            max={100}
            value={value.radiusKm}
            onChange={(e) => onChange({ ...value, radiusKm: parseInt(e.target.value) || 0 })}
          />
          <span className="loc-radius-unit">km</span>
        </label>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

type Suggestion = { label: string; rome: string };

/**
 * Terme court dérivé d'une appellation ROME : retire le doublon masculin/féminin
 * pour garder un mot-clé efficace côté `motsCles` (recherche plein-texte FT).
 *   « Développeur / Développeuse web »            → « Développeur web »
 *   « Chargé / Chargée de communication »         → « Chargé de communication »
 *   « Webmaster » (appellation neutre, sans « / ») → inchangé
 * Une phrase ROME complète (« … / conceptrice de site web ») ne matche presque aucune offre.
 */
function shortTerm(label: string): string {
  const parts = label.split(" / ");
  if (parts.length < 2) return label.trim();
  const masc = parts[0].trim();
  const complement = parts[1].trim().split(/\s+/).slice(1).join(" ").replace(/^[-–]\s*/, "");
  return complement ? `${masc} ${complement}` : masc;
}

/**
 * Champ « Poste(s) recherché(s) » : tags libres + autocomplétion sur les appellations
 * officielles ROME (France Travail). Cliquer une suggestion ajoute un TERME COURT dérivé
 * de l'appellation (cf. `shortTerm`) ; la saisie libre (Entrée) ajoute le texte tapé tel quel.
 */
export function MetierInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  function add(label: string) {
    const t = label.trim();
    if (t && !values.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setDraft("");
    setSuggestions([]);
    setOpen(false);
  }

  function onType(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    if (next.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort(); // annule la requête précédente (évite les réponses hors ordre)
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/jobs/metiers?q=${encodeURIComponent(next)}`, { signal: ctrl.signal });
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        if (!ctrl.signal.aborted) setSuggestions([]);
      }
    }, 220);
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
      <div className="loc-input-wrap">
        <input
          type="text"
          className="ui-input"
          placeholder="Ex. Webmaster, Chargé SEO…  (Entrée pour ajouter)"
          value={draft}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
          aria-label="Poste recherché"
        />
        {open && suggestions.length > 0 && (
          <ul className="loc-suggestions" role="listbox">
            {suggestions.map((s) => (
              <li key={`${s.rome}-${s.label}`}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(shortTerm(s.label))}>
                  <span>{s.label}</span>
                  <span className="loc-kind">{s.rome}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

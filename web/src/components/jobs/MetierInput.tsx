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
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Au-delà de deux postes, la liste tenait sur plusieurs lignes et poussait
  // toute la barre en hauteur. On n'affiche que les derniers ajoutés ; les
  // précédents restent atteignables derrière le compteur, sinon on ne pourrait
  // plus retirer un poste saisi en premier.
  const MAX_VISIBLE = 2;
  const overflow = values.length - MAX_VISIBLE;
  const collapsed = overflow > 0 && !expanded;
  const shown = collapsed ? values.slice(-MAX_VISIBLE) : values;

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
    <div className={`jf-tags-field ${collapsed ? "jf-tags-field--collapsed" : ""}`}>
      {values.length > 0 && (
        <div className="jf-tags">
          {overflow > 0 && (
            <button
              type="button"
              className="jf-tag jf-tag--more"
              title={collapsed ? values.slice(0, -MAX_VISIBLE).join(", ") : undefined}
              aria-label={collapsed ? `Afficher les ${overflow} postes masqués` : "Replier la liste des postes"}
              onClick={() => setExpanded((e) => !e)}
            >
              {collapsed ? `+${overflow}` : "Replier"}
            </button>
          )}
          {shown.map((v) => (
            <span key={v} className="jf-tag">
              <span className="jf-tag__label">{v}</span>
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
          /* Placeholder court dès qu'un poste est saisi : le long débordait de
             la place qui reste à côté des tags. */
          placeholder={values.length > 0 ? "Ajouter un poste…" : "Ex. Webmaster, Chargé SEO…  (Entrée pour ajouter)"}
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

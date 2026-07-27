"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Pastille de filtre : un bouton, un menu. Trois états visuels seulement —
 * par défaut (grise, nom seul), active (anneau orange + valeur), ouverte
 * (enfoncée). Le menu se ferme sur Échap et au clic extérieur : sans ça, sur
 * une barre à six pastilles, on en laisse trois ouvertes derrière soi.
 */
export function FilterPill({
  label, value, icon, children,
}: {
  label: string;
  /** Valeur affichée à droite du nom. "" ⇒ la pastille ne contraint rien. */
  value: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flt-pill-wrap" ref={root}>
      <button
        type="button"
        className={`flt-pill ${value ? "is-set" : ""} ${open ? "is-open" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        {label}
        {value && <span className="flt-pill__val">{value}</span>}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
        </svg>
      </button>
      {open && <div className="flt-menu">{children}</div>}
    </div>
  );
}

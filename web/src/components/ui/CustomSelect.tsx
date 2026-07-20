"use client";
import { useState, useRef, useEffect } from "react";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  group?: string;
};

export default function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  className,
  style
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  // Group options
  const groups: Record<string, SelectOption<T>[]> = {};
  const noGroup: SelectOption<T>[] = [];
  options.forEach((o) => {
    if (o.group) {
      if (!groups[o.group]) groups[o.group] = [];
      groups[o.group].push(o);
    } else {
      noGroup.push(o);
    }
  });

  return (
    <div className={`custom-select ${className || ""}`} style={{ position: "relative", ...style }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="form-input"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left", width: "100%", boxShadow: open ? "var(--neu-inset), 0 0 0 3.5px rgba(232,93,4,0.16)" : "var(--neu-inset)" }}
      >
        <span>{selectedOption ? selectedOption.label : "Sélectionner..."}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none", color: "var(--muted)" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, width: "100%", zIndex: 100,
          background: "var(--card)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--border)", borderRadius: "12px",
          boxShadow: "var(--neu-raised-lg)", padding: "6px", maxHeight: "300px", overflowY: "auto",
        }}>
          {noGroup.length > 0 && noGroup.map((o) => (
            <OptionItem key={String(o.value)} option={o} isSelected={value === o.value} onSelect={() => { onChange(o.value); setOpen(false); }} />
          ))}
          {Object.keys(groups).map((groupLabel) => (
            <div key={groupLabel}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", padding: "8px 10px 4px 10px", letterSpacing: "0.5px" }}>
                {groupLabel}
              </div>
              {groups[groupLabel].map((o) => (
                <OptionItem key={String(o.value)} option={o} isSelected={value === o.value} onSelect={() => { onChange(o.value); setOpen(false); }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionItem<T extends string | number>({ option, isSelected, onSelect }: { option: SelectOption<T>, isSelected: boolean, onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "8px 10px", fontSize: "13px", cursor: "pointer", borderRadius: "8px",
        background: isSelected ? "var(--border)" : hover ? "rgba(31, 27, 22, 0.04)" : "transparent",
        color: isSelected ? "var(--orange-text)" : "var(--text)", fontWeight: isSelected ? "600" : "500",
        transition: "background 100ms", display: "flex", alignItems: "center"
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {option.label}
    </div>
  );
}

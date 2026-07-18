"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SCREENS = [
  { href: "/", label: "Éditeur" },
  { href: "/jobs", label: "Offres" },
  { href: "/history", label: "Historique" },
];

/**
 * Navigation segmentée des trois écrans (Éditeur / Offres / Historique),
 * avec curseur coulissant — design « Refonte Atelier ».
 */
export default function SegmentedNav() {
  const pathname = usePathname();
  const index = Math.max(0, SCREENS.findIndex(
    (s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)),
  ));

  return (
    <nav className="seg" aria-label="Navigation principale" style={{ "--seg-index": index } as React.CSSProperties}>
      <span className="seg__knob" aria-hidden="true" />
      {SCREENS.map((s, i) => (
        <Link key={s.href} href={s.href} className={`seg__btn${i === index ? " active" : ""}`} aria-current={i === index ? "page" : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

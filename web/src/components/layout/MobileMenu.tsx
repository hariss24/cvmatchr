"use client";

import Link from "next/link";

/**
 * Menu mobile ☰ : navigation secondaire (les actions restent dans TopBar,
 * ce panneau ne fait que les déclencher puis se fermer). Monté uniquement
 * quand `open` est vrai — pas de doublons de noms accessibles sur desktop.
 * Réutilise le pattern visuel du ChatPanel (panneau fixe à droite).
 */
export default function MobileMenu({
  open,
  onClose,
  onNewCv,
  onOpenChat,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  onNewCv: () => void;
  onOpenChat: () => void;
  onToggleTheme: () => void;
}) {
  if (!open) return null;

  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <div className="ui-overlay mobile-menu-overlay" role="presentation" onClick={onClose}>
      <nav
        className="chat-panel open mobile-menu"
        aria-label="Menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-panel__head">
          <span className="chat-panel__title">Menu</span>
          <button type="button" className="form-btn-mini" onClick={onClose} aria-label="Fermer le menu">✕</button>
        </div>

        <button type="button" className="mobile-menu__item" onClick={act(onNewCv)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        <button type="button" className="mobile-menu__item" onClick={act(onOpenChat)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><path d="M10 6 Q 10 14 18 14 Q 10 14 10 22 Q 10 14 2 14 Q 10 14 10 6 Z M 18 1 Q 18 5 22 5 Q 18 5 18 9 Q 18 5 14 5 Q 18 5 18 1 Z" /></svg>
          Assistant IA
        </button>

        <Link href="/jobs" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          Offres
        </Link>

        <Link href="/history" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
          Historique
        </Link>

        <Link href="/profil" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          Mes infos
        </Link>

        <Link href="/help" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          Comment ça marche
        </Link>

        <button type="button" className="mobile-menu__item" onClick={onToggleTheme}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          Thème clair / sombre
        </button>

        <Link href="/settings" className="mobile-menu__item" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          Paramètres & Dashboard
        </Link>
      </nav>
    </div>
  );
}

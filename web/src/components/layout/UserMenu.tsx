"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/state/authStore";
import QuotaBadge from "@/components/auth/QuotaBadge";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

/**
 * Bouton "Utilisateur" du topbar : regroupe authentification Supabase, quota IA,
 * thème, paramètres et profil dans un menu déroulant.
 */
export default function UserMenu({ onToggleTheme }: { onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { user, isConfigured, signInWithGoogle, signOut } = useAuthStore();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="user-menu mobile-hidden" ref={ref}>
      <button
        type="button"
        className="btn-avatar"
        title="Utilisateur"
        aria-label="Menu utilisateur"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {user?.user_metadata?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.user_metadata.avatar_url}
            alt={user.email || "Avatar"}
            style={{ width: 22, height: 22, borderRadius: "50%" }}
          />
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          {user ? (
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.1))" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9em", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.user_metadata?.full_name || user.email}
              </div>
              <div style={{ marginTop: 4 }}>
                <QuotaBadge />
              </div>
            </div>
          ) : isConfigured ? (
            // Bouton Google Identity Services : le jeton est récupéré côté
            // navigateur, donc l'écran Google affiche cvmatchr.fr et non le
            // domaine du projet Supabase. Sans NEXT_PUBLIC_GOOGLE_CLIENT_ID, on
            // se rabat sur la redirection classique pour ne pas perdre la
            // connexion — au prix de l'affichage du domaine Supabase.
            process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
              <GoogleSignInButton />
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signInWithGoogle();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Se connecter avec Google
              </button>
            )
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleTheme();
              setOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            Thème clair / sombre
          </button>
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Paramètres
          </Link>
          <Link href="/profil" role="menuitem" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M7 15h4M15 9h2M15 13h2" /></svg>
            Mes infos
          </Link>

          {user && (
            <button
              type="button"
              role="menuitem"
              style={{ borderTop: "1px solid var(--border, rgba(255,255,255,0.1))" }}
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Déconnexion
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/state/authStore";
import { QuotaGauge } from "@/components/auth/QuotaBadge";

/**
 * Le thème, avec son état visible.
 *
 * Le bouton précédent basculait en aveugle : rien ne disait dans quel sens on
 * allait. Le thème vit dans l'attribut du document — posé avant l'hydratation
 * pour éviter le flash blanc — et non dans un store. On le lit donc au montage,
 * qui n'a lieu qu'à l'ouverture du menu : l'interrupteur montre l'état réel de
 * la page, jamais une copie qui aurait dérivé.
 */
function InterrupteurTheme({ onToggleTheme }: { onToggleTheme: () => void }) {
  const [sombre, setSombre] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark",
  );

  return (
    <button
      type="button"
      className="mm-quiet"
      aria-pressed={sombre}
      onClick={() => {
        onToggleTheme();
        setSombre((v) => !v);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      Thème sombre
      <span className={`mm-switch${sombre ? " is-on" : ""}`} aria-hidden="true" />
    </button>
  );
}

/**
 * Menu mobile ☰.
 *
 * Sur téléphone, ce panneau est la seule porte vers le compte : le menu
 * utilisateur de la barre du haut porte `mobile-hidden`. C'est donc l'écran où
 * l'on se connecte, où l'on lit son solde de crédits, et d'où l'on part vers
 * tout le reste.
 *
 * Il était une pile de neuf boutons rigoureusement identiques : « Nouveau CV »,
 * qui remplace le document en cours, y pesait autant que « Thème clair /
 * sombre ». Trois étages désormais, trois rôles — qui je suis, où je vais, ce
 * que je règle — pour que l'œil trie avant de lire.
 *
 * Monté uniquement quand `open` est vrai : pas de doublons de noms accessibles
 * sur desktop.
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
  const { user, isConfigured, signOut } = useAuthStore();
  const pathname = usePathname();

  if (!open) return null;

  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const nom = user?.user_metadata?.full_name || user?.email || "";
  const initiale = (nom.trim()[0] || "?").toUpperCase();
  const avatar = user?.user_metadata?.avatar_url;

  /**
   * Marque la page courante.
   *
   * ⚠️ En pratique, c'est toujours « Éditeur » aujourd'hui : la barre du haut,
   * et donc ce menu, n'est montée que sur `/` (voir `app/page.tsx`) — les autres
   * écrans ont leur propre barre avec un lien « Retour ». Le repère est écrit
   * pour de bon, pas en dur, afin de dire la vérité le jour où le menu sera
   * atteignable depuis Offres et Candidatures.
   */
  const ici = (href: string) => (pathname === href ? " is-current" : "");

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

        {/* ---- Étage 1 : qui je suis ---- */}
        <div className="mm-account">
          {user ? (
            <>
              <div className="mm-account__row">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="mm-avatar mm-avatar--photo" src={avatar} alt="" />
                ) : (
                  <span className="mm-avatar" aria-hidden="true">{initiale}</span>
                )}
                <span className="mm-account__id">
                  <span className="mm-account__name">{nom}</span>
                  {user.email && nom !== user.email && (
                    <span className="mm-account__mail">{user.email}</span>
                  )}
                </span>
              </div>
              <QuotaGauge />
            </>
          ) : isConfigured ? (
            <div className="mm-signin">
              <p className="mm-signin__pitch">
                Connectez-vous pour que vos CV soient enregistrés et vous suivent d&apos;un
                appareil à l&apos;autre.
              </p>
              <Link href="/connexion" className="mm-google" onClick={onClose}>
                Se connecter
              </Link>
            </div>
          ) : (
            <p className="mm-signin__pitch">Connexion indisponible.</p>
          )}
        </div>

        {/* Action primaire : « Nouveau CV » remplace le document en cours. Ce
            n'est pas une destination, elle ne doit pas y ressembler. */}
        <button type="button" className="mm-primary" onClick={act(onNewCv)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau CV
        </button>

        {/* ---- Étage 2 : où je vais ---- */}
        <div className="mm-section">
          <div className="mm-section__label">Aller à</div>

          <Link href="/" className={`mm-item${ici("/")}`} onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
            Éditeur
          </Link>

          <Link href="/jobs" className={`mm-item${ici("/jobs")}`} onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            Offres
          </Link>

          <Link href="/candidatures" className={`mm-item${ici("/candidatures")}`} onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
            Candidatures
          </Link>

          <button type="button" className="mm-item" onClick={act(onOpenChat)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#FBBF24" stroke="none"><path d="M10 6 Q 10 14 18 14 Q 10 14 10 22 Q 10 14 2 14 Q 10 14 10 6 Z M 18 1 Q 18 5 22 5 Q 18 5 18 9 Q 18 5 14 5 Q 18 5 18 1 Z" /></svg>
            Assistant IA
          </button>
        </div>

        {/* ---- Étage 3 : ce que je règle ---- */}
        <div className="mm-section">
          <div className="mm-section__label">Réglages</div>

          <Link href="/profil" className="mm-quiet" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Mes infos
          </Link>

          <InterrupteurTheme onToggleTheme={onToggleTheme} />

          <Link href="/help" className="mm-quiet" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            Comment ça marche
          </Link>

          <Link href="/settings" className="mm-quiet" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Paramètres
          </Link>
        </div>

        <div className="mm__spacer" />

        {user && (
          <button type="button" className="mm-signout" onClick={act(() => void signOut())}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Déconnexion
          </button>
        )}
      </nav>
    </div>
  );
}

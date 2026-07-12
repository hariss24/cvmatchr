"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile } from "@/lib/storage/db";
import { EMPTY_PROFILE, type UserProfile } from "@/lib/profile/profile";

/**
 * Page « Mes informations » (/profil) : identité saisie une fois, autosave
 * local, réutilisée pour pré-remplir CV et lettres. Champs requis marqués `*`,
 * optionnels repliés.
 */
export default function ProfileView() {
  const router = useRouter();
  const [p, setP] = useState<UserProfile>(EMPTY_PROFILE);
  const [showMore, setShowMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await loadProfile();
      if (existing) setP(existing);
      setLoaded(true);
    })();
  }, []);

  // Autosave débouncé (800 ms) une fois le profil chargé — pas de bouton.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void saveProfile(p), 800);
    return () => clearTimeout(t);
  }, [p, loaded]);

  const set = (patch: Partial<UserProfile>) => setP((prev) => ({ ...prev, ...patch }));

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Mes informations</h1>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn-nav"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Retour
          </button>
        </div>
      </header>

      <div className="pane pack-page" style={{ overflowY: "auto" }}>
        <p className="pack-hint">
          Ces informations pré-remplissent automatiquement tes CV et tes lettres de motivation.
        </p>

        <div className="pack-vars">
          <input className="form-input" placeholder="Prénom *" autoComplete="given-name"
            value={p.prenom} onChange={(e) => set({ prenom: e.target.value })} />
          <input className="form-input" placeholder="Nom *" autoComplete="family-name"
            value={p.nom} onChange={(e) => set({ nom: e.target.value })} />
          <input className="form-input" type="email" placeholder="Email *" autoComplete="email"
            value={p.email} onChange={(e) => set({ email: e.target.value })} />
          <input className="form-input" type="tel" placeholder="Téléphone *" autoComplete="tel"
            value={p.telephone} onChange={(e) => set({ telephone: e.target.value })} />
          <input className="form-input" placeholder="Ville *" autoComplete="address-level2"
            value={p.ville} onChange={(e) => set({ ville: e.target.value })} />
        </div>

        <button
          type="button"
          className="form-btn-mini pack-advanced-toggle"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "▾ Informations complémentaires" : "▸ Informations complémentaires"}
        </button>
        {showMore ? (
          <div className="pack-advanced">
            <input className="form-input" placeholder="LinkedIn" autoComplete="url"
              value={p.linkedin} onChange={(e) => set({ linkedin: e.target.value })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

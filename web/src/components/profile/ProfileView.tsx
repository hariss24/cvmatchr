"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile } from "@/lib/storage/db";
import { EMPTY_PROFILE, type UserProfile } from "@/lib/profile/profile";
import { RemoteError } from "@/lib/storage/remote";
import EtatErreur from "@/components/ui/EtatErreur";
import { toast } from "@/state/uiStore";

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
  const [erreur, setErreur] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErreur(null);
      const existing = await loadProfile();
      if (existing) setP(existing);
      setLoaded(true);
    } catch (e) {
      setErreur(e instanceof RemoteError ? e.message : "Impossible de charger vos informations.");
    }
  }, []);

  useEffect(() => {
    void loadProfile()
      .then((existing) => {
        if (existing) setP(existing);
        setLoaded(true);
      })
      .catch((e) => {
        setErreur(e instanceof RemoteError ? e.message : "Impossible de charger vos informations.");
      });
  }, []);

  // Autosave débouncé (800 ms) une fois le profil chargé — pas de bouton.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      // Un échec d'enregistrement doit se voir : ces informations vivent sur le
      // compte, et l'écran n'a pas de bouton « Enregistrer » qui pourrait le
      // signaler. Avalé, l'échec laissait croire à une saisie conservée.
      // On prévient par un toast plutôt que par `setErreur` : celui-ci remplace
      // le formulaire, ce qui ferait disparaître la saisie en cours.
      saveProfile(p).catch((e) => {
        toast(
          e instanceof RemoteError ? e.message : "Vos informations n'ont pas pu être enregistrées.",
          "error",
        );
      });
    }, 800);
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
        {erreur ? (
          <EtatErreur message={erreur} onRetry={() => void load()} />
        ) : (
          <>
            <p className="pack-hint">
              Ces informations pré-remplissent automatiquement vos CV et vos lettres de motivation.
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
          </>
        )}
      </div>
    </div>
  );
}

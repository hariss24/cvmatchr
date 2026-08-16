"use client";

import { useEffect, useRef } from "react";
import { useAutoDraft } from "@/lib/storage/useAutoDraft";
import { useAutoSaveCompte } from "@/lib/storage/useAutoSaveCompte";
import { takeSnapshot } from "@/lib/storage/snapshots";
import { useDocStore } from "@/state/docStore";

/**
 * Effets globaux de l'application (sans rendu) :
 * - chargement/sauvegarde automatique du brouillon par type de document ;
 * - enregistrement automatique sur le compte (remplace le bouton « Enregistrer ») ;
 * - snapshot automatique toutes les 5 minutes.
 * Extrait de l'ancien `Toolbar` lors de la refonte UI.
 */
export default function DraftManager() {
  useAutoDraft();
  useAutoSaveCompte();
  const snapshotFingerprint = (s: ReturnType<typeof useDocStore.getState>) =>
    JSON.stringify(s.json);
  const lastAutoSnapshot = useRef<string>(snapshotFingerprint(useDocStore.getState()));

  useEffect(() => {
    const interval = setInterval(() => {
      const current = snapshotFingerprint(useDocStore.getState());
      if (current === lastAutoSnapshot.current) return;
      lastAutoSnapshot.current = current;
      void takeSnapshot("Auto-save");
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || (!e.ctrlKey && !e.metaKey)) return;

      if (e.key === "Enter") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("cvforge:convert"));
        return;
      }

      if (e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("cvforge:open-snapshots"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}

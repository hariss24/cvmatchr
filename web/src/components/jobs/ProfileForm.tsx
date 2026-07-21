"use client";

import { useState } from "react";
import type { JobSearchProfile } from "@/lib/jobs/profile";
import { LocationInput } from "./LocationInput";

export function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: JobSearchProfile;
  onSave: (p: JobSearchProfile) => void;
  onCancel?: () => void;
}) {
  const [profile, setProfile] = useState<JobSearchProfile>(initial);

  const set = (partial: Partial<JobSearchProfile>) => setProfile((p) => ({ ...p, ...partial }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
      <h3 style={{ margin: 0, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>Critères de recherche</h3>
      
      <div>
        <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: "bold" }}>Mots-clés de recherche (API France Travail) :</label>
        <input
          type="text"
          placeholder="Ex: Webmaster, Développeur web"
          value={profile.keywords.join(", ")}
          onChange={(e) => set({ keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          style={{ width: "100%", padding: 8 }}
        />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Séparés par des virgules. France Travail lancera une recherche pour chaque mot-clé et fusionnera les résultats.
        </div>
      </div>

      <LocationInput value={profile.location} onChange={(loc) => set({ location: loc })} />

      <div>
        <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: "bold" }}>Mots-clés exigés dans l&apos;offre (filtre local) :</label>
        <input
          type="text"
          placeholder="Ex: react, next.js"
          value={profile.includeKeywords.join(", ")}
          onChange={(e) => set({ includeKeywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          style={{ width: "100%", padding: 8 }}
        />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          L&apos;offre doit contenir au moins un de ces mots pour être conservée (titre ou description).
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: "bold" }}>Mots exclus (filtre local) :</label>
        <input
          type="text"
          placeholder="Ex: php, python, wordpress"
          value={profile.excludedWords.join(", ")}
          onChange={(e) => set({ excludedWords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          style={{ width: "100%", padding: 8 }}
        />
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          L&apos;offre est ignorée si elle contient un de ces mots.
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={profile.debutantAccepte} onChange={(e) => set({ debutantAccepte: e.target.checked })} />
          Débutant accepté
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        {onCancel && <button onClick={onCancel} className="ui-button" style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}>Annuler</button>}
        <button onClick={() => onSave(profile)} className="ui-button">Enregistrer & Rechercher</button>
      </div>
    </div>
  );
}

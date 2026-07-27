"use client";

import { useState } from "react";
import { domainCandidates } from "@/lib/jobs/board";

/**
 * Favicon du jobboard où l'offre est publiée (LinkedIn, Indeed, France Travail…).
 *
 * Le service de favicons échoue sur certains sous-domaines et renvoie alors un
 * globe générique **en HTTP 404** : le navigateur déclenche `onError`, ce qui
 * fait avancer la cascade. Ne jamais se fier à l'absence d'image pour détecter
 * l'échec — il y a toujours une image dans le corps de la réponse.
 *
 * Compromis assumé (cf. spec §5.3.1) : le service reçoit le domaine de chaque
 * offre affichée, donc Google apprend quels jobboards sont consultés.
 */
export function BoardIcon({ domain, name }: { domain: string; name: string }) {
  const candidates = domainCandidates(domain);
  const [step, setStep] = useState(0);
  const current = candidates[step];

  if (!current) {
    return (
      <span className="job-src" title={name || undefined}>
        <span className="job-src__initial">{name.trim().charAt(0).toUpperCase() || "?"}</span>
      </span>
    );
  }

  return (
    <span className="job-src" title={name ? `Publiée sur ${name}` : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(current)}&sz=64`}
        alt={name || "Jobboard"}
        onError={() => setStep((s) => s + 1)}
      />
    </span>
  );
}

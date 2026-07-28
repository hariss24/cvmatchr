"use client";

import { useState } from "react";

/**
 * Logo d'une entreprise, avec repli sur son initiale.
 *
 * Le logo est résolu côté serveur au moment de la recherche (`lib/jobs/logos.ts`),
 * contre l'annuaire Brandfetch. Ce composant ne devine rien : il affiche ce qu'on
 * lui donne, et retombe sur l'initiale si l'URL est absente ou ne charge pas.
 */
export function CompanyLogo({ logoUrl, company }: { logoUrl: string; company: string }) {
  const [casse, setCasse] = useState(false);

  if (!logoUrl || casse) {
    return (
      <span className="job-logo__initial" data-testid="job-logo-initial">
        {company.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={company || "Entreprise"}
      loading="lazy"
      data-testid="job-logo-img"
      onError={() => setCasse(true)}
    />
  );
}

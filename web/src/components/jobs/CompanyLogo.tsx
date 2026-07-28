"use client";

import { useState } from "react";

/**
 * Logo d'une entreprise, avec repli en cascade sur son initiale.
 *
 * Seul JSearch renvoie un vrai logo ; France Travail n'en fournit qu'exception-
 * nellement et Adzuna jamais. Sans repli, la quasi-totalité des cartes affichait
 * une lettre grise. On tente donc le favicon du site de l'entreprise, deviné
 * depuis sa raison sociale.
 *
 * DuckDuckGo est préféré au service équivalent de Google parce qu'il répond 404
 * sur un domaine inconnu : `onError` se déclenche et le repli suivant prend la
 * main. Google renvoie un globe générique, indistinguable d'un vrai logo.
 *
 * Le domaine étant deviné, un homonyme peut afficher le logo d'une autre société.
 * C'est le prix de l'absence de source fiable, et il reste préférable à une
 * grille de lettres grises.
 */

/** Suffixes juridiques et mentions de forme qui ne font pas partie du domaine. */
const SUFFIXES = /\b(sa|sas|sasu|sarl|eurl|sci|scop|group|groupe|france|holding|international|consulting|corp|inc|ltd)\b/g;

/** « Fed Group » → « fed » ; "" si rien d'exploitable ne subsiste. */
export function domainSlug(company: string): string {
  // NFD sépare les accents de leur lettre ; le filtre final les élimine avec le
  // reste de la ponctuation, sans avoir à viser les diacritiques explicitement.
  const base = company
    .toLowerCase()
    .normalize("NFD")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9]/g, "");
  // Deux caractères ne suffisent pas à identifier un domaine sans faux positifs.
  return base.length >= 3 ? base : "";
}

function faviconUrl(slug: string, tld: string): string {
  return `https://icons.duckduckgo.com/ip3/${slug}.${tld}.ico`;
}

export function CompanyLogo({ logoUrl, company }: { logoUrl: string; company: string }) {
  const slug = domainSlug(company);
  // Sources tentées dans l'ordre : celle de la source, puis .fr (le marché visé),
  // puis .com. Chaque échec fait avancer l'index ; au bout, l'initiale.
  const sources = [logoUrl, ...(slug ? [faviconUrl(slug, "fr"), faviconUrl(slug, "com")] : [])]
    .filter(Boolean);
  const [i, setI] = useState(0);

  if (i >= sources.length) {
    return (
      <span className="job-logo__initial" data-testid="job-logo-initial">
        {company.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[i]}
      alt={company || "Entreprise"}
      loading="lazy"
      data-testid="job-logo-img"
      onError={() => setI((n) => n + 1)}
    />
  );
}

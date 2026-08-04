"use client";

import { SOURCES, type SourceToggles } from "@/lib/jobs/sources";
import type { SourceId } from "@/lib/jobs/offer";
import { BoardIcon } from "./BoardIcon";

/**
 * Domaine de chaque source, pour afficher son favicon (aucun logo stocké).
 *
 * `boards` n'en a pas : ses offres viennent de quatre ATS différents, aucun
 * domaine ne la représente. `BoardIcon` retombe alors sur l'initiale, comme
 * pour toute entreprise sans logo résolu.
 */
export const SOURCE_DOMAIN: Record<SourceId, string> = {
  francetravail: "francetravail.fr",
  jsearch: "google.com",
  adzuna: "adzuna.fr",
  boards: "",
};

/**
 * Choix des sources à interroger. Vit dans la pastille « Où chercher » de la barre
 * de filtres. Affiche la consommation API par rapport aux quotas (usage).
 *
 * Décocher une source signifie **ne pas l'interroger** — pas masquer ses
 * résultats : c'est la seule sémantique qui préserve réellement le quota.
 */
export function SourcePicker({
  value, onChange, usage,
}: {
  value: SourceToggles;
  onChange: (v: SourceToggles) => void;
  usage: Record<SourceId, number>;
}) {
  return (
    <>
      <div className="flt-menu__title">Où chercher</div>
      {SOURCES.map((s) => (
        <label key={s.id} className="flt-opt">
          <input
            type="checkbox"
            checked={value[s.id]}
            aria-label={s.label}
            onChange={() => onChange({ ...value, [s.id]: !value[s.id] })}
          />
          <BoardIcon domain={SOURCE_DOMAIN[s.id]} name={s.label} />
          {s.label}
          <span className="flt-opt__sub">
            {s.monthlyQuota == null ? "illimité" : `${usage[s.id]}/${s.monthlyQuota}`}
          </span>
        </label>
      ))}
      <div className="flt-menu__sep" />
      <p className="flt-menu__note">
        Décocher une source, c&apos;est ne pas l&apos;interroger : son quota mensuel est
        préservé. Compteur local et indicatif, remis à zéro chaque mois.
      </p>
    </>
  );
}

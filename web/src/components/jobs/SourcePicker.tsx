"use client";

import { SOURCES, type SourceToggles } from "@/lib/jobs/sources";
import type { SourceId } from "@/lib/jobs/offer";
import { BoardIcon } from "./BoardIcon";

/** Domaine de chaque source, pour afficher son favicon (aucun logo stocké). */
const SOURCE_DOMAIN: Record<SourceId, string> = {
  francetravail: "francetravail.fr",
  jsearch: "google.com",
  adzuna: "adzuna.fr",
};

/**
 * Choix des sources à interroger. Vit dans le panneau « Mes critères », replié
 * par défaut : rien n'est ajouté à l'écran principal (cf. spec §5.2).
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
    <div className="jf-sources">
      <span className="jf-label">Où chercher</span>
      <div className="jf-sources-row">
        {SOURCES.map((s) => (
          <label key={s.id} className={`jf-source ${value[s.id] ? "is-on" : ""}`}>
            <input
              type="checkbox"
              checked={value[s.id]}
              aria-label={s.label}
              onChange={() => onChange({ ...value, [s.id]: !value[s.id] })}
            />
            <BoardIcon domain={SOURCE_DOMAIN[s.id]} name={s.label} />
            <span className="jf-source-name">{s.label}</span>
            <span className="jf-source-quota">
              {s.monthlyQuota == null ? "illimité" : `${usage[s.id]}/${s.monthlyQuota} ce mois`}
            </span>
          </label>
        ))}
      </div>
      <p className="jf-note">
        Décocher une source, c&apos;est ne pas l&apos;interroger — le quota mensuel est préservé.
        Ce compteur mesure ce que ce navigateur a consommé, il est indicatif.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { JobSearchProfile } from "@/lib/jobs/profile";
import type { SourceId } from "@/lib/jobs/offer";
import { FilterPill } from "./FilterPill";
import { LocationInput } from "./LocationInput";
import { MetierInput } from "./MetierInput";
import { SourcePicker, SOURCE_DOMAIN } from "./SourcePicker";
import { BoardIcon } from "./BoardIcon";
import { MoreFilters } from "./MoreFilters";
import {
  CONTRACT_OPTIONS,
  AGE_OPTIONS,
  EXPERIENCE_OPTIONS,
  WORK_TIME_OPTIONS,
  contractLabel,
  ageLabel,
  experienceLabel,
  workTimeLabel,
  sourcesLabel,
  moreFiltersCount,
  hasActiveFilters,
  resetFilters,
} from "@/lib/jobs/filters";

export function FilterBar({
  profile,
  onChange,
  usage,
  resultCount,
  canScan,
  scanning,
  onScan,
}: {
  profile: JobSearchProfile;
  onChange: (profile: JobSearchProfile) => void;
  usage: Record<SourceId, number>;
  resultCount: number;
  canScan: boolean;
  scanning: boolean;
  onScan: () => void;
}) {
  const [showMore, setShowMore] = useState(false);

  const set = (key: keyof JobSearchProfile, value: unknown) => {
    onChange({ ...profile, [key]: value });
  };

  const moreCount = moreFiltersCount(profile);

  return (
    <section className="flt" aria-label="Filtres">
      {/* Étage 1 : Recherche */}
      <div className="flt-search">
        {/* `.flt-box` porte le fond, le creux et le padding ; `--role`/`--place`
            ne sont que des modificateurs de largeur. C'est aussi `.flt-box` qui
            scope l'aplatissement de MetierInput/LocationInput dans la barre. */}
        <div className="flt-box flt-box--role">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <MetierInput
            values={profile.keywords}
            onChange={(k) => set("keywords", k)}
            /* Le code ROME de l'appellation officielle alimente `romeCodes`, qui
               porte tout le volet structuré du classement. Sans lui, ni bonus
               métier ni malus anti-bruit. */
            onRomeAdd={(rome) =>
              set("romeCodes", profile.romeCodes.includes(rome)
                ? profile.romeCodes
                : [...profile.romeCodes, rome])
            }
          />
        </div>
        <div className="flt-box flt-box--place">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <LocationInput
            value={profile.location}
            onChange={(loc) => set("location", loc)}
          />
        </div>
        <button
          type="button"
          className="flt-go"
          data-testid="jobs-scan"
          disabled={!canScan || scanning}
          onClick={onScan}
        >
          {scanning ? "Recherche en cours…" : "Rechercher"}
        </button>
      </div>

      {/* Étage 2 : Filtres */}
      <div className="flt-row">
        <FilterPill label="Contrat" value={contractLabel(profile.contractTypes)}>
          <>
            {CONTRACT_OPTIONS.map((c) => {
              const checked = profile.contractTypes.includes(c.code);
              return (
                <label key={c.code} className="flt-opt">
                  <input
                    type="checkbox"
                    className="flt-opt__cb"
                    checked={checked}
                    onChange={() => {
                      const nt = checked
                        ? profile.contractTypes.filter((x) => x !== c.code)
                        : [...profile.contractTypes, c.code];
                      set("contractTypes", nt);
                    }}
                  />
                  <span>{c.label}</span>
                </label>
              );
            })}
          </>
        </FilterPill>

        <FilterPill label="Publiée depuis" value={ageLabel(profile.maxAgeDays)}>
          <>
            <button
              type="button"
              className="flt-opt"
              onClick={() => set("maxAgeDays", 30)}
            >
              <span>Peu importe</span>
              {profile.maxAgeDays === 30 && <span className="flt-opt__tick" />}
            </button>
            {AGE_OPTIONS.map((a) => (
              <button
                key={a.days}
                type="button"
                className="flt-opt"
                onClick={() => set("maxAgeDays", a.days)}
              >
                <span>{a.label}</span>
                {profile.maxAgeDays === a.days && <span className="flt-opt__tick" />}
              </button>
            ))}
          </>
        </FilterPill>

        <FilterPill label="Expérience" value={experienceLabel(profile.experienceLevel, profile.debutantAccepte)}>
          <>
            {EXPERIENCE_OPTIONS.map((e) => (
              <button
                key={e.value}
                type="button"
                className="flt-opt"
                onClick={() => set("experienceLevel", e.value)}
              >
                <span>{e.label}</span>
                {profile.experienceLevel === e.value && <span className="flt-opt__tick" />}
              </button>
            ))}
            <div className="flt-menu__sep" />
            <label className="flt-opt">
              <input
                type="checkbox"
                className="flt-opt__cb"
                checked={profile.debutantAccepte}
                onChange={(e) => set("debutantAccepte", e.target.checked)}
              />
              <span>Débutant accepté</span>
            </label>
          </>
        </FilterPill>

        <FilterPill label="Temps de travail" value={workTimeLabel(profile.tempsPlein)}>
          <>
            {WORK_TIME_OPTIONS.map((w) => (
              <button
                key={w.value}
                type="button"
                className="flt-opt"
                onClick={() => set("tempsPlein", w.value)}
              >
                <span>{w.label}</span>
                {profile.tempsPlein === w.value && <span className="flt-opt__tick" />}
              </button>
            ))}
          </>
        </FilterPill>

        <FilterPill
          label="Où chercher"
          value={sourcesLabel(profile.sources)}
          /* Favicons servis à la volée, jamais de logo stocké dans le dépôt :
             c'est la décision prise pour la carte d'offre, elle vaut ici. */
          icon={
            <span className="flt-pill__srcs" aria-hidden="true">
              {(Object.keys(SOURCE_DOMAIN) as SourceId[]).map((id) => (
                <BoardIcon key={id} domain={SOURCE_DOMAIN[id]} name="" />
              ))}
            </span>
          }
        >
          <SourcePicker
            value={profile.sources}
            onChange={(s) => set("sources", s)}
            usage={usage}
          />
        </FilterPill>

        <button
          type="button"
          className={`flt-pill ${showMore ? "is-open" : ""}`}
          onClick={() => setShowMore(!showMore)}
        >
          <span>Plus de filtres</span>
          {moreCount > 0 && <span className="flt-count">{moreCount}</span>}
        </button>

        <div className="flt-spacer" />

        <div className="flt-results">{resultCount} offres retenues</div>

        {hasActiveFilters(profile) && (
          <button
            type="button"
            className="flt-reset"
            onClick={() => onChange(resetFilters(profile))}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {showMore && (
        <MoreFilters
          profile={profile}
          onChange={(updates) => onChange({ ...profile, ...updates })}
        />
      )}
    </section>
  );
}

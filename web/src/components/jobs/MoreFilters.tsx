"use client";

import type { JobSearchProfile } from "@/lib/jobs/profile";
import { TagInput } from "./TagInput";

export function MoreFilters({
  profile,
  onChange,
}: {
  profile: JobSearchProfile;
  onChange: (updates: Partial<JobSearchProfile>) => void;
}) {
  const set = (key: keyof JobSearchProfile, value: unknown) => {
    onChange({ [key]: value });
  };

  return (
    <div className="flt-more">
      {/* 1. Compétences */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-skills">Vos compétences</label>
        <TagInput
          id="flt-skills"
          values={profile.prefilterKeywords}
          onChange={(v) => set("prefilterKeywords", v)}
          placeholder="Ex. wordpress, seo, analytics"
        />
        <span className="flt-field__note">Le critère le plus lourd du classement. Aucune offre n&apos;est écartée.</span>
      </div>

      {/* 2. Mots à exclure */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-exclude">Mots à exclure</label>
        <TagInput
          id="flt-exclude"
          values={profile.excludedWords}
          onChange={(v) => set("excludedWords", v)}
          placeholder="Ex. stagiaire, alternance"
        />
      </div>

      {/* 3. Mots-clés à inclure */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-include">Mots-clés à inclure dans l&apos;offre</label>
        <TagInput
          id="flt-include"
          values={profile.includeKeywords}
          onChange={(v) => set("includeKeywords", v)}
          placeholder="Le mot doit apparaître (titre ou description)"
        />
      </div>

      {/* 4. Salaire minimum */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-salary">Salaire minimum</label>
        <input
          id="flt-salary"
          className="flt-text"
          type="number"
          min={0}
          value={profile.salaireMin ?? ""}
          onChange={(e) => set("salaireMin", e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>

      {/* 5. Période */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-period">Période</label>
        <select
          id="flt-period"
          className="flt-select"
          value={profile.periodeSalaire}
          onChange={(e) => set("periodeSalaire", e.target.value as JobSearchProfile["periodeSalaire"])}
        >
          <option value="M">Mensuel</option>
          <option value="A">Annuel</option>
          <option value="H">Horaire</option>
        </select>
      </div>

      {/* 6. Qualification */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-qual">Qualification</label>
        <select
          id="flt-qual"
          className="flt-select"
          value={profile.qualification}
          onChange={(e) => set("qualification", e.target.value as JobSearchProfile["qualification"])}
        >
          <option value="">Indifférent</option>
          <option value="0">Non-cadre</option>
          <option value="9">Cadre</option>
        </select>
      </div>

      {/* 7. Codes ROME */}
      <div className="flt-field">
        <label className="flt-field__label" htmlFor="flt-rome">Codes ROME (optionnel)</label>
        <TagInput
          id="flt-rome"
          values={profile.romeCodes}
          onChange={(v) => set("romeCodes", v)}
          placeholder="Ex. E1104"
        />
      </div>

      {/* 8. Adresse de départ */}
      <div className="flt-field flt-field--wide">
        <label className="flt-field__label" htmlFor="flt-address">Adresse de départ (calcul du trajet)</label>
        <input
          id="flt-address"
          className="flt-text"
          type="text"
          value={profile.homeAddress}
          onChange={(e) => set("homeAddress", e.target.value)}
          placeholder="Ex. 10 rue de Paris, 75012 Paris"
        />
      </div>
    </div>
  );
}

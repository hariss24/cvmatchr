"use client";

import { useState } from "react";
import type { JobSearchProfile } from "@/lib/jobs/profile";
import type { SourceId } from "@/lib/jobs/offer";
import { LocationInput } from "./LocationInput";
import { MetierInput } from "./MetierInput";
import { SourcePicker } from "./SourcePicker";

const CONTRACT_OPTIONS = [
  { code: "CDI", label: "CDI" },
  { code: "CDD", label: "CDD" },
  { code: "MIS", label: "Intérim" },
  { code: "SAI", label: "Saisonnier" },
];

/** Éditeur de liste de tags (mots-clés, mots exclus, compétences, codes ROME). */
function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft("");
  }
  return (
    <div className="jf-tags-field">
      {values.length > 0 && (
        <div className="jf-tags">
          {values.map((v) => (
            <span key={v} className="jf-tag">
              {v}
              <button type="button" aria-label={`Retirer ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        className="ui-input"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

export function ProfileForm({
  profile,
  onChange,
  usage,
}: {
  profile: JobSearchProfile;
  onChange: (p: JobSearchProfile) => void;
  usage: Record<SourceId, number>;
}) {
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof JobSearchProfile>(k: K, v: JobSearchProfile[K]) => onChange({ ...profile, [k]: v });

  function toggleContract(code: string) {
    const has = profile.contractTypes.includes(code);
    set("contractTypes", has ? profile.contractTypes.filter((x) => x !== code) : [...profile.contractTypes, code]);
  }

  return (
    <section className="jobs-form" aria-label="Mes critères de recherche">
      <header className="jf-head">
        <h3 className="jf-title">Mes critères de recherche</h3>
        <p className="jf-hint">Ces critères pilotent la recherche sur les sources choisies et le tri des offres.</p>
      </header>

      {/* Bloc principal */}
      <div className="jf-primary">
        <div className="jf-field jf-field--wide">
          <label className="jf-label">Poste(s) recherché(s)</label>
          <MetierInput values={profile.keywords} onChange={(v) => set("keywords", v)} />
          <span className="jf-note">Autocomplétion sur les métiers officiels France Travail. Une recherche par intitulé, résultats fusionnés.</span>
        </div>

        <div className="jf-field jf-field--wide">
          <label className="jf-label">Lieu</label>
          <LocationInput value={profile.location} onChange={(l) => set("location", l)} />
        </div>
      </div>

      {/* Filtres rapides */}
      <div className="jf-filters">
        <div className="jf-filters-row">
          <div className="jf-field">
            <label className="jf-label">Type de contrat</label>
            <div className="jf-chips">
              {CONTRACT_OPTIONS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`jf-chip ${profile.contractTypes.includes(c.code) ? "is-on" : ""}`}
                  onClick={() => toggleContract(c.code)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="ui-switch-row jf-switch"
            role="switch"
            aria-checked={profile.debutantAccepte}
            onClick={() => set("debutantAccepte", !profile.debutantAccepte)}
          >
            <span className="ui-switch-label">
              <span className="ui-switch-title">Débutant accepté</span>
              <span className="ui-switch-hint">Offres ouvertes aux profils sans expérience.</span>
            </span>
            <span className="ui-switch" aria-checked={profile.debutantAccepte}>
              <span className="ui-switch-knob" />
            </span>
          </button>
        </div>

        <div className="jf-grid">
          <label className="jf-field">
            <span className="jf-label">Expérience</span>
            <select className="jf-select" value={profile.experienceLevel}
              onChange={(e) => set("experienceLevel", e.target.value as JobSearchProfile["experienceLevel"])}>
              <option value="">Indifférent</option>
              <option value="1">Moins d&apos;un an</option>
              <option value="2">1 à 3 ans</option>
              <option value="3">Plus de 3 ans</option>
            </select>
          </label>
          <label className="jf-field">
            <span className="jf-label">Temps de travail</span>
            <select className="jf-select" value={profile.tempsPlein}
              onChange={(e) => set("tempsPlein", e.target.value as JobSearchProfile["tempsPlein"])}>
              <option value="">Indifférent</option>
              <option value="true">Temps plein</option>
              <option value="false">Temps partiel</option>
            </select>
          </label>
          <label className="jf-field">
            <span className="jf-label">Qualification</span>
            <select className="jf-select" value={profile.qualification}
              onChange={(e) => set("qualification", e.target.value as JobSearchProfile["qualification"])}>
              <option value="">Indifférent</option>
              <option value="0">Non-cadre</option>
              <option value="9">Cadre</option>
            </select>
          </label>
          <label className="jf-field">
            <span className="jf-label">Ancienneté max</span>
            <select className="jf-select" value={profile.maxAgeDays}
              onChange={(e) => set("maxAgeDays", Number(e.target.value))}>
              <option value={1}>1 jour</option>
              <option value={3}>3 jours</option>
              <option value={7}>7 jours</option>
              <option value={14}>14 jours</option>
              <option value={30}>30 jours</option>
            </select>
          </label>
        </div>
      </div>

      {/* Avancé */}
      <button type="button" className="jf-adv-toggle" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
        {advanced ? "▾ Masquer les critères avancés" : "▸ Critères avancés"}
      </button>

      {advanced && (
        <div className="jf-advanced">
          <div className="jf-field">
            <label className="jf-label">Mots-clés à inclure dans l&apos;offre</label>
            <TagInput values={profile.includeKeywords} onChange={(v) => set("includeKeywords", v)}
              placeholder="Le mot doit apparaître (titre ou description)" />
          </div>
          <div className="jf-field">
            <label className="jf-label">Mots à exclure</label>
            <TagInput values={profile.excludedWords} onChange={(v) => set("excludedWords", v)}
              placeholder="Ex. stagiaire, alternance" />
          </div>
          <div className="jf-field">
            <label className="jf-label">Compétences (pré-tri gratuit)</label>
            <TagInput values={profile.prefilterKeywords} onChange={(v) => set("prefilterKeywords", v)}
              placeholder="Ex. wordpress, seo, analytics" />
            <span className="jf-note">Écarte sans IA les offres sans aucun recoupement.</span>
          </div>
          <div className="jf-field">
            <label className="jf-label">Codes ROME (optionnel)</label>
            <TagInput values={profile.romeCodes} onChange={(v) => set("romeCodes", v)} placeholder="Ex. E1104" />
          </div>

          <div className="jf-grid">
            <label className="jf-field">
              <span className="jf-label">Salaire min</span>
              <input type="number" className="ui-input" min={0} value={profile.salaireMin ?? ""}
                onChange={(e) => set("salaireMin", e.target.value === "" ? null : Number(e.target.value))} />
            </label>
            <label className="jf-field">
              <span className="jf-label">Période</span>
              <select className="jf-select" value={profile.periodeSalaire}
                onChange={(e) => set("periodeSalaire", e.target.value as JobSearchProfile["periodeSalaire"])}>
                <option value="M">Mensuel</option>
                <option value="A">Annuel</option>
                <option value="H">Horaire</option>
              </select>
            </label>
            <label className="jf-field">
              <span className="jf-label">Score minimum</span>
              <input type="number" className="ui-input" min={0} max={100} value={profile.minScore}
                onChange={(e) => set("minScore", Number(e.target.value))} />
            </label>
            <label className="jf-field">
              <span className="jf-label">Offres notées / scan</span>
              <input type="number" className="ui-input" min={1} max={100} value={profile.aiShortlist}
                onChange={(e) => set("aiShortlist", Number(e.target.value))} />
            </label>
          </div>

          <div className="jf-field">
            <label className="jf-label">Adresse de départ (calcul du trajet)</label>
            <input type="text" className="ui-input" value={profile.homeAddress}
              onChange={(e) => set("homeAddress", e.target.value)} placeholder="Ex. 10 rue de Paris, 75012 Paris" />
          </div>

          <div className="jf-field">
            <label className="jf-label">Résumé candidat (pour la notation IA)</label>
            <textarea className="ui-input jf-textarea" rows={5} value={profile.candidateSummary}
              onChange={(e) => set("candidateSummary", e.target.value)}
              placeholder="Titre, formation, expériences, compétences clés…" />
          </div>

          <SourcePicker
            value={profile.sources}
            onChange={(s) => set("sources", s)}
            usage={usage}
          />
        </div>
      )}
    </section>
  );
}

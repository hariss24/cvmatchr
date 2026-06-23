"use client";

import { useDocStore } from "@/state/docStore";
import type { Resume } from "@/lib/resume/schema";

/**
 * Formulaire structuré (mode Formulaire). Lit le CV courant dans le store et applique
 * chaque modification via `setJson` → re-rend l'aperçu (déjà branché).
 *
 * Étape 3 (en cours) : infos perso (+ photo base64), résumé, compétences. Les autres sections
 * (expérience, formation, langues, projets, certifs, bénévolat, intérêts) et le formulaire Lettre
 * suivront. La photo base64 est stockée telle quelle ici ; elle n'est JAMAIS envoyée à l'IA (Phase 5).
 */
export default function FormEditor() {
  const docType = useDocStore((s) => s.docType);
  const json = useDocStore((s) => s.json);
  const setJson = useDocStore((s) => s.setJson);

  if (docType !== "CV") {
    return (
      <div className="pane-body">
        <div className="pane-placeholder">Le formulaire Lettre arrivera bientôt.</div>
      </div>
    );
  }

  const cv = json as Resume;
  const update = (patch: Partial<Resume>) => setJson({ ...cv, ...patch });

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const setSkill = (i: number, value: string) => {
    const skills = cv.skills.slice();
    skills[i] = value;
    update({ skills });
  };
  const addSkill = () => update({ skills: [...cv.skills, ""] });
  const removeSkill = (i: number) => update({ skills: cv.skills.filter((_, j) => j !== i) });

  return (
    <>
      <div className="pane-title">
        <span>Éditeur — Formulaire</span>
      </div>
      <div className="pane-body form-editor">
        <section className="form-section">
          <h3 className="form-section__title">Informations personnelles</h3>
          <div className="form-grid">
            <Field label="Nom complet" value={cv.name} onChange={(v) => update({ name: v })} />
            <Field label="Titre du poste" value={cv.title} onChange={(v) => update({ title: v })} />
            <Field label="Ville, Pays" value={cv.location} onChange={(v) => update({ location: v })} />
            <Field label="Email" value={cv.email} onChange={(v) => update({ email: v })} />
            <Field label="Téléphone" value={cv.phone} onChange={(v) => update({ phone: v })} />
            <Field label="LinkedIn" value={cv.linkedin} onChange={(v) => update({ linkedin: v })} />
          </div>
          <div className="form-field">
            <label className="form-label">Photo</label>
            <input type="file" accept="image/*" onChange={onPhoto} />
            {cv.photo ? (
              <button type="button" className="form-btn-mini" onClick={() => update({ photo: "" })}>
                Retirer la photo
              </button>
            ) : null}
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section__title">À propos</h3>
          <textarea
            className="form-textarea"
            rows={4}
            value={cv.summary}
            onChange={(e) => update({ summary: e.target.value })}
          />
        </section>

        <section className="form-section">
          <h3 className="form-section__title">Compétences</h3>
          {cv.skills.map((skill, i) => (
            <div key={i} className="form-row">
              <input
                className="form-input"
                value={skill}
                onChange={(e) => setSkill(i, e.target.value)}
              />
              <button
                type="button"
                className="form-btn-mini"
                aria-label="Supprimer la compétence"
                onClick={() => removeSkill(i)}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="form-btn-add" onClick={addSkill}>
            + Ajouter une compétence
          </button>
        </section>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <input className="form-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

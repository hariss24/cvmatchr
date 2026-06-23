"use client";

import { useDocStore } from "@/state/docStore";
import type {
  Resume,
  ExperienceItem,
  EducationItem,
  LanguageItem,
  ProjectItem,
  VolunteerItem,
} from "@/lib/resume/schema";

/**
 * Formulaire structuré (mode Formulaire). Lit le CV courant dans le store et applique
 * chaque modification via `setJson` → re-rend l'aperçu (déjà branché).
 *
 * Toutes les sections du CV sont éditables. Le formulaire Lettre suivra (étape 4).
 * La photo base64 est stockée telle quelle ; elle n'est JAMAIS envoyée à l'IA (Phase 5).
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

        <ExperienceSection items={cv.experience} onChange={(v) => update({ experience: v })} />
        <EducationSection items={cv.education} onChange={(v) => update({ education: v })} />
        <StringListSection
          title="Compétences"
          addLabel="+ Ajouter une compétence"
          items={cv.skills}
          onChange={(v) => update({ skills: v })}
        />
        <LanguagesSection items={cv.languages} onChange={(v) => update({ languages: v })} />
        <ProjectsSection items={cv.projects} onChange={(v) => update({ projects: v })} />
        <StringListSection
          title="Certifications"
          addLabel="+ Ajouter une certification"
          items={cv.certifications}
          onChange={(v) => update({ certifications: v })}
        />
        <VolunteerSection items={cv.volunteer} onChange={(v) => update({ volunteer: v })} />
        <StringListSection
          title="Centres d'intérêt"
          addLabel="+ Ajouter un centre d'intérêt"
          items={cv.interests}
          onChange={(v) => update({ interests: v })}
        />
      </div>
    </>
  );
}

// ---- Helpers de liste ----

function replaceAt<T>(list: T[], i: number, item: T): T[] {
  return list.map((x, j) => (j === i ? item : x));
}
function removeAt<T>(list: T[], i: number): T[] {
  return list.filter((_, j) => j !== i);
}

// ---- Champs génériques ----

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

/** En-tête d'un item de liste avec bouton de suppression. */
function ItemCard({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="form-item">
      <button
        type="button"
        className="form-btn-mini form-item__remove"
        aria-label="Supprimer l'élément"
        onClick={onRemove}
      >
        ✕
      </button>
      {children}
    </div>
  );
}

// ---- Sections « liste de chaînes » (compétences, certifications, intérêts) ----

function StringListSection({
  title,
  addLabel,
  items,
  onChange,
}: {
  title: string;
  addLabel: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <section className="form-section">
      <h3 className="form-section__title">{title}</h3>
      {items.map((value, i) => (
        <div key={i} className="form-row">
          <input
            className="form-input"
            value={value}
            onChange={(e) => onChange(replaceAt(items, i, e.target.value))}
          />
          <button
            type="button"
            className="form-btn-mini"
            aria-label="Supprimer"
            onClick={() => onChange(removeAt(items, i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </section>
  );
}

// ---- Éditeur de puces (expérience, bénévolat) ----

function BulletsEditor({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  return (
    <div className="form-field">
      <label className="form-label">Réalisations</label>
      {bullets.map((b, i) => (
        <div key={i} className="form-row">
          <input
            className="form-input"
            value={b}
            onChange={(e) => onChange(replaceAt(bullets, i, e.target.value))}
          />
          <button
            type="button"
            className="form-btn-mini"
            aria-label="Supprimer la puce"
            onClick={() => onChange(removeAt(bullets, i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="form-btn-mini" onClick={() => onChange([...bullets, ""])}>
        + Ajouter une puce
      </button>
    </div>
  );
}

// ---- Sections « liste d'objets » ----

const EMPTY_EXPERIENCE: ExperienceItem = {
  title: "", company: "", contract: "", location: "", date: "", bullets: [],
};
const EMPTY_EDUCATION: EducationItem = { title: "", school: "", location: "", date: "" };
const EMPTY_LANGUAGE: LanguageItem = { name: "", level: "" };
const EMPTY_PROJECT: ProjectItem = { title: "", date: "", description: "" };
const EMPTY_VOLUNTEER: VolunteerItem = {
  title: "", organization: "", location: "", date: "", bullets: [],
};

function ExperienceSection({
  items,
  onChange,
}: {
  items: ExperienceItem[];
  onChange: (items: ExperienceItem[]) => void;
}) {
  const patch = (i: number, p: Partial<ExperienceItem>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Expériences</h3>
      {items.map((e, i) => (
        <ItemCard key={i} onRemove={() => onChange(removeAt(items, i))}>
          <div className="form-grid">
            <Field label="Poste" value={e.title} onChange={(v) => patch(i, { title: v })} />
            <Field label="Entreprise" value={e.company} onChange={(v) => patch(i, { company: v })} />
            <Field label="Contrat" value={e.contract} onChange={(v) => patch(i, { contract: v })} />
            <Field label="Lieu" value={e.location} onChange={(v) => patch(i, { location: v })} />
            <Field label="Date" value={e.date} onChange={(v) => patch(i, { date: v })} />
          </div>
          <BulletsEditor bullets={e.bullets} onChange={(b) => patch(i, { bullets: b })} />
        </ItemCard>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_EXPERIENCE }])}>
        + Ajouter une expérience
      </button>
    </section>
  );
}

function EducationSection({
  items,
  onChange,
}: {
  items: EducationItem[];
  onChange: (items: EducationItem[]) => void;
}) {
  const patch = (i: number, p: Partial<EducationItem>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Formations</h3>
      {items.map((e, i) => (
        <ItemCard key={i} onRemove={() => onChange(removeAt(items, i))}>
          <div className="form-grid">
            <Field label="Diplôme" value={e.title} onChange={(v) => patch(i, { title: v })} />
            <Field label="Établissement" value={e.school} onChange={(v) => patch(i, { school: v })} />
            <Field label="Lieu" value={e.location} onChange={(v) => patch(i, { location: v })} />
            <Field label="Date" value={e.date} onChange={(v) => patch(i, { date: v })} />
          </div>
        </ItemCard>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_EDUCATION }])}>
        + Ajouter une formation
      </button>
    </section>
  );
}

function LanguagesSection({
  items,
  onChange,
}: {
  items: LanguageItem[];
  onChange: (items: LanguageItem[]) => void;
}) {
  const patch = (i: number, p: Partial<LanguageItem>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Langues</h3>
      {items.map((l, i) => (
        <div key={i} className="form-row">
          <input
            className="form-input"
            placeholder="Langue"
            value={l.name}
            onChange={(e) => patch(i, { name: e.target.value })}
          />
          <input
            className="form-input"
            placeholder="Niveau"
            value={l.level}
            onChange={(e) => patch(i, { level: e.target.value })}
          />
          <button
            type="button"
            className="form-btn-mini"
            aria-label="Supprimer la langue"
            onClick={() => onChange(removeAt(items, i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_LANGUAGE }])}>
        + Ajouter une langue
      </button>
    </section>
  );
}

function ProjectsSection({
  items,
  onChange,
}: {
  items: ProjectItem[];
  onChange: (items: ProjectItem[]) => void;
}) {
  const patch = (i: number, p: Partial<ProjectItem>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Projets</h3>
      {items.map((p, i) => (
        <ItemCard key={i} onRemove={() => onChange(removeAt(items, i))}>
          <div className="form-grid">
            <Field label="Titre" value={p.title} onChange={(v) => patch(i, { title: v })} />
            <Field label="Date" value={p.date} onChange={(v) => patch(i, { date: v })} />
          </div>
          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={p.description}
              onChange={(e) => patch(i, { description: e.target.value })}
            />
          </div>
        </ItemCard>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_PROJECT }])}>
        + Ajouter un projet
      </button>
    </section>
  );
}

function VolunteerSection({
  items,
  onChange,
}: {
  items: VolunteerItem[];
  onChange: (items: VolunteerItem[]) => void;
}) {
  const patch = (i: number, p: Partial<VolunteerItem>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Bénévolat</h3>
      {items.map((v, i) => (
        <ItemCard key={i} onRemove={() => onChange(removeAt(items, i))}>
          <div className="form-grid">
            <Field label="Rôle" value={v.title} onChange={(val) => patch(i, { title: val })} />
            <Field label="Organisation" value={v.organization} onChange={(val) => patch(i, { organization: val })} />
            <Field label="Lieu" value={v.location} onChange={(val) => patch(i, { location: val })} />
            <Field label="Date" value={v.date} onChange={(val) => patch(i, { date: val })} />
          </div>
          <BulletsEditor bullets={v.bullets} onChange={(b) => patch(i, { bullets: b })} />
        </ItemCard>
      ))}
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_VOLUNTEER }])}>
        + Ajouter une mission
      </button>
    </section>
  );
}

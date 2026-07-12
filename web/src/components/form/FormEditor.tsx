"use client";

import { useDocStore } from "@/state/docStore";
import { buildSections } from "@/lib/resume/sections";
import type {
  Resume,
  ExperienceItem,
  EducationItem,
  LanguageItem,
  ProjectItem,
  VolunteerItem,
  CustomSection,
  CustomField,
} from "@/lib/resume/schema";

/**
 * Formulaire structuré (mode Formulaire). Lit le CV courant dans le store et applique
 * chaque modification via `setJson` → re-rend l'aperçu (déjà branché).
 *
 * Toutes les sections du CV sont éditables. Le formulaire Lettre suivra (étape 4).
 * La photo base64 est stockée telle quelle ; elle n'est JAMAIS envoyée à l'IA (Phase 5).
 */
export default function FormEditor({ onImportPdf }: { onImportPdf?: () => void }) {
  const docType = useDocStore((s) => s.docType);
  const json = useDocStore((s) => s.json);
  const setJson = useDocStore((s) => s.setJson);

  // Le formulaire structuré couvre tous les types « CV » (CV, CV Maître).
  // Seule la Lettre a son propre formulaire (routé en amont par EditorPane).
  if (docType === "Lettre") {
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
    // Réinitialise l'input pour permettre de re-sélectionner le même fichier après un retrait.
    e.target.value = "";
  };

  return (
    <div className="pane-body form-editor">
        {onImportPdf ? (
          <div className="form-import-pdf">
            <span className="form-import-pdf__hint">Préremplis le formulaire depuis un CV PDF</span>
            <button type="button" className="form-btn-add" onClick={onImportPdf} data-testid="form-import-pdf">
              Importer un PDF
            </button>
          </div>
        ) : null}
        <section className="form-section">
          <h3 className="form-section__title">Informations personnelles</h3>
          <div className="form-grid">
            <Field label="Nom complet" value={cv.name} onChange={(v) => update({ name: v })} autoComplete="name" />
            <Field label="Titre du poste" value={cv.title} onChange={(v) => update({ title: v })} autoComplete="organization-title" />
            <Field label="Ville, Pays" value={cv.location} onChange={(v) => update({ location: v })} autoComplete="address-level2" />
            <Field label="Email" value={cv.email} onChange={(v) => update({ email: v })} type="email" autoComplete="email" />
            <Field label="Téléphone" value={cv.phone} onChange={(v) => update({ phone: v })} type="tel" autoComplete="tel" />
            <Field label="LinkedIn" value={cv.linkedin} onChange={(v) => update({ linkedin: v })} autoComplete="url" />
          </div>
          <div className="form-field">
            <label className="form-label">Photo</label>
            <div className="photo-upload-wrapper">
              {cv.photo ? (
                <img src={cv.photo} alt="Aperçu" className="photo-preview" />
              ) : (
                <div className="photo-preview photo-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
              )}
              <div className="photo-upload-actions">
                <label className="btn-upload" style={{ color: "var(--orange-text)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  {cv.photo ? "Changer" : "Ajouter une photo"}
                  <input type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
                </label>
                {cv.photo ? (
                  <button type="button" className="form-btn-mini" onClick={() => update({ photo: "" })} style={{ color: "var(--orange-text)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Retirer
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <CustomFieldsSection
          items={cv.customFields ?? []}
          onChange={(v) => update({ customFields: v })}
        />

        <SectionOrderSection cv={cv} onChange={(v) => update({ sectionOrder: v })} />

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
        <StringListSection
          title="Soft skills"
          addLabel="+ Ajouter un soft skill"
          items={cv.softSkills ?? []}
          onChange={(v) => update({ softSkills: v })}
        />
        <StringListSection
          title="Outils"
          addLabel="+ Ajouter un outil"
          items={cv.tools ?? []}
          onChange={(v) => update({ tools: v })}
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
        <CustomSectionsSection
          items={cv.customSections ?? []}
          onChange={(v) => update({ customSections: v })}
        />
    </div>
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
  type,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <input
        className="form-input"
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
      <textarea
        className="form-textarea form-bullets"
        rows={5}
        placeholder="Une réalisation par ligne — collez plusieurs lignes d'un coup."
        value={bullets.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        onBlur={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l !== "")
          )
        }
      />
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
const EMPTY_CUSTOM_SECTION: CustomSection = { title: "", items: [] };
const EMPTY_CUSTOM_FIELD: CustomField = { label: "", value: "" };

/**
 * Infos personnelles sans case dédiée : permis, âge, mobilité, portfolio, GitHub…
 * Pendant de `CustomSectionsSection`, mais pour l'en-tête plutôt que pour le corps du CV.
 * Ce sont les modèles qui s'adaptent — jamais l'inverse.
 */
function CustomFieldsSection({
  items,
  onChange,
}: {
  items: CustomField[];
  onChange: (items: CustomField[]) => void;
}) {
  const patch = (i: number, p: Partial<CustomField>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Informations complémentaires</h3>
      <p className="form-hint">
        Tout ce qui n&apos;a pas de case : permis, âge, mobilité, portfolio, disponibilité…
      </p>
      {items.map((f, i) => (
        <div key={i} className="form-row">
          <input
            className="form-input"
            placeholder="Intitulé (ex : Permis)"
            value={f.label}
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <input
            className="form-input"
            placeholder="Valeur (ex : B, véhiculé)"
            value={f.value}
            onChange={(e) => patch(i, { value: e.target.value })}
          />
          <button
            type="button"
            className="form-btn-mini"
            aria-label="Supprimer l'information"
            onClick={() => onChange(removeAt(items, i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="form-btn-add"
        onClick={() => onChange([...items, { ...EMPTY_CUSTOM_FIELD }])}
      >
        + Ajouter une information
      </button>
    </section>
  );
}

/**
 * Ordre des sections. La liste est DÉRIVÉE du CV (`buildSections`) et non écrite en dur :
 * une rubrique relevée à l'import — même inconnue de l'application — apparaît donc ici
 * d'elle-même, et devient déplaçable sans qu'une ligne de code la mentionne.
 *
 * Chaque déplacement réécrit la liste complète des identifiants présents : `sectionOrder`
 * reste ainsi toujours aligné sur le contenu réel du CV.
 */
function SectionOrderSection({ cv, onChange }: { cv: Resume; onChange: (order: string[]) => void }) {
  const sections = buildSections(cv);
  if (sections.length < 2) return null;

  const move = (i: number, dir: -1 | 1) => {
    const ids = sections.map((sec) => sec.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onChange(ids);
  };

  return (
    <section className="form-section">
      <h3 className="form-section__title">Ordre des sections</h3>
      <p className="form-hint">
        L&apos;ordre du CV importé est conservé. Réorganisez-le comme vous voulez : le modèle suit.
      </p>
      <ul className="form-order">
        {sections.map((sec, i) => (
          <li key={sec.id} className="form-order__row">
            <span className="form-order__label">{sec.title}</span>
            <button
              type="button"
              className="form-btn-mini"
              aria-label={`Monter « ${sec.title} »`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="form-btn-mini"
              aria-label={`Descendre « ${sec.title} »`}
              disabled={i === sections.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

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

/**
 * Sections libres : rubriques du CV qui n'entrent dans aucune case standard
 * (« Publications », « Distinctions »…). Le titre est saisi par l'utilisateur —
 * c'est ce qui distingue ce bloc des autres sections, dont le titre est figé.
 */
function CustomSectionsSection({
  items,
  onChange,
}: {
  items: CustomSection[];
  onChange: (items: CustomSection[]) => void;
}) {
  const patch = (i: number, p: Partial<CustomSection>) =>
    onChange(replaceAt(items, i, { ...items[i], ...p }));
  return (
    <section className="form-section">
      <h3 className="form-section__title">Sections libres</h3>
      {items.map((c, i) => (
        <ItemCard key={i} onRemove={() => onChange(removeAt(items, i))}>
          <Field
            label="Titre de la section"
            value={c.title}
            onChange={(v) => patch(i, { title: v })}
          />
          <div className="form-field">
            <label className="form-label">Contenu</label>
            <textarea
              className="form-textarea form-bullets"
              rows={4}
              placeholder="Une ligne par élément."
              value={c.items.join("\n")}
              onChange={(e) => patch(i, { items: e.target.value.split("\n") })}
              onBlur={(e) =>
                patch(i, {
                  items: e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter((l) => l !== ""),
                })
              }
            />
          </div>
        </ItemCard>
      ))}
      <button
        type="button"
        className="form-btn-add"
        onClick={() => onChange([...items, { ...EMPTY_CUSTOM_SECTION }])}
      >
        + Ajouter une section
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

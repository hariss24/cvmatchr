"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { getAllFormSections, type FormSectionInfo } from "@/lib/resume/sections";
import { SortableList, DragHandle, useSortableItem, moveItem } from "./Sortable";
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

  const orderedSections = getAllFormSections(cv);
  const hidden = new Set(cv.hiddenSections ?? []);

  const moveSection = (i: number, dir: -1 | 1) => {
    const ids = orderedSections.map((sec) => sec.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    update({ sectionOrder: ids });
  };

  const toggleSection = (id: string) =>
    update({
      hiddenSections: hidden.has(id)
        ? (cv.hiddenSections ?? []).filter((x) => x !== id)
        : [...(cv.hiddenSections ?? []), id],
    });

  const renderSectionContent = (sec: FormSectionInfo) => {
    switch (sec.id) {
      case "summary":
        return (
          <textarea
            className="form-textarea"
            rows={4}
            value={cv.summary}
            onChange={(e) => update({ summary: e.target.value })}
          />
        );
      case "experience":
        return <ExperienceSection items={cv.experience ?? []} onChange={(v) => update({ experience: v })} />;
      case "education":
        return <EducationSection items={cv.education ?? []} onChange={(v) => update({ education: v })} />;
      case "skills":
        return <StringListSection addLabel="+ Ajouter une compétence" items={cv.skills ?? []} onChange={(v) => update({ skills: v })} />;
      case "softSkills":
        return <StringListSection addLabel="+ Ajouter un soft skill" items={cv.softSkills ?? []} onChange={(v) => update({ softSkills: v })} />;
      case "tools":
        return <StringListSection addLabel="+ Ajouter un outil" items={cv.tools ?? []} onChange={(v) => update({ tools: v })} />;
      case "languages":
        return <LanguagesSection items={cv.languages ?? []} onChange={(v) => update({ languages: v })} />;
      case "projects":
        return <ProjectsSection items={cv.projects ?? []} onChange={(v) => update({ projects: v })} />;
      case "certifications":
        return <StringListSection addLabel="+ Ajouter une certification" items={cv.certifications ?? []} onChange={(v) => update({ certifications: v })} />;
      case "volunteer":
        return <VolunteerSection items={cv.volunteer ?? []} onChange={(v) => update({ volunteer: v })} />;
      case "interests":
        return <StringListSection addLabel="+ Ajouter un centre d'intérêt" items={cv.interests ?? []} onChange={(v) => update({ interests: v })} />;
      default:
        if (sec.isCustom) {
          const customIndex = sec.index;
          return (
            <SingleCustomSection
              item={cv.customSections?.[customIndex] || { title: "", items: [] }}
              onChange={(v) => {
                const newCustoms = [...(cv.customSections ?? [])];
                newCustoms[customIndex] = v;
                update({ customSections: newCustoms });
              }}
            />
          );
        }
        return null;
    }
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
        <FormSection title="Informations personnelles">
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
        </FormSection>

        <CustomFieldsSection
          items={cv.customFields ?? []}
          onChange={(v) => update({ customFields: v })}
        />

        {orderedSections.map((sec, i) => {
          const isHidden = hidden.has(sec.id);
          const controls = (
            <SectionControls
              title={sec.title}
              isHidden={isHidden}
              isFirst={i === 0}
              isLast={i === orderedSections.length - 1}
              onToggle={() => toggleSection(sec.id)}
              onMoveUp={() => moveSection(i, -1)}
              onMoveDown={() => moveSection(i, 1)}
            />
          );
          
          return (
            <div key={sec.id} style={{ opacity: isHidden ? 0.5 : 1 }}>
              <FormSection title={sec.title} controls={controls}>
                {renderSectionContent(sec)}
              </FormSection>
            </div>
          );
        })}

        <div className="form-add-custom mt-4" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="form-btn-add"
            onClick={() => update({ customSections: [...(cv.customSections ?? []), { title: "", items: [] }] })}
          >
            + Ajouter une section libre
          </button>
        </div>
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

// ---- Accordéon ----

/** Chevron d'accordéon : pointe à droite fermé, vers le bas ouvert. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`form-chevron${open ? " form-chevron--open" : ""}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/**
 * Section repliable. Ouverte par défaut ; l'état est local (se réinitialise au
 * rechargement). C'est un confort d'édition — à ne pas confondre avec « masquer une
 * section » (l'œil, dans « Ordre des sections »), qui, lui, retire du PDF.
 * Le `<h3>` enveloppe son bouton : titre sémantique conservé, HTML valide.
 */
function SectionControls({
  title,
  isHidden,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  isHidden: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="form-btn-mini form-btn-icon-only"
        aria-label={isHidden ? `Réafficher « ${title} »` : `Masquer « ${title} »`}
        aria-pressed={isHidden}
        onClick={onToggle}
      >
        <EyeIcon off={isHidden} />
      </button>
      <button
        type="button"
        className="form-btn-mini"
        aria-label={`Monter « ${title} »`}
        disabled={isFirst}
        onClick={onMoveUp}
      >
        ↑
      </button>
      <button
        type="button"
        className="form-btn-mini"
        aria-label={`Descendre « ${title} »`}
        disabled={isLast}
        onClick={onMoveDown}
      >
        ↓
      </button>
    </>
  );
}

function FormSection({ title, controls, children }: { title: string; controls?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`form-section${open ? "" : " form-section--collapsed"}`}>
      <h3 className="form-section__title">
        <button
          type="button"
          className="form-section__header"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{ flex: 1 }}
        >
          <Chevron open={open} />
          <span>{title}</span>
        </button>
        {controls && <div className="form-section__controls" style={{ display: "flex", gap: "4px" }}>{controls}</div>}
      </h3>
      {open ? <div className="form-section__body">{children}</div> : null}
    </section>
  );
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

/**
 * Carte d'un élément de liste. En-tête = poignée + repère (« Expérience 1 » et,
 * s'il est renseigné, l'intitulé saisi comme sous-titre vivant) + suppression ;
 * corps en dessous. Le repère numéroté sert de point d'ancrage pour la navigation.
 */
function ItemCard({
  index,
  title,
  subtitle,
  onRemove,
  children,
}: {
  index: number;
  title: string;
  subtitle?: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { ref, style, handleProps } = useSortableItem(index);
  const [open, setOpen] = useState(true);
  return (
    <div ref={ref} style={style} className={`form-item${open ? "" : " form-item--collapsed"}`}>
      <div className="form-item__head">
        <DragHandle {...handleProps} />
        <button
          type="button"
          className="form-item__toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Chevron open={open} />
          <span className="form-item__heading">
            <span className="form-item__eyebrow">{title}</span>
            {subtitle ? <span className="form-item__subtitle">{subtitle}</span> : null}
          </span>
        </button>
        <button
          type="button"
          className="form-btn-mini form-item__remove"
          aria-label="Supprimer l'élément"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
      {open ? <div className="form-item__body">{children}</div> : null}
    </div>
  );
}

/** Ligne d'un élément simple : poignée, contenu, bouton de suppression. Pendant d'`ItemCard`. */
function RowCard({
  index,
  onRemove,
  removeLabel,
  children,
}: {
  index: number;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  const { ref, style, handleProps } = useSortableItem(index);
  return (
    <div ref={ref} style={style} className="form-row">
      <DragHandle {...handleProps} />
      {children}
      <button type="button" className="form-btn-mini" aria-label={removeLabel} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

// ---- Sections « liste de chaînes » (compétences, certifications, intérêts) ----

function SingleCustomSection({
  item,
  onChange,
}: {
  item: CustomSection;
  onChange: (item: CustomSection) => void;
}) {
  return (
    <>
      <Field
        label="Titre de la section"
        value={item.title}
        onChange={(v) => onChange({ ...item, title: v })}
      />
      <div className="form-field">
        <label className="form-label">Contenu</label>
        <textarea
          className="form-textarea form-bullets"
          rows={4}
          placeholder="Une ligne par élément."
          value={item.items.join("\n")}
          onChange={(e) => onChange({ ...item, items: e.target.value.split("\n") })}
          onBlur={(e) =>
            onChange({
              ...item,
              items: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l !== ""),
            })
          }
        />
      </div>
    </>
  );
}

function StringListSection({
  addLabel,
  items,
  onChange,
}: {
  addLabel: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((value, i) => (
          <RowCard
            key={i}
            index={i}
            removeLabel="Supprimer"
            onRemove={() => onChange(removeAt(items, i))}
          >
            <input
              className="form-input"
              value={value}
              onChange={(e) => onChange(replaceAt(items, i, e.target.value))}
            />
          </RowCard>
        ))}
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </>
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
    <FormSection title="Informations complémentaires">
      <p className="form-hint">
        Tout ce qui n&apos;a pas de case : permis, âge, mobilité, portfolio, disponibilité…
      </p>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((f, i) => (
          <RowCard
            key={i}
            index={i}
            removeLabel="Supprimer l'information"
            onRemove={() => onChange(removeAt(items, i))}
          >
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
          </RowCard>
        ))}
      </SortableList>
      <button
        type="button"
        className="form-btn-add"
        onClick={() => onChange([...items, { ...EMPTY_CUSTOM_FIELD }])}
      >
        + Ajouter une information
      </button>
    </FormSection>
  );
}

/** Œil ouvert / barré — masquer ou réafficher une section. */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <line x1="3" y1="21" x2="21" y2="3" /> : null}
    </svg>
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
    <>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((e, i) => (
          <ItemCard
            key={i}
            index={i}
            title={`Expérience ${i + 1}`}
            subtitle={[e.title, e.company].filter(Boolean).join(" · ")}
            onRemove={() => onChange(removeAt(items, i))}
          >
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
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_EXPERIENCE }])}>
        + Ajouter une expérience
      </button>
    </>
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
    <>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((e, i) => (
          <ItemCard
            key={i}
            index={i}
            title={`Formation ${i + 1}`}
            subtitle={[e.title, e.school].filter(Boolean).join(" · ")}
            onRemove={() => onChange(removeAt(items, i))}
          >
            <div className="form-grid">
              <Field label="Diplôme" value={e.title} onChange={(v) => patch(i, { title: v })} />
              <Field label="Établissement" value={e.school} onChange={(v) => patch(i, { school: v })} />
              <Field label="Lieu" value={e.location} onChange={(v) => patch(i, { location: v })} />
              <Field label="Date" value={e.date} onChange={(v) => patch(i, { date: v })} />
            </div>
          </ItemCard>
        ))}
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_EDUCATION }])}>
        + Ajouter une formation
      </button>
    </>
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
    <>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((l, i) => (
          <RowCard
            key={i}
            index={i}
            removeLabel="Supprimer la langue"
            onRemove={() => onChange(removeAt(items, i))}
          >
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
          </RowCard>
        ))}
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_LANGUAGE }])}>
        + Ajouter une langue
      </button>
    </>
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
    <>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((p, i) => (
          <ItemCard
            key={i}
            index={i}
            title={`Projet ${i + 1}`}
            subtitle={p.title}
            onRemove={() => onChange(removeAt(items, i))}
          >
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
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_PROJECT }])}>
        + Ajouter un projet
      </button>
    </>
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
    <>
      <SortableList
        count={items.length}
        onMove={(from, to) => onChange(moveItem(items, from, to))}
      >
        {items.map((v, i) => (
          <ItemCard
            key={i}
            index={i}
            title={`Bénévolat ${i + 1}`}
            subtitle={[v.title, v.organization].filter(Boolean).join(" · ")}
            onRemove={() => onChange(removeAt(items, i))}
          >
            <div className="form-grid">
              <Field label="Rôle" value={v.title} onChange={(val) => patch(i, { title: val })} />
              <Field label="Organisation" value={v.organization} onChange={(val) => patch(i, { organization: val })} />
              <Field label="Lieu" value={v.location} onChange={(val) => patch(i, { location: val })} />
              <Field label="Date" value={v.date} onChange={(val) => patch(i, { date: val })} />
            </div>
            <BulletsEditor bullets={v.bullets} onChange={(b) => patch(i, { bullets: b })} />
          </ItemCard>
        ))}
      </SortableList>
      <button type="button" className="form-btn-add" onClick={() => onChange([...items, { ...EMPTY_VOLUNTEER }])}>
        + Ajouter une mission
      </button>
    </>
  );
}

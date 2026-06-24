import { create } from "zustand";
import {
  DEFAULT_RESUME,
  DEFAULT_LETTER,
  type Resume,
  type Letter,
  type DocType,
} from "@/lib/resume/schema";
import { renderResume, renderLetter } from "@/lib/resume/render";
import { TEMPLATES, type TemplateId } from "@/lib/resume/templates";

/**
 * Store du document courant (CV ou Lettre), partagé entre l'éditeur et le formulaire.
 * Remplace les globals `window.htmlModel` / `window.ResumeForm` de l'app vanilla.
 *
 * `json` est la source de vérité structurée ; `html` en est le rendu (re-calculé à chaque
 * `setJson` via `lib/resume`). `setHtml`/`setCss` servent au mode expert (édition directe).
 * La persistance par type de document (CV/Lettre séparés) viendra en Phase 6 (storage).
 */

export type DocData = Resume | Letter;

export type Doc = {
  docType: DocType;
  templateId: TemplateId;
  json: DocData;
  html: string;
  css: string;
  /** Aperçu transitoire (proposition du chat IA) : si non null, l'aperçu l'affiche au lieu du document. */
  previewOverride: string | null;
  /** Booster ATS invisible : mots-clés absents injectés en texte 1px à l'aperçu et à l'export. */
  atsBoost: { enabled: boolean; keywords: string[] };
};

/** Rend le HTML d'un document selon son type. */
function renderDoc(docType: DocType, json: DocData): string {
  return docType === "Lettre"
    ? renderLetter(json as Letter)
    : renderResume(json as Resume);
}

function defaultJson(docType: DocType): DocData {
  return docType === "Lettre"
    ? structuredClone(DEFAULT_LETTER)
    : structuredClone(DEFAULT_RESUME);
}

export type DocStore = Doc & {
  setJson: (json: DocData) => void;
  setHtml: (html: string) => void;
  setCss: (css: string) => void;
  setDocType: (docType: DocType) => void;
  setTemplate: (templateId: TemplateId) => void;
  setPreviewOverride: (html: string | null) => void;
  setAtsBoost: (atsBoost: { enabled: boolean; keywords: string[] }) => void;
};

const INITIAL_TEMPLATE: TemplateId = "sobre";

export const useDocStore = create<DocStore>((set, get) => ({
  docType: "CV",
  templateId: INITIAL_TEMPLATE,
  json: structuredClone(DEFAULT_RESUME),
  html: renderResume(DEFAULT_RESUME),
  css: TEMPLATES[INITIAL_TEMPLATE].css,
  previewOverride: null,
  atsBoost: { enabled: false, keywords: [] },

  setJson: (json) => set({ json, html: renderDoc(get().docType, json) }),
  setHtml: (html) => set({ html }),
  setCss: (css) => set({ css }),
  setPreviewOverride: (previewOverride) => set({ previewOverride }),
  setAtsBoost: (atsBoost) => set({ atsBoost }),

  setDocType: (docType) => {
    const json = defaultJson(docType);
    set({ docType, json, html: renderDoc(docType, json) });
  },

  setTemplate: (templateId) => set({ templateId, css: TEMPLATES[templateId].css }),
}));

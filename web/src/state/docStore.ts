import { create } from "zustand";
import {
  DEFAULT_RESUME,
  DEFAULT_LETTER,
  type Resume,
  type Letter,
  type DocType,
} from "@/lib/resume/schema";

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
  /** Entreprise visée (barre meta) — utilisée pour le nommage et l'historique. */
  company: string;
  /** Poste visé (barre meta). */
  role: string;
  templateId: TemplateId;
  json: DocData;
  html: string;
  css: string;
  /**
   * True si le HTML a été écrit directement (mode expert, chat IA, pack, import lettre) :
   * `json` est alors périmé et le formulaire ne doit plus écraser `html` sans confirmation.
   */
  htmlSource: boolean;
  /** Aperçu transitoire (proposition du chat IA) : si non null, l'aperçu l'affiche au lieu du document. */
  previewOverride: DocData | null;
  /** Booster ATS invisible : mots-clés absents injectés en texte 1px à l'aperçu et à l'export. */
  atsBoost: { enabled: boolean; keywords: string[] };
  /** État HTML/CSS avant adaptation (Tailor) pour le DiffModal. */
  tailorBefore: { json: DocData; templateId: TemplateId | null } | null;
  /** Offre en attente (depuis l'onglet Offres) : pré-remplit `TailorModal` à l'ouverture. */
  pendingJobDesc: string | null;
  /** True si l'arrivée sur l'éditeur doit ouvrir directement le Pack candidature (bouton « Candidater » des Offres). */
  pendingPackOpen: boolean;
  /** Option : inclure la date dans le nom du fichier PDF. */
  includeDate: boolean;
};



/** JSON par défaut pour un type de document (Lettre → lettre, sinon CV). */
export function defaultJsonFor(docType: DocType): DocData {
  return docType === "Lettre"
    ? structuredClone(DEFAULT_LETTER)
    : structuredClone(DEFAULT_RESUME);
}

export type DocStore = Doc & {
  setJson: (json: DocData) => void;
  setHtml: (html: string) => void;
  setCss: (css: string) => void;
  setCompany: (company: string) => void;
  setRole: (role: string) => void;
  setDocType: (docType: DocType) => void;
  setTemplate: (templateId: TemplateId) => void;
  setPreviewOverride: (previewOverride: DocData | null) => void;
  setAtsBoost: (atsBoost: { enabled: boolean; keywords: string[] }) => void;
  setTailorBefore: (state: { json: DocData; templateId: TemplateId | null } | null) => void;
  setPendingJobDesc: (v: string | null) => void;
  setPendingPackOpen: (v: boolean) => void;
  setIncludeDate: (v: boolean) => void;
};

const INITIAL_TEMPLATE: TemplateId = "sobre";

export const useDocStore = create<DocStore>((set) => ({
  docType: "CV",
  company: "",
  role: "",
  templateId: INITIAL_TEMPLATE,
  json: structuredClone(DEFAULT_RESUME),
  html: "",
  css: TEMPLATES[INITIAL_TEMPLATE].css,
  htmlSource: false,
  previewOverride: null,
  atsBoost: { enabled: false, keywords: [] },
  tailorBefore: null,
  pendingJobDesc: null,
  pendingPackOpen: false,
  includeDate: typeof window !== "undefined" ? localStorage.getItem("pdfIncludeDate") === "true" : false,

  setJson: (json) => {
    set({ json, html: "", htmlSource: false });
  },
  setHtml: (html) => set({ html, htmlSource: true }),
  setCss: (css) => set({ css }),
  setCompany: (company) => set({ company }),
  setRole: (role) => set({ role }),
  setPreviewOverride: (previewOverride) => set({ previewOverride }),
  setAtsBoost: (atsBoost) => set({ atsBoost }),
  setTailorBefore: (tailorBefore) => set({ tailorBefore }),
  setPendingJobDesc: (pendingJobDesc) => set({ pendingJobDesc }),
  setPendingPackOpen: (pendingPackOpen) => set({ pendingPackOpen }),
  setIncludeDate: (includeDate) => {
    if (typeof window !== "undefined") localStorage.setItem("pdfIncludeDate", String(includeDate));
    set({ includeDate });
  },

  setDocType: (docType) => {
    const json = defaultJsonFor(docType);
    set({ docType, json, html: "", htmlSource: false });
  },

  setTemplate: (templateId) => set({ templateId, css: TEMPLATES[templateId].css }),
}));

if (typeof window !== "undefined") {
  (window as unknown as { useDocStore: typeof useDocStore }).useDocStore = useDocStore;
}

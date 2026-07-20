import { create } from "zustand";
import {
  DEFAULT_RESUME,
  DEFAULT_LETTER,
  type Resume,
  type Letter,
  type DocType,
} from "@/lib/resume/schema";

import { type TemplateId } from "@/lib/resume/templates";

/**
 * Store du document courant (CV ou Lettre), partagé entre l'éditeur et le formulaire.
 * Remplace les globals `window.htmlModel` / `window.ResumeForm` de l'app vanilla.
 *
 * `json` est la source de vérité structurée.
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
  /** Aperçu transitoire (proposition du chat IA) : si non null, l'aperçu l'affiche au lieu du document. */
  previewOverride: DocData | null;

  /** État HTML/CSS avant adaptation (Tailor) pour le DiffModal. */
  tailorBefore: { json: DocData; templateId: TemplateId | null } | null;
  /** Offre en attente (depuis l'onglet Offres) : pré-remplit `TailorModal` à l'ouverture. */
  pendingJobDesc: string | null;

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
  setCompany: (company: string) => void;
  setRole: (role: string) => void;
  setDocType: (docType: DocType) => void;
  setTemplate: (templateId: TemplateId) => void;
  setPreviewOverride: (previewOverride: DocData | null) => void;

  setTailorBefore: (state: { json: DocData; templateId: TemplateId | null } | null) => void;
  setPendingJobDesc: (v: string | null) => void;

  setIncludeDate: (v: boolean) => void;
};

const INITIAL_TEMPLATE: TemplateId = "sobre";

export const useDocStore = create<DocStore>((set) => ({
  docType: "CV",
  company: "",
  role: "",
  templateId: INITIAL_TEMPLATE,
  json: structuredClone(DEFAULT_RESUME),
  previewOverride: null,

  tailorBefore: null,
  pendingJobDesc: null,

  includeDate: false,

  setJson: (json) => {
    set({ json });
  },
  setCompany: (company) => set({ company }),
  setRole: (role) => set({ role }),
  setPreviewOverride: (previewOverride) => set({ previewOverride }),

  setTailorBefore: (tailorBefore) => set({ tailorBefore }),
  setPendingJobDesc: (pendingJobDesc) => set({ pendingJobDesc }),

  setIncludeDate: (includeDate) => {
    if (typeof window !== "undefined") localStorage.setItem("pdfIncludeDate", String(includeDate));
    set({ includeDate });
  },

  setDocType: (docType) => {
    const json = defaultJsonFor(docType);
    set({ docType, json });
  },

  setTemplate: (templateId) => set({ templateId }),
}));

if (typeof window !== "undefined") {
  (window as unknown as { useDocStore: typeof useDocStore }).useDocStore = useDocStore;
}

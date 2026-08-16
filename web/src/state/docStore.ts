import { create } from "zustand";
import { DEFAULT_RESUME, DEFAULT_LETTER } from "@/lib/resume/defaults";
import type { Resume, Letter, DocType } from "@/lib/resume/schema";

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

  /**
   * Document du compte que l'on est en train de modifier.
   *
   * L'enregistrement automatique met CE document à jour. `null` signifie « pas
   * encore enregistré sur le compte » : le premier envoi en crée un et pose son
   * identifiant ici. Sans cette identité, chaque envoi créerait une copie de
   * plus — invisible avec un bouton cliqué trois fois par jour, ruineux en
   * automatique.
   */
  documentId: string | null;
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
  setDocumentId: (documentId: string | null) => void;
};

const INITIAL_TEMPLATE: TemplateId = "marine";

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
  documentId: null,

  setDocumentId: (documentId) => set({ documentId }),

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

  // Changer de type, c'est changer de document : l'identité de l'ancien ne doit
  // surtout pas suivre, sinon la lettre irait écraser le CV. `useAutoDraft`
  // repose celle du brouillon du nouveau type juste après.
  setDocType: (docType) => {
    const json = defaultJsonFor(docType);
    set({ docType, json, documentId: null });
  },

  setTemplate: (templateId) => set({ templateId }),
}));

if (typeof window !== "undefined") {
  (window as unknown as { useDocStore: typeof useDocStore }).useDocStore = useDocStore;
}

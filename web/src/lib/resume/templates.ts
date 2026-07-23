// Registre des modèles de CV. Le rendu réel est fait par les templates
// react-pdf (`src/lib/pdfgen/templates/*.tsx`) — plus aucun gabarit HTML/CSS
// depuis la migration React PDF (couche legacy retirée le 17/07/2026).
//
// Source unique de vérité pour l'UI (libellé du sélecteur) ET la logique de mise
// en page (nombre de colonnes). Ajouter un modèle = une entrée ici ; s'il est
// deux-colonnes, `columns: 2` suffit pour qu'il hérite du choix de colonne des
// sections libres (cf. `FormEditor` → `isTwoColumn`, et `splitColumns` dans
// `sections.ts`). Aucune autre valeur en dur ailleurs.

export type TemplateId = "sobre" | "graphique" | "kakuna" | "marine";

export interface TemplateMeta {
  id: TemplateId;
  /** Libellé affiché dans le sélecteur de modèle. */
  label: string;
  /** Colonnes de mise en page. `2` = possède une barre latérale où placer des sections. */
  columns: 1 | 2;
}

export const TEMPLATES: readonly TemplateMeta[] = [
  { id: "sobre", label: "Sobre", columns: 1 },
  { id: "graphique", label: "Graphique", columns: 1 },
  { id: "kakuna", label: "Kakuna", columns: 1 },
  { id: "marine", label: "Marine", columns: 2 },
];

export const TEMPLATE_IDS: readonly TemplateId[] = TEMPLATES.map((t) => t.id);

/** Vrai si le modèle a une barre latérale (deux colonnes) — pilote l'UI du choix de colonne. */
export function isTwoColumn(id: TemplateId): boolean {
  return TEMPLATES.find((t) => t.id === id)?.columns === 2;
}

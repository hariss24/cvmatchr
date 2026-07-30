import { useDocStore } from "@/state/docStore";
import { saveDraft, loadProfile } from "@/lib/storage/db";
import { applyProfileToResume } from "@/lib/profile/profile";
import { DEFAULT_RESUME } from "@/lib/resume/schema";

/**
 * Repart d'un CV vierge, en basculant sur le type CV si besoin.
 *
 * « Nouveau CV » posait auparavant un CV dans le document courant sans regarder son
 * type. Le bouton vit dans la barre du haut, donc il est atteignable depuis l'onglet
 * Lettre : cliqué de là, il remplaçait la lettre par un CV, que l'auto-sauvegarde
 * persistait aussitôt dans `draft-Lettre`. L'onglet Lettre ne rechargeait alors plus
 * jamais qu'un CV — le formulaire affichait ses champs d'usine vides, et l'aperçu
 * rendait un CV.
 *
 * Le brouillon est écrit AVANT la bascule de type : `useAutoDraft` recharge
 * `draft-CV` dès que le type change, donc il restaure exactement ce qu'on vient d'y
 * mettre. Poser le document puis basculer ferait l'inverse — sa restauration, plus
 * tardive, écraserait le CV vierge par l'ancien.
 */
export async function startNewResume(): Promise<void> {
  const { docType, templateId, setJson, setCompany, setRole } = useDocStore.getState();
  const profile = await loadProfile();
  const vierge = applyProfileToResume(structuredClone(DEFAULT_RESUME), profile);

  await saveDraft({
    id: "draft-CV",
    json: vierge,
    templateId,
    company: "",
    role: "",
    updatedAt: Date.now(),
  });

  if (docType === "CV") {
    setJson(vierge);
  } else {
    useDocStore.setState({ docType: "CV" });
  }
  setCompany("");
  setRole("");
}

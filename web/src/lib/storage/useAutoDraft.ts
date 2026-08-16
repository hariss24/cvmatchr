import { useEffect, useRef } from "react";
import { useDocStore } from "@/state/docStore";
import { saveDraft, loadDraft, loadProfile } from "@/lib/storage/db";
import { applyProfileToResume } from "@/lib/profile/profile";
import type { Resume } from "@/lib/resume/schema";
import { useSettingsStore } from "@/state/settingsStore";
import { pendantRestauration } from "@/lib/storage/restaurationBrouillon";

export function useAutoDraft() {
  const isLoaded = useRef(false);
  const loadingDocType = useRef<string | null>(null);

  useEffect(() => {
    // 1. Initial load for the default docType
    async function init() {
      if (isLoaded.current) return;

      // « Adapter mon CV » depuis l'onglet Offres pose l'entreprise et le poste de
      // l'offre AVANT de naviguer ici. Le brouillon, lui, porte ceux de la
      // candidature précédente : restauré aveuglément, il les écrasait et le PDF
      // sortait au nom de l'ancien poste. Une valeur déjà posée fait donc foi —
      // lu maintenant, avant tout `await`, car le store bouge pendant le chargement.
      const posee = useDocStore.getState();
      const garderMeta = { company: !!posee.company.trim(), role: !!posee.role.trim() };

      try {
        // Le type peut changer PENDANT ce chargement : l'utilisateur clique
        // « Lettre » avant que le brouillon initial soit revenu. La souscription
        // ignore ce changement tant que `isLoaded` est faux, donc personne d'autre
        // ne le rattraperait — le CV atterrissait dans le document lettre, et
        // l'auto-sauvegarde le figeait aussitôt dans `draft-Lettre`. On recharge
        // donc le brouillon du type réellement affiché, borné à trois essais pour
        // qu'un clic frénétique ne boucle pas.
        for (let essai = 0; essai < 3; essai++) {
          const docType = useDocStore.getState().docType;
          const draft = await loadDraft(`draft-${docType}`);
          if (useDocStore.getState().docType !== docType) continue;

          if (draft) {
            pendantRestauration(() => useDocStore.setState({
              json: draft.json,
              templateId: draft.templateId || "sobre",
              // Rend au document l'identité qu'il avait avant le rafraîchissement :
              // sans elle, l'enregistrement automatique en créerait un second.
              documentId: draft.documentId ?? null,
              ...(draft.company !== undefined && !garderMeta.company ? { company: draft.company } : {}),
              ...(draft.role !== undefined && !garderMeta.role ? { role: draft.role } : {}),
            }));
          } else if (docType === "CV" || docType === "Maître") {
            const profile = await loadProfile();
            // Le profil s'applique au document AFFICHÉ : si le type a changé
            // entre-temps, ce n'est plus un CV et le greffer dessus le corromprait.
            if (profile && useDocStore.getState().docType === docType) {
              pendantRestauration(() => useDocStore.setState({
                json: applyProfileToResume(useDocStore.getState().json as Resume, profile),
              }));
            }
          }
          break;
        }
      } catch (e) {
        console.warn("Failed to load draft:", e);
      } finally {
        isLoaded.current = true;
      }
    }
    init();

    // 2. Subscribe to changes and save (debounced)
    let timeout: NodeJS.Timeout;
    const unsub = useDocStore.subscribe((state, prevState) => {
      if (!isLoaded.current) return; // don't save during initial load

      // If document type changed, load the draft for the new type
      if (state.docType !== prevState.docType) {
        loadingDocType.current = state.docType;
        loadDraft(`draft-${state.docType}`).then((draft) => {
          if (loadingDocType.current !== state.docType) return; // changed again
          if (draft) {
            pendantRestauration(() => useDocStore.setState({
              json: draft.json,
              templateId: draft.templateId || "sobre",
              documentId: draft.documentId ?? null,
              ...(draft.company !== undefined ? { company: draft.company } : {}),
              ...(draft.role !== undefined ? { role: draft.role } : {}),
            }));

          } else {
            // New draft, just keep current state or clear it. The old app cleared it or applied default template.
            // But we already have logic for template change. We'll just save it as is.
          }
        });
        return;
      }

      // If we are just changing things, debounce save to DB
      clearTimeout(timeout);
      const delay = useSettingsStore.getState().autosaveDelay;
      if (delay === 0) return; // Autosave disabled

      timeout = setTimeout(() => {
        saveDraft({
          id: `draft-${state.docType}`,
          json: state.json,
          templateId: state.templateId,
          company: state.company,
          role: state.role,
          // Relu à l'instant de l'écriture, pas au moment de la frappe : le
          // premier enregistrement sur le compte pose l'identité entre les deux.
          documentId: useDocStore.getState().documentId,
          updatedAt: Date.now(),
        }).catch((e) => console.warn("Failed to save draft:", e));
      }, delay);
    });

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);
}

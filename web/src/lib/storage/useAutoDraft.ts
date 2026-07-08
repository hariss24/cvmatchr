import { useEffect, useRef } from "react";
import { useDocStore } from "@/state/docStore";
import { saveDraft, loadDraft } from "@/lib/storage/db";
import { toast } from "@/state/uiStore";

export function useAutoDraft() {
  const isLoaded = useRef(false);
  const loadingDocType = useRef<string | null>(null);

  useEffect(() => {
    // 1. Initial load for the default docType
    async function init() {
      if (isLoaded.current) return;
      const docType = useDocStore.getState().docType;
      
      try {
        const draft = await loadDraft(`draft-${docType}`);
        if (draft) {
          useDocStore.setState({
            html: draft.html,
            css: draft.css,
            ...(draft.json ? { json: draft.json } : {}),
            templateId: draft.templateId || "sobre",
            ...(draft.company !== undefined ? { company: draft.company } : {}),
            ...(draft.role !== undefined ? { role: draft.role } : {}),
            htmlSource: draft.htmlSource ?? !draft.json,
          });

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
            useDocStore.setState({
              html: draft.html,
              css: draft.css,
              ...(draft.json ? { json: draft.json } : {}),
              templateId: draft.templateId || "sobre",
              ...(draft.company !== undefined ? { company: draft.company } : {}),
              ...(draft.role !== undefined ? { role: draft.role } : {}),
              htmlSource: draft.htmlSource ?? !draft.json,
            });

          } else {
            // New draft, just keep current state or clear it. The old app cleared it or applied default template.
            // But we already have logic for template change. We'll just save it as is.
          }
        });
        return;
      }

      // If we are just changing things, debounce save to DB
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveDraft({
          id: `draft-${state.docType}`,
          html: state.html,
          css: state.css,
          json: state.json,
          templateId: state.templateId,
          company: state.company,
          role: state.role,
          htmlSource: state.htmlSource,
          updatedAt: Date.now(),
        }).catch((e) => console.warn("Failed to save draft:", e));
      }, 1000); // 1s debounce
    });

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);
}

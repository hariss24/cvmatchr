import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage/db", () => ({
  saveDraft: vi.fn(async () => {}),
  loadProfile: vi.fn(async () => null),
}));
import { saveDraft } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { startNewResume } from "@/lib/storage/newResume";

const mockSave = vi.mocked(saveDraft);

/**
 * L'identité du document en cours d'édition.
 *
 * Tout l'enregistrement automatique repose dessus : sans identité stable, chaque
 * envoi crée une copie. Ces tests fixent les trois moments où elle change —
 * changement de type, nouveau CV, et rien d'autre.
 */
beforeEach(() => {
  mockSave.mockReset();
  mockSave.mockImplementation(async () => {});
  useDocStore.setState({ docType: "CV", documentId: null, company: "", role: "" });
});

describe("identité du document courant", () => {
  it("part sans identité : rien n'est encore enregistré sur le compte", () => {
    expect(useDocStore.getState().documentId).toBeNull();
  });

  it("oublie l'identité quand on change de type de document", () => {
    useDocStore.setState({ documentId: "cv-123" });
    useDocStore.getState().setDocType("Lettre");
    // Sans cet oubli, la lettre irait écraser le CV sur le compte.
    expect(useDocStore.getState().documentId).toBeNull();
  });

  it("garde l'identité quand on modifie simplement le contenu", () => {
    useDocStore.setState({ documentId: "cv-123" });
    useDocStore.getState().setJson({ name: "Yasin" } as never);
    useDocStore.getState().setCompany("Acme");
    useDocStore.getState().setRole("Dev");
    expect(useDocStore.getState().documentId).toBe("cv-123");
  });

  it("« Nouveau CV » repart sans identité, dans le store et dans le brouillon", async () => {
    useDocStore.setState({ documentId: "cv-123" });
    await startNewResume();

    expect(useDocStore.getState().documentId).toBeNull();
    expect(mockSave.mock.calls[0][0].documentId).toBeNull();
  });

  it("« Nouveau CV » depuis la lettre repart aussi sans identité", async () => {
    useDocStore.getState().setDocType("Lettre");
    useDocStore.setState({ documentId: "lettre-9" });
    await startNewResume();

    expect(useDocStore.getState().documentId).toBeNull();
  });
});

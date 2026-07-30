import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/storage/db", () => ({
  saveDraft: vi.fn(async () => {}),
  loadProfile: vi.fn(async () => null),
}));
import { saveDraft } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { startNewResume } from "./newResume";

const mockSave = vi.mocked(saveDraft);

beforeEach(() => {
  mockSave.mockReset();
  mockSave.mockImplementation(async () => {});
  useDocStore.setState({ docType: "CV", company: "Acme", role: "Dev" });
  useDocStore.getState().setDocType("CV");
});

describe("startNewResume", () => {
  it("repart d'un CV vierge et oublie la candidature précédente", async () => {
    await startNewResume();
    const { docType, json, company, role } = useDocStore.getState();
    expect(docType).toBe("CV");
    expect((json as { name?: string }).name).toBe("Prénom Nom");
    expect(company).toBe("");
    expect(role).toBe("");
  });

  // LE BUG : « Nouveau CV » écrivait un CV dans le document courant sans regarder
  // son type. Cliqué depuis l'onglet Lettre, il remplaçait la lettre par un CV, que
  // l'auto-sauvegarde persistait dans `draft-Lettre` — après quoi l'onglet Lettre ne
  // rechargeait plus jamais qu'un CV.
  it("bascule sur le type CV quand on est sur la lettre", async () => {
    useDocStore.getState().setDocType("Lettre");
    await startNewResume();

    expect(useDocStore.getState().docType).toBe("CV");
    expect(mockSave.mock.calls.map((c) => c[0].id)).not.toContain("draft-Lettre");
  });

  // `useAutoDraft` recharge `draft-CV` dès que le type change. Poser le document
  // puis basculer ferait l'inverse : sa restauration, plus tardive, écraserait le CV
  // vierge par l'ancien. Le brouillon doit donc être écrit AVANT la bascule.
  it("écrit le brouillon avant de basculer le type", async () => {
    useDocStore.getState().setDocType("Lettre");
    const typesAuMomentDeLEcriture: string[] = [];
    mockSave.mockImplementation(async () => {
      typesAuMomentDeLEcriture.push(useDocStore.getState().docType);
    });

    await startNewResume();

    expect(mockSave.mock.calls[0][0].id).toBe("draft-CV");
    expect(typesAuMomentDeLEcriture[0]).toBe("Lettre");
  });
});

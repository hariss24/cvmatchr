/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/storage/db", () => ({
  saveDraft: vi.fn(async () => {}),
  loadDraft: vi.fn(),
  loadProfile: vi.fn(async () => null),
}));
import { loadDraft } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import { DEFAULT_RESUME, DEFAULT_LETTER } from "@/lib/resume/defaults";
import { useAutoDraft } from "./useAutoDraft";

const mockLoad = vi.mocked(loadDraft);

// Documents complets : un brouillon stocké porte toujours un document entier, et
// `Draft.json` est typé `DocData`. Des littéraux partiels compilaient sous Vitest
// (qui ne vérifie pas les types) mais cassaient `tsc --noEmit`, donc la CI.
const CV = { ...DEFAULT_RESUME, name: "Hariss", title: "Webmaster" };
const LETTRE = { ...DEFAULT_LETTER, sender_name: "Hariss", body: "Bonjour," };

beforeEach(() => {
  mockLoad.mockReset();
  useDocStore.getState().setDocType("CV");
});

describe("useAutoDraft", () => {
  it("restaure le brouillon du type affiché au montage", async () => {
    mockLoad.mockResolvedValue({ id: "draft-CV", json: CV, templateId: "marine", updatedAt: 0 });
    renderHook(() => useAutoDraft());
    await waitFor(() => expect(useDocStore.getState().json).toMatchObject(CV));
  });

  // Le chargement initial lit le type UNE fois, avant son `await`. Si l'utilisateur
  // clique « Lettre » pendant cette attente, la souscription ignore le changement
  // (elle ne fait rien tant que le chargement initial n'est pas fini) : sans
  // rattrapage ici, le CV atterrissait dans le document lettre, et l'auto-sauvegarde
  // le figeait dans `draft-Lettre`.
  it("suit le type quand il change pendant le chargement initial", async () => {
    let libere: (v: unknown) => void = () => {};
    const enAttente = new Promise((r) => { libere = r; });

    mockLoad.mockImplementation(async (id: string) => {
      if (id === "draft-CV") {
        await enAttente;
        return { id, json: CV, templateId: "marine", updatedAt: 0 };
      }
      return { id, json: LETTRE, templateId: "sobre", updatedAt: 0 };
    });

    renderHook(() => useAutoDraft());
    // L'utilisateur bascule avant que le brouillon initial soit revenu.
    useDocStore.getState().setDocType("Lettre");
    libere(null);

    await waitFor(() => expect(useDocStore.getState().json).toMatchObject(LETTRE));
    expect(useDocStore.getState().docType).toBe("Lettre");
  });
});

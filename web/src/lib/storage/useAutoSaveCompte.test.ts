/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/storage/saveDocument", () => ({
  saveCurrentDocument: vi.fn(async () => "account" as const),
}));
vi.mock("@/state/authStore", () => ({
  useAuthStore: { getState: vi.fn(() => ({ user: { id: "user-1" } })) },
}));

import { renderHook, cleanup } from "@testing-library/react";
import { saveCurrentDocument } from "@/lib/storage/saveDocument";
import { useAuthStore } from "@/state/authStore";
import { useDocStore } from "@/state/docStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useSaveStateStore } from "@/state/saveStateStore";
import { useAutoSaveCompte, DELAI_ENVOI_MS } from "./useAutoSaveCompte";
import { pendantRestauration } from "./restaurationBrouillon";

const envoi = vi.mocked(saveCurrentDocument);

/** Laisse passer le délai d'inactivité, puis les promesses en attente. */
async function attendreLEnvoi() {
  await vi.advanceTimersByTimeAsync(DELAI_ENVOI_MS + 10);
}

beforeEach(() => {
  vi.useFakeTimers();
  envoi.mockClear();
  envoi.mockResolvedValue("account");
  vi.mocked(useAuthStore.getState).mockReturnValue({ user: { id: "user-1" } } as never);
  useSettingsStore.setState({ autosaveDelay: 1000 });
  useSaveStateStore.setState({ state: "idle" });
  useDocStore.setState({ docType: "CV", company: "", role: "", documentId: null });
});

afterEach(() => {
  // Sans démontage explicite, le hook du test précédent reste abonné au store
  // et enregistre par-dessus celui du test en cours.
  cleanup();
  vi.useRealTimers();
});

describe("useAutoSaveCompte", () => {
  it("envoie après une pause de frappe, sans le moindre clic", async () => {
    renderHook(() => useAutoSaveCompte());

    useDocStore.getState().setCompany("ACME");
    expect(envoi).not.toHaveBeenCalled(); // pas pendant la frappe

    await attendreLEnvoi();
    expect(envoi).toHaveBeenCalledTimes(1);
    expect(useSaveStateStore.getState().state).toBe("saved");
  });

  it("dix modifications rapprochées ne font qu'un seul envoi", async () => {
    renderHook(() => useAutoSaveCompte());

    for (let i = 0; i < 10; i++) {
      useDocStore.getState().setRole(`Poste ${i}`);
      await vi.advanceTimersByTimeAsync(500);
    }
    await attendreLEnvoi();

    expect(envoi).toHaveBeenCalledTimes(1);
  });

  it("n'envoie rien quand personne n'est connecté, et le dit autrement qu'une panne", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({ user: null } as never);
    renderHook(() => useAutoSaveCompte());

    useDocStore.getState().setCompany("ACME");
    await attendreLEnvoi();

    expect(envoi).not.toHaveBeenCalled();
    expect(useSaveStateStore.getState().state).toBe("anonymous");
  });

  it("ne prétend jamais « Enregistré » quand l'envoi échoue", async () => {
    envoi.mockRejectedValueOnce(new Error("réseau coupé"));
    renderHook(() => useAutoSaveCompte());

    useDocStore.getState().setCompany("ACME");
    await attendreLEnvoi();

    expect(useSaveStateStore.getState().state).toBe("error");
  });

  it("ne réessaie pas en boucle après un échec", async () => {
    envoi.mockRejectedValue(new Error("réseau coupé"));
    renderHook(() => useAutoSaveCompte());

    useDocStore.getState().setCompany("ACME");
    await attendreLEnvoi();
    await vi.advanceTimersByTimeAsync(DELAI_ENVOI_MS * 5);

    expect(envoi).toHaveBeenCalledTimes(1);
  });

  it("respecte l'auto-sauvegarde désactivée dans les réglages", async () => {
    useSettingsStore.setState({ autosaveDelay: 0 });
    renderHook(() => useAutoSaveCompte());

    useDocStore.getState().setCompany("ACME");
    await attendreLEnvoi();

    expect(envoi).not.toHaveBeenCalled();
  });

  // L'envoi réussi pose `documentId` dans le store. Réagir à ce changement
  // relancerait un envoi, qui en poserait un autre : une boucle sans fin.
  it("ne se relance pas tout seul quand l'identité du document est posée", async () => {
    renderHook(() => useAutoSaveCompte());

    useDocStore.getState().setCompany("ACME");
    await attendreLEnvoi();
    envoi.mockClear();

    useDocStore.getState().setDocumentId("doc-1");
    await attendreLEnvoi();

    expect(envoi).not.toHaveBeenCalled();
  });

  // VU À L'ÉCRAN, pas par les tests : à l'ouverture de l'app, `useAutoDraft`
  // repose le brouillon dans le document. La barre affichait « Enregistrement… »
  // avant que l'utilisateur ait touché à quoi que ce soit, et une simple visite
  // créait un document sur le compte.
  it("n'enregistre pas la restauration du brouillon au chargement", async () => {
    renderHook(() => useAutoSaveCompte());

    pendantRestauration(() =>
      useDocStore.setState({ company: "ACME", role: "Dev", documentId: "doc-1" }),
    );
    await attendreLEnvoi();

    expect(envoi).not.toHaveBeenCalled();
    expect(useSaveStateStore.getState().state).toBe("idle");
  });

  it("enregistre bien la frappe qui SUIT une restauration", async () => {
    renderHook(() => useAutoSaveCompte());

    pendantRestauration(() => useDocStore.setState({ company: "ACME" }));
    useDocStore.getState().setRole("Dev");
    await attendreLEnvoi();

    expect(envoi).toHaveBeenCalledTimes(1);
  });

  it("cesse d'écouter une fois démonté", async () => {
    const { unmount } = renderHook(() => useAutoSaveCompte());
    unmount();

    useDocStore.getState().setCompany("ACME");
    await attendreLEnvoi();

    expect(envoi).not.toHaveBeenCalled();
  });
});

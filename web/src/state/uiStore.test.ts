import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore, uiAlert, uiConfirm, uiPrompt, toast } from "./uiStore";

beforeEach(() => {
  useUiStore.setState({ dialog: null, toasts: [] });
});

describe("uiStore — dialogs", () => {
  it("uiConfirm ouvre un dialog confirm et résout true sur OK", async () => {
    const p = uiConfirm("Sûr ?");
    expect(useUiStore.getState().dialog?.kind).toBe("confirm");
    useUiStore.getState().closeDialog(true);
    await expect(p).resolves.toBe(true);
    expect(useUiStore.getState().dialog).toBeNull();
  });

  it("uiConfirm résout false sur Annuler", async () => {
    const p = uiConfirm("Sûr ?");
    useUiStore.getState().closeDialog(false);
    await expect(p).resolves.toBe(false);
  });

  it("uiPrompt résout la saisie, ou null si annulé", async () => {
    const p1 = uiPrompt("Nom ?", "défaut");
    expect(useUiStore.getState().dialog?.defaultValue).toBe("défaut");
    useUiStore.getState().closeDialog("Zoé");
    await expect(p1).resolves.toBe("Zoé");

    const p2 = uiPrompt("Nom ?");
    useUiStore.getState().closeDialog(null);
    await expect(p2).resolves.toBeNull();
  });

  it("uiAlert résout sur OK", async () => {
    const p = uiAlert("Info");
    expect(useUiStore.getState().dialog?.kind).toBe("alert");
    useUiStore.getState().closeDialog();
    await expect(p).resolves.toBeUndefined();
  });
});

describe("uiStore — toasts", () => {
  it("toast empile puis on peut retirer", () => {
    toast("Enregistré", "success");
    let toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe("success");
    useUiStore.getState().removeToast(toasts[0].id);
    toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(0);
  });
});

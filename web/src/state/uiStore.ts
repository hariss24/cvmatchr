import { create } from "zustand";

/**
 * Dialogs et toasts applicatifs — remplacent `ui-dialogs.js` (uiAlert/uiConfirm/uiPrompt).
 * JAMAIS d'`alert/confirm/prompt` natifs. Les fonctions exportées sont à base de promesses et
 * appelables depuis n'importe où (elles passent par `useUiStore.getState()`).
 */

export type DialogKind = "alert" | "confirm" | "prompt";

export type DialogState = {
  kind: DialogKind;
  title?: string;
  message: string;
  defaultValue: string;
  resolve: (value: boolean | string | null | void) => void;
} | null;

export type ToastType = "info" | "success" | "error";
export type ToastAction = { label: string; onClick: () => void };
export type Toast = { id: number; message: string; type: ToastType; action?: ToastAction };

type UiStore = {
  dialog: DialogState;
  toasts: Toast[];
  openDialog: (d: NonNullable<DialogState>) => void;
  closeDialog: (value: boolean | string | null | void) => void;
  pushToast: (message: string, type: ToastType, action?: ToastAction) => void;
  removeToast: (id: number) => void;
};

let toastSeq = 0;

export const useUiStore = create<UiStore>((set, get) => ({
  dialog: null,
  toasts: [],

  openDialog: (d) => set({ dialog: d }),
  closeDialog: (value) => {
    const d = get().dialog;
    set({ dialog: null });
    d?.resolve(value);
  },

  pushToast: (message, type, action) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, message, type, action }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Boîte d'information (un seul bouton OK). */
export function uiAlert(message: string, title?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    useUiStore.getState().openDialog({
      kind: "alert",
      message,
      title,
      defaultValue: "",
      resolve: () => resolve(),
    });
  });
}

/** Confirmation (OK → true, Annuler → false). */
export function uiConfirm(message: string, title?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useUiStore.getState().openDialog({
      kind: "confirm",
      message,
      title,
      defaultValue: "",
      resolve: (v) => resolve(v === true),
    });
  });
}

/** Saisie (OK → texte, Annuler → null). */
export function uiPrompt(message: string, defaultValue = "", title?: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    useUiStore.getState().openDialog({
      kind: "prompt",
      message,
      title,
      defaultValue,
      resolve: (v) => resolve(typeof v === "string" ? v : null),
    });
  });
}

/** Notification éphémère (avec un bouton d'action optionnel, ex. « Annuler »). */
export function toast(message: string, type: ToastType = "info", action?: ToastAction): void {
  useUiStore.getState().pushToast(message, type, action);
}

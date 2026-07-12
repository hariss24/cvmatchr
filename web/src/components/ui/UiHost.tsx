"use client";

import { useEffect, useRef } from "react";
import { useUiStore } from "@/state/uiStore";
import { useGlobalUndoRedo } from "@/lib/useGlobalUndoRedo";

/**
 * Monte les dialogs et toasts applicatifs. À placer une fois dans le layout racine.
 * Remplace les `alert/confirm/prompt` natifs par des modales accessibles (Échap, focus, fermeture).
 */
export default function UiHost() {
  useGlobalUndoRedo();

  return (
    <>
      <DialogHost />
      <ToastHost />
    </>
  );
}

function DialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  // Place le focus à l'ouverture (sans setState : champ prompt non contrôlé).
  useEffect(() => {
    if (!dialog) return;
    const id = requestAnimationFrame(() => {
      if (dialog.kind === "prompt") inputRef.current?.focus();
      else okRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [dialog]);

  if (!dialog) return null;

  const cancel = () => closeDialog(dialog.kind === "prompt" ? null : false);
  const confirm = () =>
    closeDialog(
      dialog.kind === "prompt"
        ? inputRef.current?.value ?? ""
        : dialog.kind === "confirm"
          ? true
          : undefined,
    );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && dialog.kind === "prompt") confirm();
  };

  return (
    <div className="ui-overlay" role="presentation" onClick={cancel}>
      <div
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title ?? "Dialogue"}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {dialog.title ? <h2 className="ui-dialog__title">{dialog.title}</h2> : null}
        <p className="ui-dialog__message">{dialog.message}</p>
        {dialog.kind === "prompt" ? (
          <input ref={inputRef} className="form-input" defaultValue={dialog.defaultValue} />
        ) : null}
        <div className="ui-dialog__actions">
          {dialog.kind !== "alert" ? (
            <button type="button" className="form-btn-mini" onClick={cancel}>
              Annuler
            </button>
          ) : null}
          <button ref={okRef} type="button" className="go ui-dialog__ok" onClick={confirm}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    // Toast avec action (ex. « Annuler ») : laisser plus de temps pour réagir.
    const timers = toasts.map((t) => setTimeout(() => removeToast(t.id), t.action ? 6000 : 3500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="ui-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ui-toast ui-toast--${t.type}`} onClick={() => removeToast(t.id)}>
          <span className="ui-toast__message">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="ui-toast__action"
              onClick={(e) => {
                e.stopPropagation();
                t.action?.onClick();
                removeToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

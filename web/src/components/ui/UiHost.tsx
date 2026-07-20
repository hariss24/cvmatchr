"use client";

import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { useGlobalUndoRedo } from "@/lib/useGlobalUndoRedo";
import { useSettingsStore } from "@/state/settingsStore";

/**
 * Monte les dialogs et toasts applicatifs. À placer une fois dans le layout racine.
 * Remplace les `alert/confirm/prompt` natifs par des modales accessibles (Échap, focus, fermeture).
 */
export default function UiHost() {
  useGlobalUndoRedo();

  return (
    <>
      <ThemeHost />
      <DialogHost />
      <ToastHost />
    </>
  );
}

function ThemeHost() {
  const accentColor = useSettingsStore((s) => s.accentColor);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    // Observer for dark mode changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.attributeName === "data-theme") {
          setTheme(document.documentElement.getAttribute("data-theme") || "light");
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    
    const initialTheme = document.documentElement.getAttribute("data-theme") || "light";
    const id = setTimeout(() => setTheme(initialTheme), 0);
    return () => {
      observer.disconnect();
      clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (accentColor === "orange") {
      document.documentElement.style.removeProperty("--orange");
      document.documentElement.style.removeProperty("--orange2");
      document.documentElement.style.removeProperty("--orange-hover");
      document.documentElement.style.removeProperty("--orange-text");
      document.documentElement.style.removeProperty("--on-orange");
      document.documentElement.style.removeProperty("--link");
      document.documentElement.style.removeProperty("--cta-grad");
      return;
    }

    const palettes: Record<string, Record<string, Record<string, string>>> = {
      blue: {
        light: { "--orange": "#1565C0", "--orange2": "#1E88E5", "--orange-hover": "#0D47A1", "--orange-text": "#0D47A1", "--on-orange": "#FFFFFF", "--link": "#1565C0", "--cta-grad": "linear-gradient(180deg, #1E88E5, #1565C0)" },
        dark:  { "--orange": "#42A5F5", "--orange2": "#64B5F6", "--orange-hover": "#1E88E5", "--orange-text": "#64B5F6", "--on-orange": "#0D47A1", "--link": "#64B5F6", "--cta-grad": "linear-gradient(180deg, #64B5F6, #42A5F5)" }
      },
      green: {
        light: { "--orange": "#2E7D32", "--orange2": "#43A047", "--orange-hover": "#1B5E20", "--orange-text": "#1B5E20", "--on-orange": "#FFFFFF", "--link": "#2E7D32", "--cta-grad": "linear-gradient(180deg, #43A047, #2E7D32)" },
        dark:  { "--orange": "#66BB6A", "--orange2": "#81C784", "--orange-hover": "#43A047", "--orange-text": "#81C784", "--on-orange": "#1B5E20", "--link": "#81C784", "--cta-grad": "linear-gradient(180deg, #81C784, #66BB6A)" }
      },
      purple: {
        light: { "--orange": "#6A1B9A", "--orange2": "#8E24AA", "--orange-hover": "#4A148C", "--orange-text": "#4A148C", "--on-orange": "#FFFFFF", "--link": "#6A1B9A", "--cta-grad": "linear-gradient(180deg, #8E24AA, #6A1B9A)" },
        dark:  { "--orange": "#AB47BC", "--orange2": "#BA68C8", "--orange-hover": "#8E24AA", "--orange-text": "#BA68C8", "--on-orange": "#4A148C", "--link": "#BA68C8", "--cta-grad": "linear-gradient(180deg, #BA68C8, #AB47BC)" }
      }
    };

    const vars = palettes[accentColor]?.[theme] || {};
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    
  }, [accentColor, theme]);

  return null;
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

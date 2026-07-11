"use client";

import { useEffect, useRef } from "react";
import { parseTokens, type TokenSegment } from "@/lib/templates/tokens";

/**
 * Éditeur à étiquettes (variables inline), fait maison, sans dépendance.
 * La chaîne tokenisée `value` est la source de vérité ; les tokens `{Var}` sont
 * affichés comme pastilles atomiques (`contentEditable={false}`). La saisie est
 * resérialisée vers la même syntaxe et remontée via `onChange`. Le token brut
 * (repli inclus) est conservé dans `data-token`, donc réémis fidèlement.
 */
export default function VariableEditor({
  value,
  onChange,
  variables,
  disabled,
  ariaLabel,
  minHeightPx = 120,
}: {
  value: string;
  onChange: (next: string) => void;
  variables: readonly string[];
  disabled?: boolean;
  ariaLabel: string;
  minHeightPx?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Dernière valeur émise par CE composant : sert à ignorer les re-render dus à
  // notre propre onChange (sinon le curseur saute pendant la frappe).
  const lastEmitted = useRef<string | null>(null);

  const buildDom = (root: HTMLElement, segments: TokenSegment[]) => {
    root.textContent = "";
    for (const seg of segments) {
      if (seg.type === "text") {
        root.appendChild(document.createTextNode(seg.text));
      } else {
        const pill = document.createElement("span");
        pill.className = "var-pill";
        pill.contentEditable = "false";
        pill.dataset.token = seg.raw;
        pill.textContent = seg.name;
        root.appendChild(pill);
      }
    }
    // Nœud texte final pour que le curseur puisse se poser après une pastille terminale.
    const lastNode = root.lastChild;
    if (!lastNode || (lastNode as HTMLElement).dataset?.token) {
      root.appendChild(document.createTextNode(""));
    }
  };

  const serialize = (root: HTMLElement): string => {
    let out = "";
    root.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue ?? "";
      } else if (node instanceof HTMLElement) {
        out += node.dataset.token ?? node.textContent ?? "";
      }
    });
    return out;
  };

  // Synchronisation externe : ne reconstruit le DOM que si `value` vient d'ailleurs
  // (changement de modèle, adaptation IA), pas de notre propre saisie.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (value === lastEmitted.current) return;
    buildDom(root, parseTokens(value));
    lastEmitted.current = value;
  }, [value]);

  const emit = () => {
    const root = ref.current;
    if (!root) return;
    const next = serialize(root);
    lastEmitted.current = next;
    onChange(next);
  };

  // Supprime la pastille adjacente au curseur. Les pastilles sont atomiques
  // (`contentEditable=false`) et le navigateur ne les retire pas de façon fiable au
  // Backspace/Delete, surtout avec un nœud texte vide voisin — on le fait à la main.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;
    const isEmptyText = (n: Node | null): n is Text =>
      n != null && n.nodeType === Node.TEXT_NODE && (n.nodeValue ?? "") === "";
    const isPill = (n: Node | null): n is HTMLElement =>
      n instanceof HTMLElement && n.dataset.token != null;

    let candidate: Node | null = null;
    if (e.key === "Backspace") {
      if (node === root) candidate = offset > 0 ? root.childNodes[offset - 1] : null;
      else if (node.nodeType === Node.TEXT_NODE && offset === 0) candidate = node.previousSibling;
      while (isEmptyText(candidate)) candidate = candidate.previousSibling;
    } else {
      if (node === root) candidate = offset < root.childNodes.length ? root.childNodes[offset] : null;
      else if (node.nodeType === Node.TEXT_NODE && offset === (node.nodeValue?.length ?? 0)) candidate = node.nextSibling;
      while (isEmptyText(candidate)) candidate = candidate.nextSibling;
    }
    if (isPill(candidate)) {
      e.preventDefault();
      candidate.remove();
      emit();
    }
  };

  const insertVariable = (name: string) => {
    const root = ref.current;
    if (!root || disabled) return;
    root.focus();
    const sel = window.getSelection();
    const pill = document.createElement("span");
    pill.className = "var-pill";
    pill.contentEditable = "false";
    pill.dataset.token = `{${name}}`;
    pill.textContent = name;

    let range: Range;
    if (sel && sel.rangeCount > 0 && root.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
      range.deleteContents();
    } else {
      range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }
    const after = document.createTextNode("");
    range.insertNode(after);
    range.insertNode(pill);
    // Curseur juste après la pastille insérée.
    const caret = document.createRange();
    caret.setStartAfter(pill);
    caret.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(caret);
    emit();
  };

  return (
    <div className="var-editor-group">
      <div className="var-btns" aria-label={`Insérer une variable dans ${ariaLabel}`}>
        {variables.map((v) => (
          <button key={v} type="button" className="var-btn" disabled={disabled} onClick={() => insertVariable(v)}>
            + {v}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="var-editor"
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-value={value}
        contentEditable={!disabled}
        suppressContentEditableWarning
        style={{ minHeight: minHeightPx }}
        onInput={emit}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
    </div>
  );
}

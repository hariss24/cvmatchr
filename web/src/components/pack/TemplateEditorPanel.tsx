"use client";

import type { MailTemplate } from "@/lib/templates/defaults";

/**
 * Champs courts d'un modèle lettre/email (objet, formule d'appel, politesse, objet
 * email). Les corps longs sont édités par `VariableEditor` dans `PackView`.
 */
export default function TemplateEditorPanel({
  tpl,
  onChange,
  disabled,
}: {
  tpl: MailTemplate;
  onChange: (patch: Partial<MailTemplate>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tpl-editor">
      <label className="form-label">Objet de la lettre</label>
      <input className="form-input" value={tpl.letterSubject} disabled={disabled}
        onChange={(e) => onChange({ letterSubject: e.target.value })} />

      <label className="form-label">Formule d&apos;appel</label>
      <input className="form-input" value={tpl.letterGreeting} disabled={disabled}
        onChange={(e) => onChange({ letterGreeting: e.target.value })} />

      <label className="form-label">Formule de politesse</label>
      <textarea className="form-textarea" rows={2} value={tpl.letterSignoff} disabled={disabled}
        onChange={(e) => onChange({ letterSignoff: e.target.value })} />

      <label className="form-label">Objet de l&apos;email</label>
      <input className="form-input" value={tpl.emailSubject} disabled={disabled}
        onChange={(e) => onChange({ emailSubject: e.target.value })} />
    </div>
  );
}

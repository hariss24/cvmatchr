"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { generateResumePdfBlob } from "@/lib/pdfgen/generatePdf";
import { buildPdfFilename } from "@/lib/pdfgen/filename";
import { buildAutofillPackage } from "@/lib/extension/autofillPackage";
import { postAutofillPackage } from "@/lib/extension/bridge";
import { toast } from "@/state/uiStore";
import type { LetterIdentity } from "@/lib/profile/profile";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function ExtensionExportButton({
  identity,
  company,
  role,
  coverLetterText,
}: {
  identity: LetterIdentity;
  company: string;
  role: string;
  coverLetterText: string;
}) {
  const [busy, setBusy] = useState(false);
  const templateId = useDocStore((s) => s.templateId);

  const onClick = async () => {
    setBusy(true);
    try {
      const blob = await generateResumePdfBlob(identity.cv, templateId);
      const base64 = await blobToBase64(blob);
      const filename = `${buildPdfFilename("CV", role, false)}.pdf`;
      const pkg = buildAutofillPackage({
        identity,
        company,
        role,
        coverLetterText,
        resumeFilename: filename,
        resumeBase64: base64,
        now: Date.now(),
      });
      const ok = await postAutofillPackage(pkg);
      toast(
        ok
          ? "Préparé pour l'extension — ouvre une offre Greenhouse ou Lever."
          : "Extension CVMatchr non détectée (voir extension/README.md).",
        ok ? "success" : "error",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de la préparation.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="form-btn-mini" onClick={onClick} disabled={busy}>
      {busy ? "Préparation…" : "Préparer pour l'extension"}
    </button>
  );
}

import { saveSnapshot, type Snapshot } from "@/lib/storage/db";
import { useDocStore } from "@/state/docStore";
import type { Resume } from "@/lib/resume/schema";

export async function takeSnapshot(customLabel?: string) {
  const { json, html, css, docType } = useDocStore.getState();
  if (!html) return;

  const label = customLabel || new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const resume = json as Resume;
  const company = resume.name ? resume.name.trim() : ""; // actually we don't have company/role explicitly in doc_type=CV outside of resume content unless it's in history. Wait, the old app had `company` and `role` inputs in the history form or in the toolbar.
  // In the new app, we don't have separate company/role global inputs except in the Pack Modal.
  // We'll leave them empty for now.
  
  const snap: Snapshot = {
    ts: Date.now(),
    label,
    html,
    css,
    json: structuredClone(json),
    doc_type: docType,
    company: "",
    role: "",
  };

  await saveSnapshot(snap);
}

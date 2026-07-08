import { postJson } from "@/lib/ai/client";

/**
 * Extrait entreprise + poste d'une offre via /api/extract-meta.
 * Échec silencieux (null) : le préremplissage est un confort, il ne doit jamais bloquer.
 */
export async function fetchJobMeta(
  jobDesc: string,
): Promise<{ company: string; role: string } | null> {
  const desc = jobDesc.trim();
  if (!desc) return null;
  try {
    return await postJson<{ company: string; role: string }>("/api/extract-meta", { job_desc: desc });
  } catch {
    return null;
  }
}

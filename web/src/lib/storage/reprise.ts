import {
  db,
  saveHistoryEntry,
  putApplication,
  saveJob,
  saveProfile,
  saveJobProfile,
  saveTemplate,
  loadDraft,
} from "@/lib/storage/db";
import { saveMasterResume } from "@/lib/storage/master";
import type { Resume } from "@/lib/resume/schema";

const REPRISE_DONE_KEY = "reprise_locale_faite";

/**
 * Lit les tables Dexie locales de l'ancien monde et les envoie sur le compte distant.
 * Ne s'exécute qu'une seule fois grâce au drapeau `reprise_locale_faite`.
 * Renvoie le nombre d'éléments repris.
 */
export async function reprendreDonneesLocales(): Promise<number> {
  if (typeof localStorage !== "undefined" && localStorage.getItem(REPRISE_DONE_KEY)) {
    return 0;
  }

  let count = 0;

  // 1. Documents (CV & Lettres)
  if (db.history) {
    const historyEntries = await db.history.toArray();
    for (const entry of historyEntries) {
      await saveHistoryEntry(entry);
      count++;
    }
  }

  // 2. Candidatures
  if (db.applications) {
    const applications = await db.applications.toArray();
    for (const app of applications) {
      await putApplication(app);
      count++;
    }
  }

  // 3. Offres enregistrées
  if (db.jobs) {
    const jobs = await db.jobs.toArray();
    for (const job of jobs) {
      await saveJob(job);
      count++;
    }
  }

  // 4. Profil
  if (db.profile) {
    const localProfile = await db.profile.get("me");
    if (localProfile) {
      await saveProfile(localProfile);
      count++;
    }
  }

  // 5. Critères de recherche d'offres
  if (db.jobProfile) {
    const localJobProfile = await db.jobProfile.get("me");
    if (localJobProfile?.profile) {
      await saveJobProfile(localJobProfile.profile);
      count++;
    }
  }

  // 6. Modèles de lettres
  if (db.templates) {
    const templates = await db.templates.toArray();
    for (const t of templates) {
      await saveTemplate(t);
      count++;
    }
  }

  // 7. CV Maître (ancien draft `draft-Maître`)
  const masterDraft = await loadDraft("draft-Maître");
  if (masterDraft && masterDraft.json) {
    await saveMasterResume(masterDraft.json as Resume, masterDraft.templateId);
    count++;
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(REPRISE_DONE_KEY, "1");
  }

  return count;
}

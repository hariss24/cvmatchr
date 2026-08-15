import {
  db,
  allAtsEntries,
  listHistoryEntries,
  getHistoryEntry,
  saveHistoryEntry,
  listJobs,
  saveJob,
  listApplicationsRaw,
  putApplication,
  listTemplates,
  saveTemplate,
  loadProfile,
  saveProfile,
} from "./db";
import { cacheClear } from "./sessionCache";
import { toast, uiConfirm } from "@/state/uiStore";

export async function exportDatabase(): Promise<void> {
  try {
    const historySummaries = await listHistoryEntries().catch(() => []);
    const fullHistory = await Promise.all(
      historySummaries.map(async (s) => (await getHistoryEntry(s.id)) ?? s)
    );
    const jobs = await listJobs().catch(() => []);
    const applications = await listApplicationsRaw().catch(() => []);
    const templates = await listTemplates().catch(() => []);
    const profile = await loadProfile().catch(() => null);

    const data = {
      snapshots: await db.snapshots.toArray(),
      drafts: await db.drafts.toArray(),
      history: fullHistory,
      jobs,
      applications,
      templates,
      profile: profile ? [profile] : [],
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `cvmatchr-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    toast("Exportation réussie.", "success");
  } catch (error) {
    console.error("Export failed:", error);
    toast("Erreur lors de l'exportation.", "error");
  }
}

export async function importDatabase(jsonString: string): Promise<boolean> {
  const confirmed = await uiConfirm(
    "Voulez-vous vraiment importer ces données ? Cela mettra à jour vos documents, offres et candidatures. Cette action est irréversible.",
    "Importer les données"
  );

  if (!confirmed) return false;

  try {
    const data = JSON.parse(jsonString);

    // Clear local snapshots & drafts
    await db.snapshots.clear();
    await db.drafts.clear();

    if (data.snapshots && data.snapshots.length > 0) await db.snapshots.bulkAdd(data.snapshots);
    if (data.drafts && data.drafts.length > 0) await db.drafts.bulkAdd(data.drafts);

    if (data.history && Array.isArray(data.history)) {
      for (const h of data.history) {
        if (h && h.id && h.doc_type) {
          await saveHistoryEntry(h).catch(() => {});
        }
      }
    }

    if (data.jobs && Array.isArray(data.jobs)) {
      for (const j of data.jobs) {
        if (j && j.id) {
          await saveJob(j).catch(() => {});
        }
      }
    }

    if (data.applications && Array.isArray(data.applications)) {
      for (const a of data.applications) {
        if (a && a.id) {
          await putApplication(a).catch(() => {});
        }
      }
    }

    if (data.templates && Array.isArray(data.templates)) {
      for (const t of data.templates) {
        if (t && t.id) {
          await saveTemplate(t).catch(() => {});
        }
      }
    }

    if (data.profile && Array.isArray(data.profile) && data.profile[0]) {
      await saveProfile(data.profile[0]).catch(() => {});
    }

    cacheClear();
    toast("Importation réussie. L'application va se recharger.", "success");
    setTimeout(() => window.location.reload(), 1500);
    return true;
  } catch (error) {
    console.error("Import failed:", error);
    toast("Erreur lors de l'importation ou fichier invalide.", "error");
    return false;
  }
}

export async function resetDatabase(): Promise<void> {
  const confirmed = await uiConfirm(
    "Voulez-vous vraiment effacer les brouillons et instantanés locaux ? Cette action est irréversible.",
    "Réinitialiser"
  );

  if (!confirmed) return;

  try {
    await db.snapshots.clear();
    await db.drafts.clear();
    cacheClear();

    toast("Données locales effacées. L'application va se recharger.", "success");
    setTimeout(() => window.location.reload(), 1500);
  } catch (error) {
    console.error("Reset failed:", error);
    toast("Erreur lors de la réinitialisation.", "error");
  }
}

export async function exportAtsDirectory(): Promise<void> {
  try {
    const entries = await allAtsEntries();
    if (entries.length === 0) {
      toast("Aucune entreprise résolue pour l'instant.", "error");
      return;
    }

    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `cvmatchr-annuaire-ats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    toast(`${entries.length} entreprises exportées.`, "success");
  } catch (error) {
    console.error("Export ATS failed:", error);
    toast("Erreur lors de l'exportation de l'annuaire.", "error");
  }
}

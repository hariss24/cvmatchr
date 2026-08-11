import { db, allAtsEntries } from "./db";
import { toast, uiConfirm } from "@/state/uiStore";
import { sanitizeImportedItem } from "./syncEngine";

export async function exportDatabase(): Promise<void> {
  try {
    const rawHistory = await db.history.toArray();
    const rawJobs = await db.jobs.toArray();
    const rawApps = await db.applications.toArray();

    const stripSynced = <T extends Record<string, unknown>>({ synced_at: _, ...rest }: T) => rest;

    const data = {
      snapshots: await db.snapshots.toArray(),
      drafts: await db.drafts.toArray(),
      history: rawHistory.map((h) => stripSynced(h as unknown as Record<string, unknown>)),
      jobs: rawJobs.map((j) => stripSynced(j as unknown as Record<string, unknown>)),
      applications: rawApps.map((a) => stripSynced(a as unknown as Record<string, unknown>)),
      templates: await db.templates.toArray(),
      profile: await db.profile.toArray(),
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
    "Voulez-vous vraiment importer ces données ? Cela remplacera toutes les données actuelles de l'application (Historique, Offres, Profil, etc.). Si vous êtes connecté, le contenu importé sera également répliqué sur votre compte. Cette action est irréversible.",
    "Importer les données"
  );
  
  if (!confirmed) return false;

  try {
    const data = JSON.parse(jsonString);

    await db.transaction("rw", [db.snapshots, db.drafts, db.history, db.jobs, db.applications, db.templates, db.profile], async () => {
      // Clear existing data
      await db.snapshots.clear();
      await db.drafts.clear();
      await db.history.clear();
      await db.jobs.clear();
      await db.applications.clear();
      await db.templates.clear();
      await db.profile.clear();

      // Bulk add new data if present
      if (data.snapshots && data.snapshots.length > 0) await db.snapshots.bulkAdd(data.snapshots);
      if (data.drafts && data.drafts.length > 0) await db.drafts.bulkAdd(data.drafts);
      if (data.history && data.history.length > 0) await db.history.bulkAdd(data.history.map(sanitizeImportedItem));
      if (data.jobs && data.jobs.length > 0) await db.jobs.bulkAdd(data.jobs.map(sanitizeImportedItem));
      if (data.applications && data.applications.length > 0) await db.applications.bulkAdd(data.applications.map(sanitizeImportedItem));
      if (data.templates && data.templates.length > 0) await db.templates.bulkAdd(data.templates);
      if (data.profile && data.profile.length > 0) await db.profile.bulkAdd(data.profile);
    });

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
    "Voulez-vous vraiment effacer TOUTES les données ? L'historique, les offres, et les profils seront supprimés. Cette action est irréversible.",
    "Réinitialiser"
  );

  if (!confirmed) return;

  try {
    await db.transaction("rw", [db.snapshots, db.drafts, db.history, db.jobs, db.templates, db.profile], async () => {
      await db.snapshots.clear();
      await db.drafts.clear();
      await db.history.clear();
      await db.jobs.clear();
      await db.templates.clear();
      await db.profile.clear();
    });
    
    toast("Données effacées. L'application va se recharger.", "success");
    setTimeout(() => window.location.reload(), 1500);
  } catch (error) {
    console.error("Reset failed:", error);
    toast("Erreur lors de la réinitialisation.", "error");
  }
}

/**
 * Annuaire entreprise → ATS, seul, au format plat.
 *
 * Distinct d'`exportDatabase` : celui-ci est une sauvegarde personnelle, celui-là
 * un extrait destiné à être agrégé ailleurs.
 *
 * Tableau et non dictionnaire, `resolvedAt` conservé : c'est ce qui permettra de
 * fusionner plusieurs exports en gardant l'entrée la plus fraîche, et de périmer
 * un jour les « none ». Un dictionnaire sans date rendrait les deux impossibles.
 */
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

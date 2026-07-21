import { db } from "./db";
import { toast, uiConfirm } from "@/state/uiStore";

export async function exportDatabase(): Promise<void> {
  try {
    const data = {
      snapshots: await db.snapshots.toArray(),
      drafts: await db.drafts.toArray(),
      history: await db.history.toArray(),
      jobs: await db.jobs.toArray(),
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
    "Voulez-vous vraiment importer ces données ? Cela remplacera toutes les données actuelles de l'application (Historique, Offres, Profil, etc.). Cette action est irréversible.",
    "Importer les données"
  );
  
  if (!confirmed) return false;

  try {
    const data = JSON.parse(jsonString);

    await db.transaction("rw", [db.snapshots, db.drafts, db.history, db.jobs, db.templates, db.profile], async () => {
      // Clear existing data
      await db.snapshots.clear();
      await db.drafts.clear();
      await db.history.clear();
      await db.jobs.clear();
      await db.templates.clear();
      await db.profile.clear();

      // Bulk add new data if present
      if (data.snapshots && data.snapshots.length > 0) await db.snapshots.bulkAdd(data.snapshots);
      if (data.drafts && data.drafts.length > 0) await db.drafts.bulkAdd(data.drafts);
      if (data.history && data.history.length > 0) await db.history.bulkAdd(data.history);
      if (data.jobs && data.jobs.length > 0) await db.jobs.bulkAdd(data.jobs);
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

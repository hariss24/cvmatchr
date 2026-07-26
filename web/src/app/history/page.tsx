import { redirect } from "next/navigation";

/** L'Historique a été absorbé par « Mes candidatures » (spec du 25/07/2026). */
export default function HistoryPage() {
  redirect("/candidatures");
}

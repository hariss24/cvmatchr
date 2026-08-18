"use client";

import { useEffect, useState } from "react";
import { createBrowserClientHelper } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";

export default function QuotaBadge() {
  const user = useAuthStore((s) => s.user);
  const [used, setUsed] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(15);

  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClientHelper();
    if (!supabase) return;

    let mounted = true;
    async function loadQuota() {
      try {
        const { data: usageData, error: usageErr } = await supabase!.rpc("get_user_monthly_ai_usage");
        if (!usageErr && typeof usageData === "number") {
          if (mounted) setUsed(usageData);
        }
        const { data: profData } = await supabase!
          .from("profiles")
          .select("monthly_quota_limit")
          .eq("id", user!.id)
          .single();
        if (profData?.monthly_quota_limit && mounted) {
          setLimit(profData.monthly_quota_limit);
        }
      } catch (e) {
        console.warn("QuotaBadge error:", e);
      }
    }
    loadQuota();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Le compteur occupe sa place AVANT de connaître son chiffre. Il rendait
  // `null` pendant l'aller-retour serveur, puis apparaissait : sur mobile, où
  // il ouvre le menu ☰, tout le menu sautait d'une ligne sous le doigt de
  // l'utilisateur — au moment précis où il vise « Nouveau CV ».
  //
  // Un chiffre inventé pendant l'attente serait pire que le décalage : on
  // réserve la hauteur, on n'annonce rien. Si la lecture échoue, la ligne reste
  // vide plutôt que d'afficher un solde faux.
  return (
    <span
      className="quota-badge"
      style={{ fontSize: "0.85em", opacity: 0.8, minHeight: "1.2em", display: "inline-block" }}
    >
      {used === null ? " " : `${used} / ${limit} crédits ce mois-ci`}
    </span>
  );
}

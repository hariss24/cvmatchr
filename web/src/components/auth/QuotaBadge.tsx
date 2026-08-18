"use client";

import { useEffect, useState } from "react";
import { createBrowserClientHelper } from "@/lib/supabase/client";
import { useAuthStore } from "@/state/authStore";

/**
 * Lit le solde de crédits du mois. `used === null` = pas encore connu.
 *
 * Extrait du badge parce que deux écrans l'affichent différemment : une phrase
 * dans le menu du haut, une jauge dans le menu ☰ mobile — où c'est le seul
 * endroit où l'utilisateur peut consulter son solde.
 */
export function useQuota() {
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

  return { used, limit };
}

export default function QuotaBadge() {
  const { used, limit } = useQuota();

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
      {used === null ? " " : `${used} / ${limit} crédits ce mois-ci`}
    </span>
  );
}

/**
 * Le même solde, en jauge — pour le menu ☰ mobile.
 *
 * Une barre se lit sans être lue : elle dit « il t'en reste beaucoup » ou
 * « tu y es presque » avant que l'œil n'atteigne le chiffre. Elle tient sa
 * place dès le premier rendu, vide, plutôt que d'afficher un solde inventé.
 */
export function QuotaGauge() {
  const { used, limit } = useQuota();
  const connu = used !== null;
  const part = connu && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className={`mm-credits${connu ? "" : " is-loading"}`}>
      <div className="mm-credits__top">
        <span className="mm-credits__label">Crédits ce mois-ci</span>
        <span className="mm-credits__num">{connu ? `${used} / ${limit}` : "—"}</span>
      </div>
      <div className="mm-credits__bar">
        {connu && (
          <div
            className={`mm-credits__fill${part >= 85 ? " mm-credits__fill--low" : ""}`}
            style={{ width: `${part}%` }}
          />
        )}
      </div>
    </div>
  );
}

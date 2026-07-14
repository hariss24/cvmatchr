import { Text } from "@react-pdf/renderer";

/**
 * Booster ATS — les mots-clés manquants (`docStore.atsBoost`, alimenté par `AtsPanel`) sont
 * intégrés au document en texte quasi invisible (1pt, blanc) pour les analyseurs ATS.
 * Rendu en fin de document, ne modifie pas la mise en page visible.
 */
export function AtsBoost({ keywords }: { keywords?: string[] }) {
  if (!keywords?.length) return null;
  return <Text style={{ fontSize: 1, color: "#ffffff" }}>{keywords.join(" ")}</Text>;
}

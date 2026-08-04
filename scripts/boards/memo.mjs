// L'index et le mémo : deux fichiers, deux rôles opposés.
//
//   boards-fr.json        les boards ayant >= 1 offre française. Lu par l'app.
//                         Doit rester un diff lisible.
//   boards-fr-testes.json tout ce qui a été essayé, succès ET échecs. Lu par
//                         ce script seul. Sans lui, l'incrémental n'existe pas.

/** Identité stable d'un board. */
export function cle(ats, slug) {
  return `${ats}:${slug}`;
}

/** Date au mois, « 2026-08 ». */
export function mois(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Une entrée est fraîche si elle date du mois courant ou du précédent.
 *
 * La TTL s'exprime en mois parce que le mémo date au mois : à raison d'un
 * passage hebdomadaire, une date au jour ferait bouger un quart des ~30 000
 * lignes à chaque exécution. L'ancienneté réelle tolérée oscille donc entre 30
 * et 60 jours — sans conséquence, un ATS ne change pas en huit semaines.
 */
export function estFrais(vuLe, date) {
  if (!vuLe) return false;
  const precedent = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return vuLe === mois(date) || vuLe === mois(precedent);
}

/**
 * Nom d'affichage déduit du slug.
 *
 * La source A ne dispose de rien d'autre : vérifié le 04/08/2026, la racine
 * Ashby ne porte que { jobs, apiVersion } et aucune offre Lever ou Greenhouse ne
 * contient de champ entreprise. C'est une étiquette imparfaite et assumée ; la
 * source B l'écrase par la raison sociale SIRENE quand elle retrouve le board.
 */
export function nomDepuisSlug(slug) {
  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    .join(" ");
}

/** Tri par nom puis par ats — le second critère rend l'ordre déterministe. */
export function trierIndex(entrees) {
  return [...entrees].sort(
    (a, b) => a.nom.localeCompare(b.nom, "fr") || a.ats.localeCompare(b.ats),
  );
}

export function trierMemo(entrees) {
  return [...entrees].sort((a, b) => a.cle.localeCompare(b.cle));
}

/**
 * Applique les constats d'un passage à l'index existant.
 *
 * `trouvailles` ne contient que des boards RÉELLEMENT testés avec une réponse
 * exploitable — jamais un `null` de `compterFR`. Une entrée absente des
 * trouvailles n'a pas été retestée : on la laisse telle quelle.
 */
export function fusionner(index, trouvailles) {
  const parCle = new Map(index.map((e) => [cle(e.ats, e.slug), e]));

  for (const t of trouvailles) {
    const k = cle(t.ats, t.slug);
    if (t.offresFR > 0) {
      const ancien = parCle.get(k);
      parCle.set(k, { ...ancien, ...t, siren: t.siren ?? ancien?.siren ?? null });
    } else {
      parCle.delete(k);
    }
  }

  return trierIndex([...parCle.values()]);
}

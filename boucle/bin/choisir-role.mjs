/**
 * Choix du rôle joué par un réveil de la boucle.
 *
 * Volontairement pur et testé : le rôle ne doit jamais dépendre du jugement de
 * l'agent.
 *
 * Depuis le 02/08/2026, la boucle n'implémente plus rien (décision du
 * propriétaire) : elle explore et elle classe, il décide. Deux rôles seulement,
 * qui alternent — découvrir une idée et comparer dix idées entre elles sont deux
 * actes différents, et les mélanger produit un classement écrit par celui qui
 * vient de s'enthousiasmer pour sa trouvaille.
 */
import { readFile } from "node:fs/promises";

export const ROLES = ["Éclaireur", "Arbitre"];

/** `null` = pas de pause. Un fichier sans nom de rôle gèle tout. */
export function lirePause(texte) {
  if (texte === null || texte === undefined) return null;
  return { rolesGeles: ROLES.filter((r) => texte.includes(r)) };
}

/**
 * Rôle du réveil précédent, lu dans `ETAT.md` (ligne « **Rôle joué :** … »).
 * Absent ou illisible → `null`, et l'alternance repart sur l'Éclaireur.
 */
export function lireDernierRole(texte) {
  if (!texte) return null;
  const ligne = texte.split("\n").find((l) => l.includes("Rôle joué"));
  if (!ligne) return null;
  return ROLES.find((r) => ligne.includes(r)) ?? null;
}

export function choisirRole({ pause = null, dernierRole = null }) {
  const geles = pause ? (pause.rolesGeles.length > 0 ? pause.rolesGeles : ROLES) : [];
  const libre = (role) => !geles.includes(role);

  // Alternance stricte. Après un Éclaireur, on classe ce qu'il a rapporté ; sinon
  // les idées s'empilent sans jamais être comparées, et le fichier de classement
  // devient une liste de courses.
  const voulu = dernierRole === "Éclaireur" ? "Arbitre" : "Éclaireur";
  if (libre(voulu)) return voulu;

  const autre = voulu === "Éclaireur" ? "Arbitre" : "Éclaireur";
  if (libre(autre)) return autre;

  return "Pause";
}

async function lireOuNull(chemin) {
  try {
    return await readFile(chemin, "utf8");
  } catch {
    return null;
  }
}

// Interface ligne de commande, appelée par le workflow.
if (process.argv[1]?.endsWith("choisir-role.mjs")) {
  const pause = lirePause(await lireOuNull("boucle/PAUSE.md"));
  const dernierRole = lireDernierRole(await lireOuNull("boucle/ETAT.md"));

  process.stdout.write(`role=${choisirRole({ pause, dernierRole })}\n`);
}

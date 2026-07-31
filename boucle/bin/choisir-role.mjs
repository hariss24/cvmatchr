/**
 * Choix du rôle joué par un réveil de la boucle.
 *
 * Volontairement pur et testé : le rôle ne doit jamais dépendre du jugement de
 * l'agent. L'ordre de priorité est réparer > livrer > planifier > explorer —
 * explorer arrive en dernier parce que c'est la tâche la plus agréable, donc celle
 * qui monopoliserait tout si on la laissait libre.
 */
import { readFile } from "node:fs/promises";

export const ROLES = ["Gardien", "Bâtisseur", "Architecte", "Éclaireur"];

/** `null` = pas de pause. Un fichier sans nom de rôle gèle tout. */
export function lirePause(texte) {
  if (texte === null || texte === undefined) return null;
  return { rolesGeles: ROLES.filter((r) => texte.includes(r)) };
}

function lignesDeSection(texte, titre) {
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => l.trim() === `## ${titre}`);
  if (debut === -1) return [];
  const reste = lignes.slice(debut + 1);
  const fin = reste.findIndex((l) => l.startsWith("## "));
  return (fin === -1 ? reste : reste.slice(0, fin))
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

/** Une ligne compte si elle n'est ni barrée ni bloquée par un feu vert non donné. */
function ouvrable(ligne) {
  if (ligne.startsWith("~~")) return false;
  if (ligne.includes("[feu vert requis]") && !ligne.includes("!ok")) return false;
  return true;
}

export function lireBacklog(texte) {
  return {
    pretACoder: lignesDeSection(texte, "Prêt à coder").some(ouvrable),
    constatSansPlan: lignesDeSection(texte, "À planifier").some(ouvrable),
  };
}

export function choisirRole({ pause = null, pr = null, backlog }) {
  const geles = pause ? (pause.rolesGeles.length > 0 ? pause.rolesGeles : ROLES) : [];
  const libre = (role) => !geles.includes(role);

  if (pr && (pr.rouge || pr.heures > 24) && libre("Gardien")) return "Gardien";
  if (pr && pr.brouillon && libre("Bâtisseur")) return "Bâtisseur";
  // Une seule PR ouverte à la fois : tant qu'elle vit, on n'en ouvre pas d'autre.
  if (!pr && backlog.pretACoder && libre("Bâtisseur")) return "Bâtisseur";
  // L'Architecte n'écrit que des documents : il peut travailler en parallèle d'une PR.
  if (backlog.constatSansPlan && libre("Architecte")) return "Architecte";
  if (libre("Éclaireur")) return "Éclaireur";
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
  const drapeau = process.argv.indexOf("--pr");
  const brut = drapeau === -1 ? "" : (process.argv[drapeau + 1] ?? "");
  const pr = brut && brut !== "null" ? JSON.parse(brut) : null;

  const pause = lirePause(await lireOuNull("boucle/PAUSE.md"));
  const backlog = lireBacklog((await lireOuNull("boucle/BACKLOG.md")) ?? "");

  process.stdout.write(`role=${choisirRole({ pause, pr, backlog })}\n`);
}

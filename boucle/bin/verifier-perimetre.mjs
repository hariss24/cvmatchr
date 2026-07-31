/**
 * Refuse un diff qui sort du périmètre autorisé à la boucle.
 *
 * Appliqué par un script, pas par une consigne de prompt : la boucle décide
 * librement comment atteindre le but, jamais quel but.
 */
export const CHEMINS_INTERDITS = [
  /^\.github\/workflows\//,
  /^boucle\/MISSION\.md$/,
  /^boucle\/roles\//,
  // Ce script est son propre moteur : s'il était modifiable, la boucle pourrait
  // se désarmer, et la version désarmée validerait le diff qui l'a désarmée.
  /^boucle\/bin\//,
  /(^|\/)\.env($|\.)/,
];

export function fichiersInterdits(chemins) {
  return chemins.filter((brut) => {
    const chemin = brut.replace(/\\/g, "/");
    return CHEMINS_INTERDITS.some((motif) => motif.test(chemin));
  });
}

if (process.argv[1]?.endsWith("verifier-perimetre.mjs")) {
  const entree = [];
  for await (const morceau of process.stdin) entree.push(morceau);
  const chemins = entree.join("").split("\n").map((l) => l.trim()).filter(Boolean);
  const fautifs = fichiersInterdits(chemins);

  if (fautifs.length > 0) {
    process.stderr.write(`Périmètre violé — fichiers interdits :\n${fautifs.join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Périmètre respecté (${chemins.length} fichiers).\n`);
}

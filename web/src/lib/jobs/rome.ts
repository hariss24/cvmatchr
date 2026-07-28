/**
 * Accès au référentiel ROME 4.0 embarqué (`data/rome-competences.json`, généré
 * par `scripts/build-rome.mjs`).
 *
 * Le code ROME sert d'abord à ÉCARTER le hors-sujet : sur 60 offres remontées
 * par le mot « webmaster », 20 étaient des postes de conseiller en formation
 * (spec §2.3). D'où la distinction cible / voisin / hors-sujet, qui alimente à
 * la fois le critère « Métier » et le malus.
 *
 * Les compétences, elles, ne transfèrent quasiment pas d'un métier à son voisin
 * (2,4 % de recouvrement, spec §2.4) : elles n'affinent qu'à l'intérieur d'un
 * même code, et ne portent donc jamais le classement à elles seules.
 */

import data from "./data/rome-competences.json";

interface Fiche {
  i: string;                    // intitulé officiel
  c: Record<string, number>;    // code_ogr → 2 (cœur de métier) ou 1
  v: string[];                  // codes ROME voisins (mobilités officielles)
}

const TABLE = data as Record<string, Fiche>;

export interface RomeTargets {
  /** Codes visés par le candidat. */
  cibles: Set<string>;
  /** Métiers voisins officiels des cibles, cibles exclues. */
  voisins: Set<string>;
  /** Compétences attendues, agrégées sur les cibles : code_ogr → poids. */
  attendues: Map<string, number>;
}

/** Prépare une fois par scan les ensembles utilisés par le classement. */
export function buildRomeTargets(romeCodes: string[]): RomeTargets {
  const cibles = new Set(romeCodes.filter(Boolean));
  const voisins = new Set<string>();
  const attendues = new Map<string, number>();

  for (const code of cibles) {
    const fiche = TABLE[code];
    if (!fiche) continue; // code déclaré mais absent du référentiel : toléré
    for (const v of fiche.v) if (!cibles.has(v)) voisins.add(v);
    for (const [ogr, poids] of Object.entries(fiche.c)) {
      attendues.set(ogr, Math.max(attendues.get(ogr) ?? 0, poids));
    }
  }

  return { cibles, voisins, attendues };
}

/** Intitulé officiel d'un code ROME ; le code brut si inconnu. */
export function romeLabel(code: string): string {
  return TABLE[code]?.i || code;
}

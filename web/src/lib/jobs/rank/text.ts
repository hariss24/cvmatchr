/**
 * Analyse textuelle d'une annonce : découpage en zones et notation saturante.
 *
 * C'est le socle du critère le plus lourd (45 points sur 100). Un même métier
 * réel se présente sous des intitulés multiples — webmaster, chargé de contenu
 * web, chargé de communication digitale… — qu'aucune nomenclature ne réconcilie
 * (« contenu web » et « webmarketing » sont introuvables même en ROME 4.0,
 * spec §2.5). La description est la seule source qui les couvre tous.
 *
 * S'applique à TOUTES les sources : c'est ce qui rend une offre Adzuna
 * comparable à une offre France Travail sur la même échelle (spec §3.4).
 */

/** Minuscules + suppression des accents (aligné sur `prefilter.ts`). */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface Zones {
  /** Titre de l'offre, normalisé. Poids 3. */
  titre: string;
  /** Section « profil recherché » si identifiable, normalisée. Poids 2. */
  profil: string;
  /** Tout le reste de la description, normalisé. Poids 1. */
  reste: string;
}

/** Intitulés de section usuels, déjà normalisés. */
const MARQUEURS = [
  "profil recherche",
  "profil souhaite",
  "votre profil",
  "competences requises",
  "vos competences",
  "vous etes",
];

/** Longueur retenue pour la section « profil » à partir de son intitulé. */
const LONGUEUR_PROFIL = 800;

/** Découpe le texte en zones pondérées. Sans section identifiable, `profil` est vide. */
export function splitZones(title: string, jobText: string): Zones {
  const titre = normalize(title);
  const texte = normalize(jobText);

  let debut = -1;
  for (const m of MARQUEURS) {
    const i = texte.indexOf(m);
    if (i !== -1 && (debut === -1 || i < debut)) debut = i;
  }
  if (debut === -1) return { titre, profil: "", reste: texte };

  const fin = debut + LONGUEUR_PROFIL;
  return {
    titre,
    profil: texte.slice(debut, fin),
    reste: texte.slice(0, debut) + texte.slice(fin),
  };
}

const POIDS_TITRE = 3;
const POIDS_PROFIL = 2;
const POIDS_RESTE = 1;

/**
 * Plafond de crédit par mot-clé : au-delà, la répétition n'ajoute plus rien.
 * Calé sur `POIDS_TITRE` : un mot-clé présent dans l'intitulé du poste sature à
 * lui seul, car c'est le signal le plus fort qu'une annonce puisse donner. Un
 * plafond plus haut exigerait titre + rappel dans le corps pour saturer, ce qui
 * rendrait les 45 points quasi inatteignables et viderait le palier S.
 */
const PLAFOND = POIDS_TITRE;

/** Occurrences d'un terme dans un texte (sous-chaîne, sans limite de mot). */
function compte(texte: string, terme: string): number {
  if (!terme) return 0;
  let n = 0;
  let i = texte.indexOf(terme);
  while (i !== -1) {
    n++;
    i = texte.indexOf(terme, i + terme.length);
  }
  return n;
}

/**
 * Note la présence des mots-clés, pondérée par zone et **saturante** : chaque
 * mot-clé rapporte au plus `PLAFOND` de crédit, donc répéter un terme douze fois
 * ne vaut pas douze fois le mentionner deux fois. Le score final est le prorata
 * des crédits sur le nombre de mots-clés.
 *
 * Un mot-clé multi-mots (« communication digitale ») est cherché tel quel puis,
 * à défaut, mot à mot — sans quoi un intitulé légèrement différent le raterait.
 */
export function keywordPoints(
  zones: Zones,
  keywords: string[],
  max: number,
): { points: number; trouves: string[] } {
  const utiles = keywords.map((k) => k.trim()).filter((k) => k.length > 2);
  if (utiles.length === 0) return { points: 0, trouves: [] };

  const trouves: string[] = [];
  let credit = 0;

  for (const kw of utiles) {
    const terme = normalize(kw);
    const termes = compte(zones.titre + " " + zones.profil + " " + zones.reste, terme) > 0
      ? [terme]
      : terme.split(/\s+/).filter((m) => m.length > 2);

    let brut = 0;
    for (const t of termes) {
      brut +=
        POIDS_TITRE * compte(zones.titre, t) +
        POIDS_PROFIL * compte(zones.profil, t) +
        POIDS_RESTE * compte(zones.reste, t);
    }
    // Un mot-clé multi-mots éclaté cumulerait mécaniquement plus : on ramène à
    // la moyenne par mot pour rester comparable à un mot-clé simple.
    if (termes.length > 1) brut = brut / termes.length;

    if (brut > 0) {
      trouves.push(kw);
      credit += Math.min(brut, PLAFOND) / PLAFOND;
    }
  }

  return { points: Math.round((max * credit) / utiles.length), trouves };
}

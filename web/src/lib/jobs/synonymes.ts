/**
 * Élargissement des mots-clés d'une recherche aux intitulés équivalents.
 *
 * ⚠️ Pourquoi ce module existe. La source « Marché caché » est faite des pages
 * carrières de grands groupes, qui publient massivement en anglais **pour des
 * postes en France**. La recherche compare le mot du candidat au titre de
 * l'offre, lettre à lettre : « développeur » ne trouvait pas « Software
 * Engineer », et la moitié du catalogue restait invisible.
 *
 * Mesuré le 06/08/2026 sur les 19 555 offres de l'index, offres pertinentes
 * qu'un candidat francophone ne voyait pas :
 *
 *   responsable RH     30 trouvées, 147 invisibles  (+490 %)
 *   développeur       293 trouvées, 434 invisibles  (+148 %)
 *   commercial        561 trouvées, 553 invisibles  (+99 %)
 *   chef de projet    387 trouvées, 285 invisibles  (+74 %)
 *   ingénieur       1 770 trouvées, 1 261 invisibles (+71 %)
 *
 * Les groupes ci-dessous sont bâtis sur les intitulés RÉELS de l'index — les
 * soixante-dix mots les plus fréquents ont été relevés avant d'écrire la table,
 * plutôt que devinés.
 */

/** Minuscule sans accent, ponctuation réduite à des espaces. */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Familles d'intitulés équivalents. Chaque terme d'un groupe ramène les autres.
 *
 * ⚠️ Les termes ambigus sont écrits en EXPRESSION, jamais en mot isolé.
 * « chef » en particulier : il désigne un responsable en français et un
 * cuisinier en anglais. « chef de projet » ↔ « project manager » est sûr ;
 * « chef » ↔ « manager » ferait remonter des postes de cuisine à qui cherche un
 * poste d'encadrement, et l'inverse.
 */
const GROUPES: readonly (readonly string[])[] = [
  // Ingénierie et technique
  ["ingenieur", "engineer", "engineering"],
  ["developpeur", "developer", "software engineer", "fullstack", "full stack", "backend", "frontend"],
  ["architecte", "architect"],
  ["technicien", "technician"],
  ["analyste", "analyst"],
  ["donnees", "data"],
  ["testeur", "qa engineer", "test engineer"],
  ["administrateur systeme", "system administrator", "sysadmin", "sre"],
  ["securite informatique", "cybersecurity", "security engineer"],

  // Encadrement et gestion
  ["chef de projet", "project manager", "program manager"],
  ["chef de produit", "product manager", "product owner"],
  ["responsable", "manager", "head of"],
  ["directeur", "director", "head of"],
  ["directrice", "director", "head of"],

  // Commerce
  ["commercial", "sales", "account executive", "business developer", "business development"],
  ["vendeur", "sales associate", "sales assistant", "retail"],
  ["vendeuse", "sales associate", "sales assistant", "retail"],
  ["conseiller clientele", "customer advisor", "customer success", "account manager"],
  ["acheteur", "buyer", "procurement", "purchasing"],
  ["marketing", "marketing", "growth"],

  // Fonctions support
  ["ressources humaines", "human resources", "hr business partner", "people partner", "talent acquisition"],
  ["recruteur", "recruiter", "talent acquisition"],
  ["comptable", "accountant", "accounting"],
  ["controleur de gestion", "financial controller", "fp a"],
  ["juriste", "legal counsel", "lawyer"],
  ["assistant de direction", "executive assistant", "office manager"],
  ["formateur", "trainer", "training"],
  ["acheteur informatique", "it buyer"],

  // Production, logistique, terrain
  ["logistique", "logistics", "supply chain"],
  ["magasinier", "warehouse operator", "warehouse"],
  ["conducteur", "driver", "operator"],
  ["qualite", "quality"],
  ["maintenance", "maintenance"],
  ["production", "production", "manufacturing"],
  ["securite", "safety", "hse"],

  // Santé et service
  ["infirmier", "nurse"],
  ["infirmiere", "nurse"],
  ["aide soignant", "care assistant", "nursing assistant"],
  ["cuisinier", "cook", "chef de partie"],
  ["serveur", "waiter", "server"],

  // Contrats et niveaux
  ["stage", "internship", "intern"],
  ["alternance", "apprenticeship", "apprentice", "work study"],
  ["debutant", "junior", "entry level", "graduate"],
];

/**
 * Ajoute aux mots-clés du candidat les intitulés équivalents.
 *
 * Un mot-clé déclenche un groupe quand il contient l'un de ses termes
 * (« responsable RH » déclenche « responsable ») ou quand il en est une
 * abréviation reconnaissable (« ingé » ne déclenche rien, « ingenieur » oui).
 *
 * Les mots-clés d'origine sont toujours conservés, en tête et sans doublon :
 * un élargissement ne doit jamais faire perdre un résultat que la recherche
 * littérale aurait trouvé.
 */
export function elargirMotsCles(keywords: string[]): string[] {
  const sortie: string[] = [];
  const vus = new Set<string>();

  const ajouter = (mot: string) => {
    const k = normaliser(mot);
    if (!k || vus.has(k)) return;
    vus.add(k);
    sortie.push(mot);
  };

  for (const mot of keywords) ajouter(mot);

  for (const mot of keywords) {
    const k = normaliser(mot);
    if (!k) continue;
    for (const groupe of GROUPES) {
      // ⚠️ Un seul sens : le mot-clé du candidat doit CONTENIR le terme.
      // L'inclusion réciproque paraissait plus généreuse et ne l'était pas :
      // « chef » déclenchait « chef de projet », donc « project manager », et
      // un cuisinier recevait des postes d'encadrement. Un mot-clé d'une ou
      // deux lettres déclenchait par ailleurs presque tous les groupes.
      const touche = groupe.some((terme) => k.includes(terme));
      if (!touche) continue;
      for (const terme of groupe) ajouter(terme);
    }
  }
  return sortie;
}

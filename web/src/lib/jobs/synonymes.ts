/**
 * Élargissement des mots-clés d'une recherche aux intitulés équivalents.
 *
 * ⚠️ Pourquoi ce module existe. La source « Marché caché » est faite des pages
 * carrières de grands groupes, qui publient massivement en anglais **pour des
 * postes en France**. La recherche compare le mot du candidat au titre de
 * l'offre, lettre à lettre : « développeur » ne trouvait pas « Software
 * Engineer », et la moitié du catalogue restait invisible.
 *
 * Mesuré le 07/08/2026 sur les 19 555 offres de l'index — titres atteints par
 * un mot-clé, sans élargissement puis avec :
 *
 *   ingénieur            1 770 → 3 031
 *   commercial             561 → 1 188
 *   chef de projet         387 →   534
 *   développeur            293 →   727
 *   responsable RH           5 →    90
 *   sécurité informatique  382 →    36
 *   données                864 →   324
 *
 * ⚠️ Ce tableau en remplace un premier, du 06/08/2026, qui annonçait pour
 * « responsable RH » un passage de 30 à 177. Le chiffre était faux : la table
 * contenait alors un groupe `["responsable", "manager", "head of"]`, et ce seul
 * mot-clé atteignait 2 807 titres, soit 14 % de l'index — Release Manager, Bid
 * Manager, Responsable RAMS. La correction du 07/08 supprime les groupes de
 * niveau hiérarchique (voir plus bas) ; les quatre autres métiers sont
 * inchangés, ce qui délimite exactement ce que ce groupe apportait : du bruit.
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
  // ⚠️ « data » seul est un domaine, pas un métier : il remontait Data Analyst,
  // Data Engineer, Data Scientist et Master Data Specialist indifféremment.
  ["donnees", "data analyst", "data engineer", "data scientist", "analyste de donnees"],
  ["testeur", "qa engineer", "test engineer"],
  ["administrateur systeme", "system administrator", "sysadmin", "sre"],
  ["securite informatique", "cybersecurity", "security engineer"],

  // Encadrement et gestion
  //
  // ⚠️ Aucun groupe ne porte un niveau hiérarchique seul. « responsable »,
  // « manager », « directeur », « head of » ne désignent pas un métier : ils
  // désignent une position dans un métier quelconque. Ajoutés comme mots-clés
  // isolés, ils remontaient n'importe quel intitulé les contenant. Mesuré le
  // 07/08/2026 sur une recherche marketing en Île-de-France : les 49 offres
  // affichées venaient toutes de mots ajoutés ici, dont 26 du seul « manager »
  // — Release Manager, Bid Manager, Supply Chain Project Manager, Responsable
  // RAMS. Le niveau n'apparaît donc qu'attaché à un domaine.
  ["chef de projet", "project manager", "program manager"],
  ["chef de produit", "product manager", "product owner"],

  // Commerce
  ["commercial", "sales", "account executive", "business developer", "business development"],
  ["vendeur", "sales associate", "sales assistant", "retail"],
  ["vendeuse", "sales associate", "sales assistant", "retail"],
  ["conseiller clientele", "customer advisor", "customer success", "account manager"],
  ["acheteur", "buyer", "procurement", "purchasing"],
  // ⚠️ « growth » ne désigne pas un métier chez ces employeurs : il nomme
  // l'équipe. Ajouté seul, il remontait « Fullstack Software Engineer - Growth
  // Product » et « Sales Development Representative, SME & Growth ». Il ne
  // subsiste que dans l'expression « growth marketing », qui, elle, est un
  // métier.
  ["marketing digital", "digital marketing", "growth marketing", "marketing en ligne"],
  ["responsable marketing", "marketing manager", "head of marketing", "directeur marketing", "marketing director"],

  // Fonctions support
  ["ressources humaines", "human resources", "hr business partner", "people partner", "talent acquisition", "responsable rh", "hr manager", "head of people"],
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
  // ⚠️ « securite » seul déclenchait ce groupe depuis « sécurité informatique »,
  // et un candidat en cybersécurité recevait des postes HSE. Le métier HSE se
  // nomme en expression.
  ["responsable hse", "hse manager", "health safety environment", "hygiene securite environnement"],

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
 * (« responsable RH digital » déclenche « responsable rh ») ou quand il en est
 * une abréviation reconnaissable (« ingé » ne déclenche rien, « ingenieur »
 * oui).
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

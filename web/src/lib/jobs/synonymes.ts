/**
 * Élargissement des mots-clés d'une recherche aux critères équivalents.
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
 * ⚠️ Refonte du 18/08/2026 (mots-clés conjonctifs) : un mot-clé composé est
 * désormais une conjonction. « chef de projet marketing » ne devient jamais
 * « chef de projet » seul (qui atteignait 380 titres non pertinents), mais
 * « project manager » + « marketing ».
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

const MOTS_VIDES = new Set([
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "l",
  "d",
  "en",
  "et",
  "a",
  "au",
  "aux",
  "pour",
  "sur",
]);

/**
 * Mots qui désignent une POSITION, jamais un métier — écartés du reste d'un
 * mot-clé au même titre que les mots vides.
 *
 * ⚠️ Sans cette liste, l'exigence conjointe se retournait contre le candidat.
 * « Chargé marketing digital » déclenche le groupe « marketing digital », et le
 * reste valait alors « chargé » : la recherche exigeait un titre contenant à la
 * fois « digital marketing » ET « chargé ». Aucun titre anglais ne contient
 * « chargé » — et 4 581 des 19 555 offres de l'index sont intitulées en anglais
 * pour des postes en France (Doctolib, Deliveroo, Deloitte, tous à Paris).
 * Mesuré le 18/08/2026 sur la recherche réelle du candidat : 9 offres
 * pertinentes tombaient à 1.
 *
 * C'est le pendant exact de la règle déjà écrite plus haut pour les GROUPES :
 * un niveau hiérarchique ne désigne pas un métier, il désigne une place dans un
 * métier quelconque. Il ne peut donc ni ramener des offres à lui seul, ni en
 * exclure en étant exigé.
 *
 * N'y mettre que des positions incontestables : « gestionnaire » ou
 * « technicien » nomment de vrais métiers et n'ont rien à faire ici.
 */
const MOTS_FONCTION = new Set([
  "charge",
  "chargee",
  "responsable",
  "assistant",
  "assistante",
  "consultant",
  "consultante",
  "chef",
  "cheffe",
  "directeur",
  "directrice",
  "manager",
  "adjoint",
  "adjointe",
  "coordinateur",
  "coordinatrice",
  "lead",
  "head",
  "senior",
  "junior",
  "expert",
  "experte",
]);

/**
 * Un critère de recherche : TOUS les termes doivent apparaître dans le texte
 * examiné. C'est ce qui distingue « chef de projet marketing » traduit en
 * « project manager » + « marketing » — qui trouve « Marketing Project
 * Manager » — de « chef de projet » seul, qui trouve tous les chefs de projet.
 */
export interface Critere {
  /** Termes exigés ensemble, déjà normalisés (minuscule, sans accent). */
  termes: string[];
  /** Vrai si ce critère est le mot-clé du candidat, tel qu'il l'a tapé. */
  litteral: boolean;
  /** Le mot-clé d'origine, pour l'affichage et le diagnostic. */
  origine: string;
}

/**
 * Vérifie si un texte satisfait un critère (tous les termes requis sont présents).
 */
export function satisfait(texte: string, critere: Critere): boolean {
  const norm = normaliser(texte);
  if (!norm) return false;
  return critere.termes.every((terme) => norm.includes(terme));
}

/**
 * Rend le critère littéral satisfait s'il en existe un, sinon le premier
 * critère élargi satisfait, sinon null.
 */
export function meilleurCritere(texte: string, criteres: Critere[]): Critere | null {
  for (const c of criteres) {
    if (c.litteral && satisfait(texte, c)) return c;
  }
  for (const c of criteres) {
    if (!c.litteral && satisfait(texte, c)) return c;
  }
  return null;
}

/**
 * Construit la liste des critères conjonctifs à partir des mots-clés du candidat.
 */
export function construireCriteres(keywords: string[]): Critere[] {
  const sortie: Critere[] = [];
  const vus = new Set<string>();

  const ajouter = (critere: Critere) => {
    const sig = critere.termes.slice().sort().join("|");
    if (!sig || vus.has(sig)) return;
    vus.add(sig);
    sortie.push(critere);
  };

  // 1. Toujours produire le critère littéral pour chaque mot-clé
  for (const mot of keywords) {
    const K = normaliser(mot);
    if (!K) continue;
    ajouter({
      termes: [K],
      litteral: true,
      origine: mot,
    });
  }

  // 2. Élargissement aux équivalents en préservant la conjonction
  for (const mot of keywords) {
    const K = normaliser(mot);
    if (!K) continue;

    for (const groupe of GROUPES) {
      for (const terme of groupe) {
        if (!K.includes(terme)) continue;

        const motsK = K.split(/\s+/).filter(Boolean);
        const motsT = new Set(terme.split(/\s+/).filter(Boolean));
        const reste = motsK.filter(
          (w) => !motsT.has(w) && !MOTS_VIDES.has(w) && !MOTS_FONCTION.has(w),
        );

        if (reste.length === 0) {
          // Terme générique tapé directement (ex: "chef de projet")
          for (const s of groupe) {
            if (s === terme) continue;
            ajouter({
              termes: [s],
              litteral: false,
              origine: mot,
            });
          }
        } else {
          // Mot-clé composé plus précis (ex: "chef de projet marketing")
          for (const s of groupe) {
            if (s === terme) continue;
            ajouter({
              termes: [s, ...reste],
              litteral: false,
              origine: mot,
            });
          }
        }
      }
    }
  }

  return sortie;
}


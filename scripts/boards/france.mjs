// « Cette offre est-elle en France ? »
//
// Les quatre ATS écrivent le lieu de quatre façons incompatibles. Formats
// relevés sur de vraies réponses le 04/08/2026 :
//   Greenhouse       "Berlin, Berlin, Germany"  "Frankfurt"  "Paris"
//   Ashby            "Paris, France"            "Anywhere in France"
//   Lever            "Paris Area, France"       "Toulouse, Occitanie"
//   SmartRecruiters  champ structuré { city, country }
//   Lever            champ structuré `country` (ISO), présent mais pas toujours
//
// ⚠️ La règle 3 (ville/région) n'est PAS un confort. Mesuré le 04/08/2026 :
// On Running a 8 offres françaises écrites « Paris », zéro marqueur de pays —
// sans la règle 3 ce board sort entièrement de l'index. Loft Orbital a 13 offres
// « Toulouse, Occitanie » contre 1 seule avec marqueur.

/** Décomposition NFD puis suppression des diacritiques combinants. */
function sansAccent(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Marqueur de pays explicite. « Île-de-France » et « Hauts-de-France » passent ici. */
const MARQUEUR_FR = /(\bfrance\b|,\s*fr\s*$|\(\s*fr\s*\))/i;

/**
 * Pays étrangers qui invalident une correspondance de ville ou de région.
 * « grande-bretagne » et « great britain » sont là pour une raison précise :
 * sans eux, « Bretagne » les capture.
 */
const PAYS_ETRANGERS = [
  "germany", "deutschland", "spain", "espana", "italy", "italia", "portugal",
  "belgium", "belgique", "netherlands", "nederland", "switzerland", "suisse",
  "luxembourg", "austria", "poland", "polska", "romania", "hungary", "czechia",
  "brazil", "brasil", "canada", "mexico", "argentina", "chile", "colombia",
  "india", "japan", "china", "singapore", "korea", "vietnam", "thailand",
  "australia", "new zealand", "usa", "u.s.", "united states", "uk",
  "united kingdom", "grande-bretagne", "great britain", "england", "scotland",
  "ireland", "sweden", "norway", "denmark", "finland", "iceland", "greece",
  "turkey", "israel", "egypt", "morocco", "maroc", "tunisia", "tunisie",
  "algeria", "algerie", "senegal", "south africa", "nigeria", "kenya",
  "uae", "dubai", "saudi", "qatar", "russia", "ukraine", "bulgaria", "serbia",
];

/** Noms d'états américains qui piègent une ville homonyme (« Paris, Texas »). */
const ETATS_US = [
  "texas", "illinois", "kentucky", "tennessee", "arkansas", "missouri", "maine",
  "idaho", "ohio", "indiana", "iowa", "michigan", "virginia", "california",
  "florida", "georgia", "colorado", "arizona", "nevada", "oregon", "washington",
  "massachusetts", "pennsylvania", "carolina", "alabama", "oklahoma", "kansas",
  "nebraska", "minnesota", "wisconsin", "louisiana", "mississippi", "utah",
];

const RE_ETRANGER = new RegExp(`\\b(${[...PAYS_ETRANGERS, ...ETATS_US].join("|")})\\b`, "i");

/**
 * Code à deux lettres en fin de chaîne : « Paris, TX ».
 * On exige la fin de chaîne — sinon « Paris, La Défense » serait pris pour
 * la Louisiane.
 */
const RE_CODE_FINAL = /,\s*([a-z]{2})\s*$/i;

/** Les treize régions métropolitaines, sans accent, plus le sigle PACA. */
const REGIONS = [
  "auvergne-rhone-alpes", "bourgogne-franche-comte", "bretagne",
  "centre-val de loire", "corse", "grand est", "hauts-de-france",
  "ile-de-france", "normandie", "nouvelle-aquitaine", "occitanie",
  "pays de la loire", "provence-alpes-cote d'azur", "paca",
];

/**
 * Villes françaises usuelles et pôles d'emploi tech, sans accent.
 * Certaines sont ambiguës hors contexte — « nice », « tours », « nancy »,
 * « brest » — mais la règle 3 ne s'applique qu'à des champs de localisation
 * courts, déjà filtrés par RE_ETRANGER et RE_CODE_FINAL.
 */
const VILLES = [
  "paris", "lyon", "marseille", "toulouse", "lille", "bordeaux", "nantes",
  "nice", "strasbourg", "montpellier", "rennes", "grenoble", "rouen", "toulon",
  "saint-etienne", "dijon", "angers", "villeurbanne", "le mans", "reims",
  "aix-en-provence", "clermont-ferrand", "brest", "limoges", "tours", "amiens",
  "perpignan", "metz", "besancon", "orleans", "mulhouse", "caen", "nancy",
  "argenteuil", "roubaix", "tourcoing", "nanterre", "avignon", "poitiers",
  "versailles", "courbevoie", "creteil", "pau", "la rochelle", "cannes",
  "antibes", "sophia antipolis", "sophia-antipolis", "valbonne", "saclay",
  "massy", "orsay", "issy-les-moulineaux", "levallois-perret",
  "boulogne-billancourt", "neuilly-sur-seine", "rungis", "saint-denis",
  "montreuil", "vincennes", "puteaux", "la defense", "cergy", "evry",
  "marne-la-vallee", "labege", "blagnac", "merignac", "cesson-sevigne",
  "villeneuve-d-ascq", "villeneuve d'ascq", "lens", "annecy", "chambery",
  "la roche-sur-yon", "niort", "angouleme", "bayonne", "biarritz", "arras",
];

const RE_REGIONS = new RegExp(`\\b(${REGIONS.join("|")})\\b`, "i");
const RE_VILLES = new RegExp(`\\b(${VILLES.join("|")})\\b`, "i");

/**
 * `paysIso` est le code pays du champ structuré quand l'ATS en expose un
 * (SmartRecruiters toujours, Lever souvent). Quand il est présent il fait foi,
 * y compris pour dire non.
 */
export function estFrancais(lieu, paysIso) {
  const iso = String(paysIso ?? "").trim();
  if (iso) return iso.toUpperCase() === "FR";

  const brut = String(lieu ?? "").trim();
  if (!brut) return false;

  if (MARQUEUR_FR.test(brut)) return true;

  const texte = sansAccent(brut);
  if (RE_ETRANGER.test(texte)) return false;

  const code = RE_CODE_FINAL.exec(brut);
  if (code && code[1].toUpperCase() !== "FR") return false;

  return RE_REGIONS.test(texte) || RE_VILLES.test(texte);
}

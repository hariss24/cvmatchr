/**
 * Analyse ATS **statistique côté client** (sans IA) : compare les mots-clés de l'offre
 * au contenu du CV. Port **fidèle** de `_extractKeywords` / `_detectSections` / `_renderAts`
 * (static/js/app.js, l.2615-2800) — mêmes stop-words, mêmes composés, même calcul de score.
 *
 * Pur (aucun DOM, aucun état global) : la mise en forme du panneau est laissée au composant.
 */

const STOP_WORDS = new Set<string>([
  // Articles et pronoms
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "au", "aux",
  "en", "dans", "sur", "pour", "par", "avec", "sans", "que", "qui", "quoi", "dont",
  "il", "elle", "ils", "elles", "je", "tu", "nous", "vous", "on", "ce", "se", "sa",
  "son", "ses", "mon", "ton", "notre", "nos", "votre", "vos", "leur", "leurs", "mes", "tes", "ces",
  "celui", "celle", "ceux", "celles", "moi", "toi", "soi", "eux", "lui",
  "quel", "quelle", "quels", "quelles", "quelque", "quelques", "plusieurs", "aucun", "aucune",

  // Verbes communs (être, avoir, faire, etc.)
  "est", "sont", "etre", "avoir", "faire", "fait", "faits", "faite", "faites", "fais", "faisons", "font",
  "pouvoir", "peut", "peuvent", "vouloir", "veut", "veulent", "devoir", "doit", "doivent",
  "aller", "va", "vont", "vas", "venir", "vient", "viennent", "dire", "dit", "disent",

  // Adverbes et prépositions
  "plus", "tres", "bien", "tout", "tous", "toute", "toutes", "aussi", "meme", "memes",
  "mais", "donc", "car", "cela", "ceci", "cette", "cet", "comme", "afin", "ainsi",
  "lors", "entre", "autre", "autres", "selon", "notamment", "quand", "alors",
  "ici", "voici", "voila", "bref", "depuis", "vers", "chez", "sous", "sauf", "parmi",
  "avant", "apres", "pendant", "comment", "combien", "pourquoi", "ailleurs", "partout",
  "jamais", "toujours", "souvent", "parfois", "rarement", "bientot", "deja", "enfin",
  "ensuite", "puis", "parce", "puisque", "lorsque", "quoique", "mal", "mieux", "pire",
  "vite", "lentement", "trop", "peu", "beaucoup", "assez", "moins", "autant", "seulement",
  "presque", "surtout", "environ", "pres", "loin", "rien", "personne", "chacun", "chacune",
  "tel", "telle", "tels", "telles", "certain", "certains", "certaine", "certaines",
  "divers", "diverses", "differents", "differentes", "quelconque", "chaque", "maint", "maints",

  // Mots courants / Vocabulaire entreprise non spécifique
  "poste", "profil", "candidat", "candidate", "equipe", "rejoindre", "mission", "missions", "contrat",
  "recherche", "entreprise", "societe", "contexte", "offre", "emploi",
  "travail", "collaborateur", "collaborateurs", "collaboratrice", "collaboratrices",
  "ambiance", "bienveillance", "dynamique", "croissance", "locaux", "babyfoot", "avantage", "avantages", "mutuelle",
  "remuneration", "salaire", "teletravail", "sein", "assurer", "suivre", "suit",
  "gerer", "piloter", "participer", "contribuer", "accompagner", "definir",
  "animer", "mettre", "garantir", "optimiser", "permettre", "favoriser",
  "proposer", "construire", "travailler", "niveau", "type", "domaine",
  "secteur", "annee", "annees", "mois", "jour", "jours", "service", "besoin", "client", "produit",
  "solution", "projet", "fort", "forte", "ideal", "atout", "sens", "envie",
  "capacite", "aisance", "aptitude", "qualite", "valeur", "recrutement",
  "cadre", "structure", "challenge", "defis", "hybride", "bureau",
  "bonne", "bon", "bonnes", "bons", "mot", "mots", "titre", "titres", "sujet", "sujets",
  "oeuvre", "œuvres", "œuvre", "uvre", "uvres", "concoit", "concevoir", "anime", "diffuse", "diffuser",
  "contribue", "garant", "garante", "garant.e", "garants", "garantes",
  "engageant", "engageants", "engageante", "engageantes", "confie", "confies", "confiee", "confiees",

  // Verbes conjugués fréquents dans les offres
  "cherchons", "recherchons", "attendons", "souhaitons", "proposons",
  "rejoindrez", "rejoindront", "rejoindra", "rejoindrons",
  "travaillerez", "travaillerons", "travaillez", "travaillerait",

  // Adjectifs fréquents
  "passionne", "passionnee", "passionnes", "passionnees", "requis", "requise",
  "bienveillant", "bienveillante", "bienveillants", "bienveillantes",
  "dynamiques", "motivees", "motivee", "motive", "motives", "nouveau", "nouvelle",
  "nouveaux", "nouvelles", "vrai", "vraie", "vrais", "vraies", "faux", "fausse",

  // English stop words
  "the", "of", "and", "or", "to", "a", "an", "in", "on", "for", "with", "be", "is",
  "are", "was", "were", "will", "have", "has", "do", "does", "that", "this", "it",
  "you", "we", "they", "he", "she", "not", "but", "if", "as", "at", "from", "by",
  "your", "our", "their", "its", "which", "when", "who", "how", "what", "where",
  "team", "company", "work", "role", "join", "position", "experience", "strong",
  "knowledge", "ability", "excellent", "good", "great", "working", "looking",
  "must", "should", "can", "including", "such", "based", "environment",
  "opportunity", "culture", "office", "hybrid", "remote", "candidate",
  "profile", "contract", "enterprise", "ideally", "salary", "benefits",
  "level", "years", "months", "help", "build", "make", "grow", "ensure",
  "manage", "lead", "support", "provide", "deliver", "create", "drive", "take",
]);

const COMPOUNDS: [string, string][] = [
  ["intelligence artificielle", "ia"],
  ["natural language processing", "nlp"],
  ["machine learning", "machine-learning"],
  ["deep learning", "deep-learning"],
  ["gestion de projet", "gestion-projet"],
  ["base de donnees", "base-donnees"],
  ["react native", "react-native"],
  ["spring boot", "spring-boot"],
  ["power bi", "powerbi"],
  ["rest api", "rest-api"],
  ["react js", "react"],
  ["node js", "nodejs"],
  ["vue js", "vuejs"],
  ["next js", "nextjs"],
  ["ci/cd", "cicd"],
  ["ci cd", "cicd"],
  ["node.js", "nodejs"],
];

/** Retire les accents (NFD + suppression des diacritiques combinants). */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Extrait les mots-clés signifiants d'un texte. Port de `_extractKeywords`. */
export function extractKeywords(text: string): string[] {
  let clean = stripAccents(
    text
      .replace(/<[^>]+>/g, " ")
      .toLowerCase(),
  )
    .replace(/[^\w\s+#./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [phrase, replacement] of COMPOUNDS) {
    clean = clean.split(phrase).join(replacement);
  }
  clean = clean.replace(/(\w)\/(\w)/g, "$1 $2");

  return [
    ...new Set(
      clean
        .split(/\s+/)
        .map((w) => w.replace(/^[-/.]+|[-/.]+$/g, ""))
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
    ),
  ];
}

/** Détecte la présence des grandes sections d'un CV par leurs titres. Port de `_detectSections`. */
export function detectSections(html: string): Record<string, boolean> {
  const heading = (terms: string) =>
    new RegExp(`<h[1-6][^>]*>[^<]*(${terms})[^<]*</h[1-6]>`, "i");
  return {
    "Résumé / Accroche": heading("r[eé]sum[eé]|accroche|profil|summary|about").test(html),
    "Expériences": heading("exp[eé]rience|emploi|poste|travail|parcours").test(html),
    "Compétences": heading("comp[eé]tence|skill|technolog|technique|savoir").test(html),
    "Langues": heading("langue|language|anglais|fran[cç]ais|english").test(html),
    "Formation": heading("formation|dipl[oô]me|[ée]cole|universit[ée]|education|degree|cursus").test(html),
    "Centres d'intérêt": heading("int[ée]r[êe]t|loisir|hobby|passion|activit[ée]").test(html),
  };
}

export type AtsAnalysis = {
  score: number;
  matched: string[];
  missing: string[];
  /** Mots-clés absents prêts pour le booster invisible (tirets → espaces). */
  boostKeywords: string[];
  sections: Record<string, boolean>;
};

/**
 * Analyse statistique d'adéquation CV/offre. Port de `_renderAts` (calcul uniquement).
 * `matched`/`missing` sont plafonnés à 20 éléments (comme l'original).
 */
export function analyzeAts(cvHtml: string, jobDesc: string): AtsAnalysis {
  const jobKw = extractKeywords(jobDesc);
  // Mêmes composés que côté offre : « Power BI » dans le CV doit matcher le mot-clé « powerbi ».
  let cvNorm = stripAccents(cvHtml.replace(/<[^>]+>/g, " ").toLowerCase());
  for (const [phrase, replacement] of COMPOUNDS) {
    cvNorm = cvNorm.split(phrase).join(replacement);
  }

  const isMatched = (kw: string): boolean => {
    if (cvNorm.includes(kw)) return true;
    if ((kw.endsWith("s") || kw.endsWith("x")) && kw.length > 4) {
      return cvNorm.includes(kw.slice(0, -1));
    }
    return false;
  };

  const matched = jobKw.filter(isMatched);
  const missing = jobKw.filter((kw) => !isMatched(kw)).slice(0, 20);
  const score = jobKw.length ? Math.round((matched.length / jobKw.length) * 100) : 0;

  return {
    score,
    matched: matched.slice(0, 20),
    missing,
    boostKeywords: missing.map((k) => k.replace(/-/g, " ")),
    sections: detectSections(cvHtml),
  };
}

/**
 * Injecte les mots-clés absents en texte **invisible** (1px, blanc) juste avant `</body>`
 * (sinon en fin de document). Port **fidèle** de l'injection `mergedHtml` (app.js l.606-614).
 * Sans mots-clés, renvoie le HTML inchangé.
 */
export function applyAtsBoost(html: string, keywords: string[]): string {
  if (!keywords.length) return html;
  const boostText = keywords
    .join(" ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const boostSpan = `<span style="font-size:1px;color:#ffffff;line-height:0;">${boostText}</span>`;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, boostSpan + "</body>")
    : html + boostSpan;
}

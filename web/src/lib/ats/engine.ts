/**
 * Moteur ATS — score d'adéquation CV / offre, sans IA.
 *
 * Remplace `score.ts`, qui souffrait de deux défauts de conception :
 *  1. il lisait `docStore.html`, vide depuis la migration React PDF → score toujours 0 ;
 *  2. il comptait CHAQUE mot non-vide de l'offre au même poids, si bien que « néanmoins »
 *     ou « université » pesaient autant que « SEO ». Un CV parfaitement adapté plafonnait
 *     à ~22/100, noyé sous le baratin RH du dénominateur.
 *
 * Ici, un terme de l'offre n'est retenu comme EXIGENCE que si l'offre y insiste
 * (répétition), si c'est un savoir-faire identifiable (acronyme isolé, outil connu,
 * composé technique), ou s'il figure dans l'intitulé du poste. Le score global agrège
 * ensuite 4 axes pondérés, comme le font les analyseurs ATS du marché.
 */

import type { Resume } from "@/lib/resume/schema";
import { resumeToZones, detectResumeSections } from "./resumeText";

const STOP_WORDS = new Set<string>([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "au", "aux",
  "en", "dans", "sur", "pour", "par", "avec", "sans", "que", "qui", "quoi", "dont",
  "il", "elle", "ils", "elles", "je", "tu", "nous", "vous", "on", "ce", "se", "sa",
  "son", "ses", "mon", "ton", "notre", "nos", "votre", "vos", "leur", "leurs", "mes", "tes", "ces",
  "celui", "celle", "ceux", "celles", "moi", "toi", "soi", "eux", "lui",
  "quel", "quelle", "quels", "quelles", "quelque", "quelques", "plusieurs", "aucun", "aucune",
  "est", "sont", "etre", "avoir", "faire", "fait", "faits", "faite", "faites", "fais", "font",
  "pouvoir", "peut", "peuvent", "vouloir", "veut", "veulent", "devoir", "doit", "doivent",
  "aller", "vont", "venir", "vient", "viennent", "dire", "dit", "disent",
  "plus", "tres", "bien", "tout", "tous", "toute", "toutes", "aussi", "meme", "memes",
  "mais", "donc", "car", "cela", "ceci", "cette", "cet", "comme", "afin", "ainsi",
  "lors", "entre", "autre", "autres", "selon", "notamment", "quand", "alors",
  "ici", "voici", "voila", "depuis", "vers", "chez", "sous", "sauf", "parmi",
  "avant", "apres", "pendant", "comment", "combien", "pourquoi", "ailleurs", "partout",
  "jamais", "toujours", "souvent", "parfois", "rarement", "deja", "enfin",
  "ensuite", "puis", "parce", "puisque", "lorsque", "quoique", "mieux",
  "trop", "peu", "beaucoup", "assez", "moins", "autant", "seulement",
  "presque", "surtout", "environ", "pres", "loin", "rien", "personne", "chacun", "chacune",
  "tel", "telle", "tels", "telles", "certain", "certains", "certaine", "certaines",
  "divers", "diverses", "differents", "differentes", "chaque",
  "poste", "profil", "profils", "candidat", "candidate", "equipe", "rejoindre", "mission",
  "missions", "contrat", "recherche", "entreprise", "societe", "contexte", "offre", "emploi",
  "travail", "collaborateur", "collaborateurs", "collaboratrice", "collaboratrices",
  "ambiance", "bienveillance", "croissance", "locaux", "avantage", "avantages", "mutuelle",
  "remuneration", "salaire", "teletravail", "sein", "assurer", "suivre", "suit",
  "niveau", "type", "domaine", "secteur", "annee", "annees", "mois", "jour", "jours",
  "besoin", "fort", "forte", "ideal", "atout", "sens", "envie",
  "capacite", "aisance", "aptitude", "qualite", "valeur", "recrutement",
  "cadre", "structure", "challenge", "defis", "bureau",
  "bonne", "bon", "bonnes", "bons", "mot", "mots", "titre", "titres", "sujet", "sujets",
  "oeuvre", "uvre", "coeur",
  "cherchons", "recherchons", "attendons", "souhaitons", "proposons",
  "rejoindrez", "rejoindront", "rejoindra", "travaillerez", "travaillez",
  "passionne", "passionnee", "passionnes", "passionnees", "requis", "requise", "requises",
  "bienveillant", "bienveillante", "motive", "motivee", "nouveau", "nouvelle",
  "the", "of", "and", "or", "to", "a", "an", "in", "on", "for", "with", "be", "is",
  "are", "was", "were", "will", "have", "has", "do", "does", "that", "this", "it",
  "you", "we", "they", "he", "she", "not", "but", "if", "as", "at", "from", "by",
  "your", "our", "their", "its", "which", "when", "who", "how", "what", "where",
  "team", "company", "work", "role", "join", "position", "experience", "strong",
  "knowledge", "ability", "excellent", "good", "great", "working", "looking",
  "must", "should", "can", "including", "such", "based", "environment",
  "opportunity", "culture", "office", "candidate", "profile", "contract",
  "level", "years", "months", "help", "build", "make", "grow", "ensure",
]);

/** Expressions à souder AVANT le découpage en mots (sinon « Power BI » se perd en « power » + « bi »). */
const COMPOUNDS: [string, string][] = [
  ["intelligence artificielle", "ia"],
  ["natural language processing", "nlp"],
  ["machine learning", "machine-learning"],
  ["deep learning", "deep-learning"],
  ["gestion de projet", "gestion-projet"],
  ["base de donnees", "base-donnees"],
  ["google analytics", "google-analytics"],
  ["google ads", "google-ads"],
  ["meta ads", "meta-ads"],
  ["email marketing", "email-marketing"],
  ["react native", "react-native"],
  ["spring boot", "spring-boot"],
  ["power bi", "powerbi"],
  ["rest api", "rest-api"],
  ["react js", "react"],
  ["node js", "nodejs"],
  ["node.js", "nodejs"],
  ["vue js", "vuejs"],
  ["next js", "nextjs"],
  ["ci/cd", "cicd"],
  ["ci cd", "cicd"],
];

/**
 * Savoir-faire reconnaissables même mentionnés une seule fois dans l'offre.
 * Volontairement court : la règle de répétition et la détection d'acronymes couvrent le reste.
 */
const SKILL_LEXICON = new Set<string>([
  "python", "java", "javascript", "typescript", "php", "ruby", "swift", "kotlin", "scala",
  "react", "angular", "vuejs", "nextjs", "nodejs", "django", "flask", "symfony", "laravel",
  "spring-boot", "docker", "kubernetes", "terraform", "ansible", "linux", "git", "cicd",
  "aws", "azure", "gcp", "jenkins", "kafka", "spark", "hadoop", "airflow",
  "sql", "nosql", "mysql", "postgresql", "mongodb", "redis", "oracle", "snowflake",
  "excel", "powerbi", "tableau", "looker", "dbt", "pandas", "numpy", "pytorch", "tensorflow",
  "machine-learning", "deep-learning", "nlp", "ia", "datavisualisation", "dataviz",
  "figma", "sketch", "photoshop", "illustrator", "indesign", "canva",
  "wordpress", "shopify", "prestashop", "magento", "salesforce", "hubspot", "sap",
  "seo", "sea", "sem", "crm", "erp", "saas", "b2b", "b2c", "kpi", "roi",
  "google-analytics", "google-ads", "meta-ads", "email-marketing", "merchandising",
  "marketing", "acquisition", "conversion", "referencement", "ecommerce", "e-commerce",
  "agile", "scrum", "kanban", "jira", "confluence", "devops", "api", "rest-api",
  "comptabilite", "audit", "fiscalite", "paie", "juridique", "logistique",
  "anglais", "espagnol", "allemand", "italien", "chinois",
]);

const stripAccents = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Normalise un texte : accents, balises, ponctuation, composés soudés. */
function normalize(text: string): string {
  let clean = stripAccents(text.replace(/<[^>]+>/g, " ").toLowerCase())
    .replace(/[^\w\s+#./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [phrase, replacement] of COMPOUNDS) {
    clean = clean.split(phrase).join(replacement);
  }
  return clean;
}

const tokenize = (text: string): string[] =>
  normalize(text)
    .replace(/(\w)\/(\w)/g, "$1 $2")
    .split(/\s+/)
    .map((w) => w.replace(/^[-/.]+|[-/.]+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

/**
 * Acronymes isolés du texte source (SEO, CRM, SQL…). Les lignes majoritairement en
 * capitales sont ignorées : ce sont des titres de rubrique, pas des compétences.
 */
function acronyms(raw: string): Set<string> {
  const found = new Set<string>();
  for (const line of raw.split(/\n+/)) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const caps = words.filter((w) => w.length > 1 && w === w.toUpperCase() && /[A-ZÀ-Ÿ]/.test(w));
    if (caps.length / words.length > 0.6) continue; // titre en capitales
    for (const m of line.matchAll(/\b[A-Z][A-Z0-9]{1,4}\b/g)) {
      found.add(stripAccents(m[0].toLowerCase()));
    }
  }
  return found;
}

export type ScoredKeyword = { term: string; weight: number };

/** Termes issus des composés soudés ci-dessus : par construction, des savoir-faire. */
const COMPOUND_TERMS = new Set(COMPOUNDS.map(([, replacement]) => replacement));

/** Un terme est un savoir-faire s'il est un outil connu, un composé soudé ou un acronyme isolé. */
const isSkillTerm = (term: string, acro: Set<string>): boolean =>
  SKILL_LEXICON.has(term) || COMPOUND_TERMS.has(term) || /\d/.test(term) || acro.has(term);

/** Seuil de rétention : en-dessous, un terme est du décor, pas une exigence. */
const MIN_WEIGHT = 3;

/**
 * Exigences de l'offre, pondérées. Un terme n'est retenu QUE si :
 *  - c'est un savoir-faire identifiable (×3, donc retenu même cité une seule fois) ;
 *  - ou l'offre le martèle (3 occurrences ou plus) ;
 *  - ou il figure dans l'intitulé du poste (+3).
 *
 * Un mot ordinaire cité une ou deux fois — « néanmoins », « université », « accueil » —
 * reste sous le seuil et n'entre pas au dénominateur. C'était toute l'origine des
 * « mots-clés absents » absurdes et du score plancher.
 */
export function extractJobKeywords(jobDesc: string, role = ""): ScoredKeyword[] {
  if (!jobDesc.trim()) return [];

  const acro = acronyms(jobDesc);
  const titleTerms = new Set(tokenize(role));

  const freq = new Map<string, number>();
  for (const t of tokenize(jobDesc)) freq.set(t, (freq.get(t) ?? 0) + 1);

  const scored: ScoredKeyword[] = [];
  for (const [term, count] of freq) {
    let weight = Math.min(count, 3);
    if (isSkillTerm(term, acro)) weight *= 3;
    if (titleTerms.has(term)) weight += 3;
    if (weight >= MIN_WEIGHT) scored.push({ term, weight });
  }

  return scored.sort((a, b) => b.weight - a.weight).slice(0, 30);
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Présence d'un terme dans un texte, aux frontières de mot, pluriel toléré. */
function contains(haystack: string, term: string): boolean {
  const candidates = [term];
  if ((term.endsWith("s") || term.endsWith("x")) && term.length > 4) {
    candidates.push(term.slice(0, -1));
  }
  return candidates.some((c) =>
    new RegExp(`(?<![\\w-])${escapeRe(c)}(?:s|x)?(?![\\w-])`).test(haystack),
  );
}

export type AtsAxisKey = "keywords" | "structure" | "impact" | "fit";

export type AtsAxis = {
  key: AtsAxisKey;
  label: string;
  /** Poids de l'axe dans le score global, en %. */
  weight: number;
  score: number;
  hint: string;
};

export type AtsReport = {
  score: number;
  verdict: string;
  axes: AtsAxis[];
  matched: ScoredKeyword[];
  missing: ScoredKeyword[];
  sections: Record<string, boolean>;
  /** Mots-clés absents, prêts pour l'injection invisible (tirets → espaces). */
  boostKeywords: string[];
};

const verdictFor = (score: number): string =>
  score >= 85
    ? "Excellent — envoyable tel quel"
    : score >= 70
      ? "Bon, à optimiser"
      : score >= 50
        ? "À retravailler avant d'envoyer"
        : "Insuffisant pour cette offre";

/** Axe 2 : structure (25 %) — un ATS doit pouvoir découper le CV en rubriques. */
function scoreStructure(resume: Resume, sections: Record<string, boolean>): number {
  let structure = 0;
  if (sections["Expériences"]) structure += 25;
  if (sections["Compétences"]) structure += 25;
  if (sections["Formation"]) structure += 20;
  if (sections["Résumé / Accroche"]) structure += 15;
  if (resume.email.trim() && resume.phone.trim()) structure += 15;
  return structure;
}

/** Axe 3 : impact (20 %) — des réalisations chiffrées, pas une liste de tâches. */
function scoreImpact(resume: Resume): number {
  const bullets = [
    ...resume.experience.flatMap((e) => e.bullets),
    ...resume.volunteer.flatMap((v) => v.bullets),
  ].filter((b) => b.trim());
  if (!bullets.length) return 0;
  const quantified = bullets.filter((b) => /\d/.test(b)).length;
  return Math.round(30 + 70 * (quantified / bullets.length));
}

/** Axe 4 : adéquation (15 %) — bon intitulé de poste, coordonnées lisibles. */
function scoreFit(resume: Resume, role: string): number {
  let fit = 0;
  if (resume.email.trim() && resume.phone.trim()) fit += 30;
  if (resume.location.trim()) fit += 20;
  const jobTitle = tokenize(role);
  const cvTitle = tokenize(resume.title);
  if (jobTitle.length) {
    const overlap = jobTitle.filter((t) => cvTitle.includes(t)).length / jobTitle.length;
    fit += Math.round(50 * overlap);
  } else if (cvTitle.length) {
    fit += 50;
  }
  return fit;
}

/** Assemble le rapport à partir de l'axe « mots-clés », d'où qu'il vienne (local ou IA). */
function buildReport(
  resume: Resume,
  role: string,
  keywordScore: number,
  matched: ScoredKeyword[],
  missing: ScoredKeyword[],
): AtsReport {
  const sections = detectResumeSections(resume);
  const structure = scoreStructure(resume, sections);
  const impact = scoreImpact(resume);
  const fit = scoreFit(resume, role);

  const axes: AtsAxis[] = [
    {
      key: "keywords",
      label: "Mots-clés",
      weight: 40,
      score: keywordScore,
      hint: missing.length
        ? `Prouvez ${missing.slice(0, 3).map((k) => k.term).join(", ")} dans une expérience réelle.`
        : "Toutes les exigences de l'offre sont couvertes.",
    },
    {
      key: "structure",
      label: "Structure",
      weight: 25,
      score: structure,
      hint: structure < 100
        ? "Complétez les rubriques manquantes et vos coordonnées (e-mail + téléphone)."
        : "Toutes les rubriques attendues sont présentes.",
    },
    {
      key: "impact",
      label: "Impact",
      weight: 20,
      score: impact,
      hint: impact < 80
        ? "Chiffrez vos réalisations : volume traité, durée, budget, audience, progression."
        : "Vos réalisations sont bien chiffrées.",
    },
    {
      key: "fit",
      label: "Adéquation",
      weight: 15,
      score: fit,
      hint: fit < 80
        ? "Alignez le titre du CV sur l'intitulé de l'offre et vérifiez vos coordonnées."
        : "Intitulé et coordonnées cohérents avec l'offre.",
    },
  ];

  const score = Math.round(
    axes.reduce((sum, a) => sum + (a.score * a.weight) / 100, 0),
  );
  const shown = missing.slice(0, 20);

  return {
    score,
    verdict: verdictFor(score),
    axes,
    matched,
    missing: shown,
    sections,
    boostKeywords: shown.map((k) => k.term.replace(/-/g, " ")),
  };
}

/**
 * Analyse locale, sans IA : les exigences sont déduites de l'offre par pondération statistique.
 * `role` = intitulé du poste (barre méta), qui sert à repérer les termes du titre.
 */
export function analyzeResumeAts(resume: Resume, jobDesc: string, role = ""): AtsReport {
  const cvNorm = normalize(Object.values(resumeToZones(resume)).join(" "));
  const keywords = extractJobKeywords(jobDesc, role);
  const matched = keywords.filter((k) => contains(cvNorm, k.term));
  const missing = keywords.filter((k) => !contains(cvNorm, k.term));

  const totalWeight = keywords.reduce((s, k) => s + k.weight, 0);
  const matchedWeight = matched.reduce((s, k) => s + k.weight, 0);
  const keywordScore = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  return buildReport(resume, role, keywordScore, matched, missing);
}

/** Une exigence de l'offre, telle que l'IA l'a extraite puis pointée (ou non) dans le CV. */
export type Requirement = {
  term: string;
  /** `hard` = indispensable, `nice` = souhaité. Pèse 3 contre 1 dans l'axe mots-clés. */
  kind: "hard" | "nice";
  present: boolean;
  /** Extrait du CV qui prouve la compétence (vide si absente). */
  evidence: string;
};

/** Correction prioritaire rédigée par l'IA (contrat de `/api/ats-score`). */
export type Priority = {
  title: string;
  problem: string;
  fix: string;
  example: string;
  /** Rubrique du CV où appliquer la correction (« Expériences », « Compétences »…). */
  zone: string;
};

/**
 * Analyse assistée par IA. L'IA fait ce qu'elle fait bien — comprendre l'offre, distinguer
 * l'indispensable du souhaité, reconnaître les synonymes (« JS » = « JavaScript ») — et le
 * code fait ce qu'elle fait mal : l'arithmétique. Structure, impact et adéquation restent
 * calculés sur les données du CV, donc reproductibles.
 */
export function analyzeWithRequirements(
  resume: Resume,
  requirements: Requirement[],
  role = "",
): AtsReport {
  const weigh = (r: Requirement): ScoredKeyword => ({
    term: r.term,
    weight: r.kind === "hard" ? 3 : 1,
  });
  const matched = requirements.filter((r) => r.present).map(weigh);
  const missing = requirements.filter((r) => !r.present).map(weigh);

  const totalWeight = [...matched, ...missing].reduce((s, k) => s + k.weight, 0);
  const matchedWeight = matched.reduce((s, k) => s + k.weight, 0);
  const keywordScore = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  return buildReport(
    resume,
    role,
    keywordScore,
    matched.sort((a, b) => b.weight - a.weight),
    missing.sort((a, b) => b.weight - a.weight),
  );
}

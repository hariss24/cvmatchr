// Donner des coordonnées aux offres qui n'en ont pas.
//
// ⚠️ Pourquoi ce module existe. Le filtre « à moins de N km de chez moi » ne
// peut travailler qu'avec des coordonnées, et un seul ATS en fournit :
// SmartRecruiters. Mesuré le 06/08/2026, 6 123 offres sur 19 555 en portent,
// soit 31 %. Pour les 69 % restants, le filtre retombait sur une comparaison de
// texte — « à 30 km de Lyon » se réduisait à « le libellé contient le mot
// Lyon ». Villeurbanne, collée à Lyon, ne le contient pas.
//
// Coût mesuré le même jour sur cinq agglomérations et une liste partielle de
// communes : 884 offres de banlieue invisibles, dont 580 en Île-de-France
// (La Défense, Nanterre, Issy, Rungis) et 82 à Villeurbanne.
//
// Le géocodage se fait à la CONSTRUCTION de l'index, jamais pendant une
// recherche : 2 918 libellés distincts pour 13 432 offres, et le résultat est
// mis en cache pour ne pas les redemander chaque matin.
//
// Source : api-adresse.data.gouv.fr (Base Adresse Nationale, données ouvertes,
// sans clé). Attribution dans NOTICE.

const RACINE = "https://api-adresse.data.gouv.fr/search/";
const TIMEOUT_MS = 15_000;
const SCORE_MIN = 0.4;

/** Minuscule sans accent, ponctuation réduite à des espaces. */
export function normaliser(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mots qui ne peuvent pas faire partie d'un nom de commune française.
 *
 * ⚠️ « sur », « de », « le », « en » n'y sont PAS, et c'est délibéré :
 * Neuilly-sur-Seine et Aix-en-Provence les portent. Les avoir retirés faisait
 * échouer le géocodage de Neuilly (50 offres) — mesuré le 06/08/2026.
 */
const PARASITES = new Set([
  "area", "hybrid", "remote", "office", "offices", "campus", "headquarters", "hq",
  "onsite", "teletravail", "based", "region", "greater", "metropolitan", "zone",
  "secteur", "agence", "usine", "bureau", "bureaux", "siege", "france", "fr", "fra", "emea",
]);

/** Code postal métropolitain ou d'outre-mer, isolé dans le libellé. */
const RE_CP = /\b(0[1-9]|[1-8]\d|9[0-8])\d{3}\b/;

/** Découpe un libellé en morceaux susceptibles de nommer une commune. */
function morceaux(libelle) {
  const out = [];
  for (const bloc of String(libelle).split(/\s*[;/|>^]\s*|\s+or\s+|,/i)) {
    // « France - Paris » : les DEUX côtés du tiret sont essayés. N'en prendre
    // qu'un faisait perdre 66 offres sur ce seul libellé.
    for (const part of bloc.split(/\s+-\s+|\s+–\s+/)) {
      const t = part.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * Requêtes à tenter pour un libellé, de la plus fiable à la moins.
 *
 * Fonction pure : c'est elle qui porte toute l'intelligence du module, et elle
 * est testable sans réseau.
 */
export function requetesPour(libelle) {
  const out = [];
  const vus = new Set();
  const ajouter = (type, q) => {
    const cle = `${type}:${q}`;
    if (q && !vus.has(cle)) { vus.add(cle); out.push({ type, q }); }
  };

  const cp = RE_CP.exec(String(libelle));
  if (cp) ajouter("cp", cp[0]);

  const blocs = morceaux(libelle);
  for (const bloc of blocs) {
    const mots = normaliser(bloc).split(" ").filter((m) => m && !PARASITES.has(m) && !/^\d+$/.test(m));
    if (mots.length) ajouter("ville", mots.join(" "));
  }

  // Dernier recours : chaque mot isolément. « Four Seasons Megeve » ne nomme
  // aucune commune en entier, mais son dernier mot si — 110 offres.
  for (const bloc of blocs) {
    const mots = normaliser(bloc).split(" ").filter((m) => m.length >= 4 && !PARASITES.has(m) && !/^\d+$/.test(m));
    if (mots.length > 1) for (const m of mots) ajouter("mot", m);
  }
  return out;
}

/** Combien de communes homonymes on regarde avant de trancher. */
const CANDIDATS = 5;

/** Écart de score en dessous duquel deux homonymes sont jugés indépartageables. */
const ECART_MINIMAL = 0.05;

async function interroger(q, commune, fetchImpl) {
  const type = commune ? "&type=municipality" : "";
  const res = await fetchImpl(`${RACINE}?q=${encodeURIComponent(q)}&limit=${CANDIDATS}${type}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const corps = await res.json();
  return corps?.features ?? [];
}

/**
 * Mots utiles d'un libellé ou d'un contexte, pour reconnaître un département ou
 * une région.
 *
 * ⚠️ `exclus` retire les mots du nom de la commune, et c'est indispensable :
 * le contexte de Saint-Denis (93) est « 93, Seine-Saint-Denis, Île-de-France »,
 * qui contient « saint » et « denis ». Sans ce retrait, cette commune gagnait le
 * départage contre celle de La Réunion pour le seul libellé « Saint-Denis »,
 * c'est-à-dire sur son propre nom plutôt que sur un véritable indice.
 * « france » est écarté pour la même raison : il est partout.
 */
function motsUtiles(texte, exclus = new Set()) {
  return new Set(
    normaliser(texte)
      .split(" ")
      .filter((m) => m.length >= 3 && m !== "france" && !exclus.has(m)),
  );
}

/**
 * Choisit parmi des communes homonymes celle que le libellé désigne vraiment.
 *
 * ⚠️ « Saint-Denis » nomme onze communes. Interrogée seule, la Base Adresse
 * Nationale rend celle de La Réunion en premier, avec un score de 0,96 —
 * vérifié le 06/08/2026. Sans départage, 74 offres de Seine-Saint-Denis, du
 * Grand Est et de l'Oise se retrouvaient à 9 000 km de leur vraie place :
 * invisibles pour le candidat francilien, et fausses pour le candidat réunionnais.
 *
 * Le libellé complet porte presque toujours l'indice qui tranche
 * (« Saint-Denis, Seine-Saint-Denis, France »). On le compare au `context` que
 * l'API renvoie, qui vaut « 93, Seine-Saint-Denis, Île-de-France ».
 *
 * ⚠️ Quand rien ne départage deux homonymes de score équivalent, on rend
 * `null` : mieux vaut aucune coordonnée — la recherche retombe alors sur le
 * libellé — qu'une offre placée dans le mauvais département.
 */
/**
 * Longueur minimale d'une forme courte pour qu'elle désigne quelque chose.
 * « Bar » ne nomme rien — Bar-le-Duc, Bar-sur-Aube, Bar-sur-Seine.
 */
const PREFIXE_MIN = 5;

/**
 * Le nom trouvé correspond-il à ce qu'on a demandé ?
 *
 * Deux formes acceptées, et deux seulement :
 *   - le nom est CONTENU dans la demande — « Vélizy-Villacoublay, France » ;
 *   - la demande est le PREMIER MOT ENTIER du nom — « Vélizy » pour
 *     « Vélizy-Villacoublay ».
 *
 * ⚠️ La seconde a été ajoutée le 21/08/2026 après mesure sur le flux Stellantis,
 * où les offres du site de Vélizy n'écrivent jamais le nom complet de la commune.
 *
 * ⚠️ L'espace final n'est pas décoratif : il exige un mot entier. Sans lui,
 * « Turin » validerait « Thurins » et « Amsterdam » les « Îles Saint-Paul et
 * Nouvelle-Amsterdam » — deux cas réels du même flux, tous deux étrangers, que
 * la Base Adresse Nationale propose spontanément. Ce garde-fou est la seule
 * chose qui empêche une offre italienne d'atterrir près de Lyon.
 */
function nomCorrespond(requete, nom) {
  const q = normaliser(requete);
  const n = normaliser(nom);
  if (q.includes(n)) return true;
  return q.length >= PREFIXE_MIN && n.startsWith(`${q} `);
}

function departager(traits, requete, libelle) {
  const recevables = traits.filter((t) => {
    const nom = t?.properties?.city ?? t?.properties?.name ?? "";
    return nomCorrespond(requete, nom) && (t?.properties?.score ?? 0) >= SCORE_MIN;
  });
  if (recevables.length === 0) return null;

  // ⚠️ Le contrôle de région s'applique AUSSI à un candidat unique. Sans lui,
  // « Saint Louis, Grand Est, France » atterrissait à La Réunion : la recherche
  // par commune ne tranchait pas, celle par adresse ne rendait qu'un résultat,
  // et ce résultat unique passait sans qu'on regarde s'il était dans la bonne
  // région. Vérifié le 06/08/2026.
  const attendue = regionDuLibelle(libelle);
  if (attendue) {
    const coherents = recevables.filter((t) => normaliser(t.properties?.context ?? "").includes(attendue));
    if (coherents.length === 0) return null;
    if (coherents.length === 1) return coherents[0];
    return departagerParContexte(coherents, libelle);
  }

  if (recevables.length === 1) return recevables[0];
  return departagerParContexte(recevables, libelle);
}

/**
 * Les treize régions métropolitaines et les collectivités d'outre-mer, sans
 * accent — telles qu'elles apparaissent dans le `context` de l'API et dans les
 * libellés que les ATS produisent (« Nîmes, Occitanie, France »).
 */
const REGIONS = [
  "auvergne rhone alpes", "bourgogne franche comte", "bretagne", "centre val de loire",
  "corse", "grand est", "hauts de france", "ile de france", "normandie",
  "nouvelle aquitaine", "occitanie", "pays de la loire", "provence alpes cote d azur",
  "guadeloupe", "martinique", "guyane", "la reunion", "mayotte",
];

/** La région nommée par le libellé, ou `null` s'il n'en nomme aucune. */
function regionDuLibelle(libelle) {
  const t = normaliser(libelle);
  return REGIONS.find((r) => t.includes(r)) ?? null;
}

function departagerParContexte(recevables, libelle) {

  const notes = recevables.map((t) => {
    const nom = t?.properties?.city ?? t?.properties?.name ?? "";
    const propres = motsUtiles(nom);
    const attendus = motsUtiles(libelle, propres);
    const mots = motsUtiles(t.properties?.context ?? "", propres);
    let commun = 0;
    for (const m of mots) if (attendus.has(m)) commun += 1;
    return { trait: t, commun, score: t.properties?.score ?? 0 };
  });
  notes.sort((a, b) => b.commun - a.commun || b.score - a.score);

  // Le libellé nomme le département ou la région : cet indice fait foi.
  if (notes[0].commun > 0 && notes[0].commun > notes[1].commun) return notes[0].trait;

  // Aucun indice, et deux homonymes se tiennent : on refuse de choisir.
  if (notes[0].commun === notes[1].commun && notes[0].score - notes[1].score < ECART_MINIMAL) {
    return null;
  }
  return notes[0].trait;
}

/**
 * Code département tel que la Base Adresse Nationale le donne, premier segment
 * de `context` (« 93, Seine-Saint-Denis, Île-de-France » → « 93 »).
 *
 * ⚠️ Ne pas le dériver du code postal : « 20 » n'existe pas (Corse = 2A/2B) et
 * les DOM tiennent sur trois chiffres. Le premier segment de `context` est le
 * seul champ qui porte réellement le code département.
 */
export function departementDuTrait(trait) {
  const contexte = trait?.properties?.context ?? "";
  const premier = contexte.split(",")[0]?.trim() ?? "";
  return /^(\d{2,3}|2A|2B)$/.test(premier) ? premier : "";
}

function retenir(trait, via) {
  const [lng, lat] = trait?.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    ville: trait.properties?.city ?? trait.properties?.name ?? "",
    lat,
    lng,
    via,
    departement: departementDuTrait(trait),
  };
}

/**
 * Coordonnées d'un libellé de lieu, ou `null` si aucune commune n'y est
 * reconnaissable.
 *
 * ⚠️ GARDE-FOU : le nom trouvé doit figurer dans ce qu'on a demandé. Sans lui,
 * « France » rend Fort-de-France avec un score de 0,68 — vérifié le
 * 06/08/2026 — et l'offre atterrit en Martinique. Le score seul ne protège de
 * rien. Un code postal, lui, est non ambigu et échappe au garde-fou.
 */
export async function coordonneesDe(libelle, fetchImpl = fetch) {
  for (const { type, q } of requetesPour(libelle)) {
    if (type === "cp") {
      // Un code postal désigne un lieu sans équivoque : ni garde-fou, ni
      // départage à faire.
      const traits = await interroger(q, true, fetchImpl);
      const r = traits[0] && retenir(traits[0], "code postal");
      if (r) return r;
      continue;
    }
    for (const commune of [true, false]) {
      const traits = await interroger(q, commune, fetchImpl);
      const choisi = departager(traits, q, libelle);
      if (!choisi) continue;
      const r = retenir(choisi, commune ? "commune" : "adresse");
      if (r) return r;
    }
  }
  return null;
}

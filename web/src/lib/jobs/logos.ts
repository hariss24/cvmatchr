/**
 * Résolution des logos d'entreprise.
 *
 * Aucune de nos sources ne fournit de logo utilisable : Adzuna n'a pas le champ,
 * France Travail ne le renseigne qu'exceptionnellement. Il faut donc partir de la
 * seule chose dont on dispose — la raison sociale — et retrouver l'entreprise.
 *
 * Deux tentatives ont échoué avant celle-ci, pour la même raison :
 *
 * 1. Deviner le domaine (« Nexton » → nexton.fr) et prendre son favicon. Quand le
 *    pari tombait à côté, on affichait le logo d'une autre société.
 * 2. Demander le domaine à l'annuaire Brandfetch. Il répond « Nexton » →
 *    `nexton.com.pk`, un vendeur de puériculture pakistanais. Wikidata, interrogé
 *    de même, répond `nexton-net.jp`, un éditeur japonais. Le vrai Nexton est
 *    `nexton-group.com`. Exiger que le nom corresponde exactement ne protège de
 *    rien : les trois s'appellent réellement « Nexton ».
 *
 * Le nom d'une entreprise n'identifie donc pas l'entreprise. Aucun domaine n'est
 * donc pris au mot : tous passent d'abord deux filtres gratuits — une extension
 * plausible (`tldPlausible`) et un domaine qui épouse le nom (`domaineProche`).
 * Ces deux-là suffisent d'ailleurs à barrer les deux échecs racontés plus haut :
 * `nexton.com.pk` tombe sur l'extension, `escpbachelorblog.com` sur le nom.
 *
 * Au-delà, deux régimes, parce que les candidats n'ont pas la même provenance :
 *
 * - **Deviné** à partir du nom : rien ne le cautionne, donc on visite sa page
 *   d'accueil, et la preuve de langue écarte les homonymes (`nexton.com`,
 *   quartier résidentiel de Caroline du Sud). C'est la preuve la plus directe,
 *   donc elle passe en premier.
 * - **Nommé par l'annuaire**, sous le nom exact de l'entreprise, quand aucun
 *   deviné n'a convaincu : on le retient sans le visiter. Exiger cette visite ne
 *   protégeait de rien et coûtait cher — `thea.com` s'affiche en anglais,
 *   `decathlon.fr` et `cbre.fr` répondent 403 aux robots, `pepsico.fr` n'a pas de
 *   titre lisible. Toutes perdaient leur logo alors que l'annuaire les connaît. Or
 *   c'est justement cette connaissance qui compte : un domaine qu'il référence a un
 *   logo au CDN, là où un domaine inventé n'y renvoie qu'une tuile blanche.
 *
 * Sans confirmation, pas de logo : l'initiale.
 *
 * Le rendu du logo, lui, revient à Brandfetch, qui le sert très bien dès lors
 * qu'on lui donne le bon domaine (`logoUrlFor`).
 */

const SEARCH_URL = "https://api.brandfetch.io/v2/search";

/** Réponse utile de la Brand Search API ; les autres champs sont ignorés. */
interface Marque {
  name?: string;
  domain?: string;
}

/** Suffixes juridiques : « ACME SAS » et « ACME » désignent la même marque. */
const SUFFIXES = /\b(sa|sas|sasu|sarl|eurl|sci|scop|snc|gie)\b/g;

/** Clé de regroupement : deux graphies d'une même entreprise ne font qu'un appel. */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Même chose, espaces compris : « TEAM INSIDE » et « teaminside.fr » se rejoignent. */
const compact = (s: string): string => normalizeCompany(s).replace(/ /g, "");

/**
 * Extensions acceptées. Liste blanche et non liste noire : les entreprises qui
 * recrutent en France sont en `.fr`, `.com` ou `.eu`, tandis que les homonymes
 * qui polluent les annuaires sont en `.pk`, `.jp`, `.bd`… Énumérer ce qu'on
 * accepte est plus sûr que de courir après tous les pays du monde.
 */
const TLD_ACCEPTES = /\.(fr|com|eu|net|org|io|co|work|agency|group|paris|bzh)$/;

/** Le domaine est-il plausible pour une entreprise qui recrute en France ? */
export function tldPlausible(domain: string): boolean {
  return TLD_ACCEPTES.test(domain.toLowerCase());
}

/**
 * Le domaine désigne-t-il l'entreprise elle-même, et non l'une de ses annexes ?
 *
 * L'annuaire propose `escpbachelorblog.com` pour « ESCP Business School » : le
 * nom y est bien, noyé dans un domaine de blog dont le logo n'est pas celui de
 * l'école. Le domaine d'une entreprise, lui, épouse son nom par un bout ou par
 * l'autre — `nexton-group.com` prolonge « Nexton », `covea.com` abrège « Groupe
 * Covéa ». Un blog s'en écarte au milieu, et c'est ce qui le trahit.
 */
export function domaineProche(domain: string, company: string): boolean {
  const label = domain.toLowerCase().split(".")[0].replace(/-/g, "");
  const nom = compact(company);
  if (!label || !nom) return false;
  return label.startsWith(nom) || nom.startsWith(label) || nom.endsWith(label);
}

/**
 * Domaines à tenter pour une entreprise, du plus au moins probable.
 *
 * Certaines raisons sociales *sont* déjà un domaine (« Collective.work ») : on
 * l'essaie tel quel. Sinon on décline le nom collé puis tireté, en `.fr` d'abord
 * — nos offres sont françaises. Ces candidats ne sont que des hypothèses ; c'est
 * `siteConfirme` qui tranche.
 */
export function domainCandidates(company: string): string[] {
  const out: string[] = [];
  const brut = company.trim().toLowerCase();

  if (/^[a-z0-9-]+\.[a-z]{2,}$/.test(brut)) out.push(brut);

  const mots = normalizeCompany(company).split(" ").filter(Boolean);
  if (mots.length === 0) return out;

  const colle = mots.join("");
  const tirets = mots.join("-");
  for (const base of colle === tirets ? [colle] : [colle, tirets]) {
    if (base.length >= 3) out.push(`${base}.fr`, `${base}.com`);
  }
  return [...new Set(out)];
}

/**
 * Le titre de la page se réclame-t-il de cette entreprise ?
 *
 * On accepte le nom entier collé (« teaminside » dans « Teaminside : 100%
 * digitale ») ou, à défaut, son premier mot s'il est assez distinctif — le titre
 * de `collective.work` annonce « Collective » sans le « work ». En dessous de
 * cinq lettres, un mot est trop banal pour valoir preuve.
 */
export function titreConfirme(titre: string, company: string): boolean {
  const t = compact(titre);
  if (!t) return false;

  const attendu = compact(company);
  if (attendu.length >= 3 && t.includes(attendu)) return true;

  const premier = normalizeCompany(company).split(" ")[0] ?? "";
  return premier.length >= 5 && t.includes(premier);
}

/**
 * Le site s'adresse-t-il au marché français ?
 *
 * Dernier filet, et le plus efficace contre les homonymes en `.com`, que
 * l'extension ne peut pas départager : `nexton.com` est un quartier résidentiel
 * de Caroline du Sud dont le site déclare `lang="en"`, `fabgroup.com` un
 * fabricant italien en `lang="it-IT"`. Les vrais employeurs de nos offres
 * déclarent `fr` — y compris `covea.com` et `nexton-group.com`.
 *
 * Un `.fr` se passe de cette preuve : le domaine l'apporte déjà. Le prix de la
 * règle est une entreprise française dont le site est en anglais (`escp.eu`),
 * qui perd son logo. C'est le sens du compromis voulu : pas de logo plutôt
 * qu'un logo faux.
 */
function viseLaFrance(domain: string, html: string): boolean {
  if (domain.toLowerCase().endsWith(".fr")) return true;
  const lang = /<html[^>]*\slang=["']?([a-z]{2})/i.exec(html)?.[1]?.toLowerCase();
  return lang === "fr";
}

/** Page d'accueil ; "" si le serveur refuse de la livrer. */
async function fetchAccueil(domain: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`https://${domain}`, {
    signal,
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CVMatchr/1.0)" },
  });
  if (!res.ok) return "";
  return (await res.text()).slice(0, 20_000);
}

/** Le site existe-t-il, se réclame-t-il de cette entreprise, et vise-t-il la France ? */
async function siteConfirme(domain: string, company: string): Promise<boolean> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), 6000);
  try {
    const html = await fetchAccueil(domain, ctrl.signal);

    // Les grandes enseignes se défendent contre les robots : `decathlon.fr`,
    // `cbre.fr` et `manpower.fr` répondent 403 sans une ligne de HTML. Faute de
    // preuve, elles perdaient toutes leur logo. Or un serveur qui répond, sur un
    // `.fr` qui porte déjà le nom de l'entreprise, est tout sauf un domaine parké :
    // ceux-là répondent 200 et affichent tranquillement leur page de vente.
    if (!html) return domain.toLowerCase().endsWith(".fr");

    if (!viseLaFrance(domain, html)) return false;
    const titre = /<title[^>]*>([^<]{0,200})/i.exec(html)?.[1]?.trim() ?? "";
    return titreConfirme(titre, company);
  } catch {
    return false; // injoignable, TLS invalide, délai dépassé : non confirmé
  } finally {
    clearTimeout(minuteur);
  }
}

/** Domaines suggérés par l'annuaire Brandfetch pour ce nom, déjà filtrés. */
async function domainesAnnuaire(company: string, clientId: string): Promise<string[]> {
  const url = `${SEARCH_URL}/${encodeURIComponent(company)}?c=${encodeURIComponent(clientId)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];

  const cible = normalizeCompany(company);
  return (data as Marque[])
    .filter((m) => m.domain && normalizeCompany(m.name ?? "") === cible)
    .map((m) => m.domain as string);
}

/**
 * Domaine officiel d'une entreprise, ou "" si rien n'a pu être confirmé.
 *
 * L'annuaire passe en premier : quand il a raison, il trouve des domaines
 * qu'aucune règle ne saurait deviner (`escp.eu` pour « ESCP Business School »),
 * et il les donne sous le nom exact de l'entreprise. Les candidats devinés
 * prennent le relais, et couvrent les PME qu'aucun annuaire ne connaît — eux
 * seuls doivent faire leurs preuves, faute de caution.
 */
export async function resolveDomain(company: string, clientId: string): Promise<string> {
  const recevable = (d: string) => tldPlausible(d) && domaineProche(d, company);

  // Les devinés passent en premier : un site français qui se réclame de l'entreprise
  // est la preuve la plus directe qui soit, et elle départage ce que l'annuaire
  // confond. Pour « Fab Group », il propose `fabgroup.com`, un fabricant de meubles
  // italien, quand `fab-group.fr` répond en français au bon nom.
  for (const d of domainCandidates(company).filter(recevable)) {
    if (await siteConfirme(d, company)) return d;
  }

  // À défaut, l'annuaire, borné à ses trois premières suggestions : au-delà il
  // s'éloigne du nom cherché.
  const annuaire = (await domainesAnnuaire(company, clientId).catch(() => []))
    .slice(0, 3)
    .filter(recevable);
  return annuaire[0] ?? "";
}

/**
 * URL du logo, destinée à une balise `<img>` dans le navigateur.
 *
 * Les conditions d'usage de Brandfetch interdisent l'accès programmatique aux
 * images et exigent un en-tête `Referer` : une requête serveur est redirigée
 * vers la page des guidelines au lieu de renvoyer l'image. C'est donc bien le
 * navigateur qui doit la charger — d'où une URL construite ici, mais jamais
 * suivie ici. Le client ID est public par conception, il vit dans l'URL.
 */
export function logoUrlFor(domain: string, clientId: string): string {
  return `https://cdn.brandfetch.io/${domain}/w/128/h/128?c=${encodeURIComponent(clientId)}`;
}

/**
 * Mémoire des domaines déjà résolus, y compris les échecs (`""`).
 *
 * Une entreprise revient d'un scan à l'autre et publie souvent plusieurs offres.
 * Sans ce cache, chaque recherche relancerait les mêmes requêtes de vérification.
 * Un `Map` de process suffit : l'enjeu est d'absorber les rafales d'un même scan,
 * pas de survivre à un redémarrage.
 */
const cache = new Map<string, string>();

/**
 * Complète `logoUrl` pour les offres qui n'en ont pas.
 *
 * Une seule résolution par entreprise distincte, quel que soit son nombre
 * d'offres, et les échecs sont silencieux : un logo manquant ne doit jamais faire
 * échouer une recherche. Les offres dont la source a déjà fourni un logo ne sont
 * pas touchées.
 */
export async function withCompanyLogos<T extends { company: string; logoUrl: string }>(
  offers: T[],
  clientId: string | undefined,
): Promise<T[]> {
  if (!clientId) return offers;

  const aResoudre = new Map<string, string>();
  for (const o of offers) {
    if (o.logoUrl || !o.company.trim()) continue;
    const cle = normalizeCompany(o.company);
    if (cle && !cache.has(cle) && !aResoudre.has(cle)) aResoudre.set(cle, o.company);
  }

  const entrees = [...aResoudre.entries()];
  const domaines = await Promise.all(
    entrees.map(([, nom]) => resolveDomain(nom, clientId).catch(() => "")),
  );
  entrees.forEach(([cle], i) => cache.set(cle, domaines[i]));

  return offers.map((o) => {
    if (o.logoUrl) return o;
    const domaine = cache.get(normalizeCompany(o.company)) ?? "";
    return domaine ? { ...o, logoUrl: logoUrlFor(domaine, clientId) } : o;
  });
}

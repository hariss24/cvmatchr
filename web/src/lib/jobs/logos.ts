/**
 * Résolution des logos d'entreprise via l'annuaire de marques Brandfetch.
 *
 * Aucune de nos sources ne fournit de logo utilisable : Adzuna n'a pas le champ,
 * France Travail ne le renseigne qu'exceptionnellement, seul JSearch en donne un
 * — et il est rarement activé. Les cartes affichaient donc une lettre grise.
 *
 * La tentation est de deviner le domaine à partir de la raison sociale
 * (« Nexton » → nexton.fr) puis d'en tirer le favicon. Essayé, écarté : quand le
 * pari tombe à côté, on affiche le logo d'une autre société sans aucun moyen de
 * s'en apercevoir. Un mauvais logo est pire qu'une initiale.
 *
 * Brandfetch fait l'inverse : son annuaire associe un nom à un domaine *vérifié*
 * et renvoie l'icône correspondante. La Brand Search API est gratuite jusqu'à
 * 500 000 requêtes par mois, sans attribution, plafonnée à 200 requêtes par
 * tranche de 5 minutes et par IP — largement au-dessus de nos volumes.
 * Cf. https://docs.brandfetch.com/reference/brand-search-api
 *
 * Sans `BRANDFETCH_CLIENT_ID` configuré, la résolution est simplement sautée et
 * les cartes retombent sur l'initiale. Rien ne casse.
 */

const SEARCH_URL = "https://api.brandfetch.io/v2/search";

/** Réponse utile de la Brand Search API ; les autres champs sont ignorés. */
interface Marque {
  name?: string;
  domain?: string;
  icon?: string;
  /** Le propriétaire a revendiqué sa fiche : logo à jour et fiable. */
  claimed?: boolean;
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

/**
 * Choisit le domaine de la marque correspondant vraiment au nom cherché.
 *
 * Brandfetch classe par popularité, pas par exactitude : chercher « Skolae »
 * remonte « Skolae Formation » (domaine abilways.com) et « Campus Skolae Tours ».
 * On exige donc que le nom retourné soit équivalent au nom cherché, et l'on
 * préfère une fiche revendiquée par son propriétaire. Sans correspondance
 * franche, on ne renvoie rien — l'initiale vaut mieux qu'un logo faux.
 *
 * On retient le domaine et non le champ `icon` de la réponse : celui-ci est
 * toujours un « lettermark », l'initiale dessinée dans un carré, y compris pour
 * des marques dont Brandfetch possède le vrai logo (vérifié sur Decathlon). Le
 * logo s'obtient au domaine, via le CDN.
 */
export function pickBrand(results: Marque[], company: string): string {
  const cible = normalizeCompany(company);
  if (!cible) return "";

  const exacts = results.filter((m) => m.domain && normalizeCompany(m.name ?? "") === cible);
  const retenu = exacts.find((m) => m.claimed) ?? exacts[0];
  return retenu?.domain ?? "";
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

async function fetchOne(company: string, clientId: string): Promise<string> {
  // La clé conditionne la qualité du résultat : sans elle, l'annuaire répond
  // encore mais dégrade tous les logos en lettermarks, que `pickBrand` écarte.
  const url = `${SEARCH_URL}/${encodeURIComponent(company)}?c=${encodeURIComponent(clientId)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return "";
  const data: unknown = await res.json();
  return Array.isArray(data) ? pickBrand(data as Marque[], company) : "";
}

/**
 * Complète `logoUrl` pour les offres qui n'en ont pas.
 *
 * Un seul appel par entreprise distincte, quel que soit son nombre d'offres, et
 * les échecs sont silencieux : un logo manquant ne doit jamais faire échouer une
 * recherche. Les offres dont la source a déjà fourni un logo ne sont pas touchées.
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
    if (cle && !aResoudre.has(cle)) aResoudre.set(cle, o.company);
  }
  if (aResoudre.size === 0) return offers;

  const entrees = [...aResoudre.entries()];
  const domaines = await Promise.all(
    entrees.map(([, nom]) => fetchOne(nom, clientId).catch(() => "")),
  );

  const parCle = new Map(
    entrees.map(([cle], i) => [cle, domaines[i] ? logoUrlFor(domaines[i], clientId) : ""]),
  );
  return offers.map((o) =>
    o.logoUrl ? o : { ...o, logoUrl: parCle.get(normalizeCompany(o.company)) ?? "" },
  );
}

// Repérer les sites de recrutement dans l'univers des noms d'hôtes du web.
//
// ⚠️ Pourquoi ce module existe. Les deux voies de découverte du projet trouvent
// un board seulement si son adresse est PRÉVISIBLE : soit elle est sous le
// domaine d'un ATS connu (préfixe SURT, `crawl.mjs`), soit elle se devine depuis
// le nom légal de l'entreprise (`sources.mjs`). Les deux ratent l'ATS installé
// sur le domaine propre de l'employeur.
//
// Ce n'est pas un cas marginal : `jobs.groupe-psa.com` (Talentsoft) et
// `careers.bouygues-construction.com` (SuccessFactors) sont invisibles des deux
// méthodes, alors que ce sont deux grands groupes français.
//
// La voie retenue renverse le problème : au lieu de deviner l'adresse d'une
// entreprise, on lit TOUS les noms d'hôtes vus par Common Crawl (voir
// `parquet.mjs`, ~600 Mo pour le web entier) et on garde ceux qui se nomment
// comme un site de recrutement. Le nom d'hôte n'est qu'une présomption : c'est
// le sondage qui tranche, et il tranche par un fait (RSS présent ou non).

const MOTS = [
  "job", "jobs", "career", "careers", "carriere", "carrieres",
  "recrute", "recrutement", "emploi", "emplois", "hiring", "talent", "talents",
  "candidat", "candidats", "candidature", "rejoignez", "joinus", "vacatures",
];

/**
 * Un mot de recrutement isolé par une frontière de nom d'hôte : début, fin,
 * point ou tiret.
 *
 * ⚠️ La frontière n'est pas cosmétique. Sans elle, « jobteaser », « careerbuilder »
 * et tout nom contenant la sous-chaîne « job » entreraient — et le filet, qui
 * doit ramener quelques dizaines de milliers d'hôtes sur environ dix-neuf
 * millions, en ramasserait une part sans rapport avec un employeur.
 */
const RE_CARRIERE = new RegExp(`(^|[.-])(${MOTS.join("|")})([.-]|$)`, "i");

/** Ce nom d'hôte se présente-t-il comme un site de recrutement ? */
export function estCandidatCarriere(hote) {
  return RE_CARRIERE.test(String(hote ?? ""));
}

/**
 * Les noms d'hôtes « site carrière » de toute une collection Common Crawl.
 *
 * ⚠️ Un fichier en échec est IGNORÉ, il n'emporte pas la moisson. Sur 300
 * fichiers, exiger que tous répondent revient à n'aboutir jamais. C'est
 * acceptable ici, contrairement à un board : le résultat sert à ÉTENDRE la
 * liste des hôtes à sonder, jamais à en retirer. Un hôte manqué ce mois-ci
 * revient le mois suivant ; il ne disparaît de rien.
 */
export async function hotesCarrieres(chemins, lireColonneImpl) {
  const out = new Set();

  for (const chemin of chemins) {
    let lignes;
    try {
      lignes = await lireColonneImpl(chemin, "url_host_name");
    } catch {
      console.warn(`Fichier columnar ${chemin} illisible, ignoré.`);
      continue;
    }
    for (const l of lignes) {
      const hote = l?.url_host_name;
      if (hote && estCandidatCarriere(hote)) out.add(hote);
    }
  }

  return out;
}

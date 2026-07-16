/**
 * Modèle de départ de la lettre de motivation. Un seul modèle, paramétré par les
 * variables de `render.ts` (`{Variable}` ou `{Variable|repli}`). Le corps contient
 * tout : formule d'appel, texte, formule de politesse et signature.
 */

export interface MailTemplate {
  id: string;
  name: string;
  letterSubject: string;
  letterBody: string;
  updatedAt: number;
}

export const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    id: "default-candidature",
    name: "Candidature",
    letterSubject: "Candidature spontanée – {Poste} – {Prénom} {Nom}",
    letterBody:
      "{M/Mme Nom|Madame, Monsieur},\n\n" +
      "Diplômé d'un Master 2 en e-commerce et habitué à mener des projets web de bout en bout, " +
      "je me décrirais comme un vrai couteau suisse du web. Curieux de nature, j'aime comprendre " +
      "les dessous techniques d'un site autant que les leviers stratégiques qui le font grandir.\n\n" +
      "Aujourd'hui, c'est chez {Entreprise|vous} que je souhaite mettre cette polyvalence et cette " +
      "culture web au service de projets concrets, en tant que {Poste|membre de votre équipe}. " +
      "Ce qui m'anime, c'est d'accompagner une organisation dans sa croissance digitale, en mêlant " +
      "technique et stratégie pour donner du sens à chaque action. J'aime les environnements où la " +
      "curiosité est une force, où on apprend sans cesse et où chaque projet est une nouvelle " +
      "aventure à construire.\n\n" +
      "Je serais ravi d'échanger avec vous pour me présenter plus concrètement et vous expliquer " +
      "comment je pourrais contribuer à vos projets.\n\n" +
      "En vous remerciant pour votre temps et votre attention, je vous prie d'agréer mes salutations " +
      "les plus sincères.\n\n" +
      "{Prénom} {Nom}",
    updatedAt: 0,
  },
];

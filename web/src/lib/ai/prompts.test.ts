import { describe, it, expect } from "vitest";
import {
  adaptLetterSystem,
  SYSTEM_EXTRACT_META,
  SYSTEM_TEXT_TO_LETTER,
  RESUME_TAILOR_RULES,
  RESUME_SCHEMA_DESC,
  EXTRACTION_SCHEMA_DESC,
  SYSTEM_PDF_TO_RESUME,
  SYSTEM_TEXT_TO_RESUME,
  SYSTEM_TAILOR_RESUME_BASE,
  SYSTEM_EDITOR_CHAT,
  HUMAN_TONE_RULE,
  CONCISION_RULE,
  LETTER_FIELDS_RULE,
  tailorResumeSystem,
  type TailorLevel,
} from "./prompts";
import { resumeSchema, letterSchema, RESUME_TOP_KEYS } from "@/lib/resume/schema";
import { LETTER_TONES } from "@/lib/letter/tone";

const LEVELS: TailorLevel[] = ["peu", "adapte", "hyper"];
const TONES = LETTER_TONES.map((t) => t.id);
/** Le prompt réellement envoyé dans le cas nominal (registre par défaut, lettre du candidat). */
const SYSTEM_ADAPT_LETTER = adaptLetterSystem("humain", "adapte");

describe("prompts — invariants métier", () => {
  // GARDE-FOU ANTI-DÉRIVE — ne pas remplacer par une liste écrite à la main.
  //
  // `RESUME_SCHEMA_DESC` est une copie manuelle du schéma Zod : c'est la fiche envoyée
  // à l'IA. Si un champ existe dans le modèle mais pas dans la fiche, l'IA ignore son
  // existence et déverse son contenu ailleurs — silencieusement. C'est exactement ce
  // qui est arrivé à `softSkills` et `tools` : le CV importé voyait ses soft skills
  // fusionnés dans `skills`. La liste ci-dessous est donc DÉRIVÉE du schéma, jamais
  // recopiée : ajouter un champ au CV sans l'ajouter à la fiche fait échouer ce test.
  it("la fiche IA décrit toutes les clés du schéma CV (garde-fou anti-dérive)", () => {
    // Les SEULS champs volontairement absents de la fiche, chacun pour une raison précise.
    // Toute autre omission est une dérive et doit faire échouer ce test.
    const HORS_FICHE = new Set([
      "photo", //          base64 : jamais envoyée à l'IA (coût, inutile).
      "hiddenSections", // préférence d'affichage de l'utilisateur, pas du contenu de CV :
      //                   l'IA n'a rien à en dire, et `mergeTailored` la recopie toujours
      //                   depuis la base pour qu'une adaptation ne puisse pas la perdre.
      "sectionTitles", // titres personnalisés : hors de la fiche de TAILORING seulement
      //                  (préférence d'affichage, restaurée par `mergeTailored`). La fiche
      //                  d'EXTRACTION le décrit, elle — cf. « fiches de schéma » plus bas :
      //                  à l'import, l'intitulé du CV source est du contenu.
    ]);
    const keys = Object.keys(resumeSchema.shape).filter((k) => !HORS_FICHE.has(k));
    for (const key of keys) {
      expect(RESUME_SCHEMA_DESC, `champ « ${key} » absent de RESUME_SCHEMA_DESC`).toContain(
        `"${key}"`,
      );
    }
  });

  it("les extractions imposent des listes de compétences cloisonnées", () => {
    for (const system of [SYSTEM_PDF_TO_RESUME, SYSTEM_TEXT_TO_RESUME]) {
      expect(system).toContain("softSkills");
      expect(system).toContain("tools");
      expect(system).toContain("customSections");
      expect(system).toContain("ne fusionne JAMAIS");
    }
  });

  it("tous les niveaux JSON existent", () => {
    for (const level of LEVELS) {
      expect(RESUME_TAILOR_RULES[level], level).toBeTruthy();
    }
  });



  it("un niveau inconnu retombe sur 'adapte'", () => {
    expect(tailorResumeSystem("n'importe quoi" as TailorLevel)).toBe(tailorResumeSystem("adapte"));
  });

});

describe("fiches de schéma — extraction vs tailoring", () => {
  // `sectionTitles` sépare les deux usages, et cette séparation est la correction d'un
  // bug réel : sans ce champ à l'extraction, l'IA ne pouvait pas à la fois « utiliser le
  // champ standard » et « ne jamais renommer une rubrique ». Elle faisait les deux, et
  // le CV sortait avec une section libre doublonnant un champ déjà rempli.
  it("la fiche d'extraction décrit sectionTitles", () => {
    expect(EXTRACTION_SCHEMA_DESC).toContain('"sectionTitles"');
  });

  it("la fiche de tailoring ne décrit PAS sectionTitles", () => {
    expect(RESUME_SCHEMA_DESC).not.toContain('"sectionTitles"');
  });

  it("la fiche d'extraction est un sur-ensemble de la fiche de tailoring", () => {
    for (const key of RESUME_TOP_KEYS) {
      if (key === "sectionTitles") continue;
      if (!RESUME_SCHEMA_DESC.includes(`"${key}"`)) continue;
      expect(EXTRACTION_SCHEMA_DESC, `champ « ${key} » perdu à l'extraction`).toContain(
        `"${key}"`,
      );
    }
  });

  it("les deux extractions utilisent la fiche étendue, le tailoring non", () => {
    for (const system of [SYSTEM_PDF_TO_RESUME, SYSTEM_TEXT_TO_RESUME]) {
      expect(system).toContain('"sectionTitles"');
    }
    expect(SYSTEM_TAILOR_RESUME_BASE).not.toContain('"sectionTitles"');
  });
});

describe("prompts — cohérence des niveaux (pas de contradiction base/niveau)", () => {
  it("le niveau JSON 'peu' n'ordonne ni élagage ni réécriture des compétences", () => {
    const sys = tailorResumeSystem("peu");
    expect(sys).not.toContain("ÉLAGUER");
    expect(sys).not.toContain("1 PAGE");
    expect(sys).not.toContain("Mot clé — Description");
    expect(sys).toContain("NE modifie RIEN d'autre");
  });

  it("les niveaux JSON 'adapte' et 'hyper' gardent l'élagage 1 page et le format compétences", () => {
    for (const level of ["adapte", "hyper"] as const) {
      const sys = tailorResumeSystem(level);
      expect(sys, level).toContain("1 PAGE");
      expect(sys, level).toContain("Mot clé — Description");
    }
  });

  // La concision fait gagner de la hauteur de page, mais « subtil » promet à
  // l'utilisateur de ne rien raccourcir : les deux consignes ensemble laisseraient le
  // modèle arbitrer seul. Elle ne part qu'avec les niveaux qui réécrivent déjà.
  it("la concision accompagne les niveaux qui réécrivent, jamais 'peu'", () => {
    expect(tailorResumeSystem("peu")).not.toContain("CONCISION");
    expect(tailorResumeSystem("peu")).toContain("PAS D'ÉLAGAGE");
    for (const level of ["adapte", "hyper"] as const) {
      expect(tailorResumeSystem(level), level).toContain("CONCISION");
    }
  });

  // Raccourcir ne doit jamais devenir un prétexte à jeter un fait : c'est l'emballage
  // qu'on retire, pas le contenu.
  it("la concision interdit explicitement de perdre une information", () => {
    expect(CONCISION_RULE).toContain("JAMAIS à supprimer un fait");
    expect(CONCISION_RULE).toContain("à information égale");
  });

  it("tous les niveaux JSON protègent les résultats chiffrés et la séniorité", () => {
    for (const level of LEVELS) {
      expect(tailorResumeSystem(level), level).toContain("RÉSULTATS CHIFFRÉS");
      expect(tailorResumeSystem(level), level).toContain("SÉNIORITÉ");
    }
  });

  it("tous les niveaux JSON interdisent d'ajouter des outils absents du CV", () => {
    for (const level of ["peu", "adapte", "hyper"] as const) {
      expect(tailorResumeSystem(level), level).toContain("outil, un logiciel");
    }
  });



});

describe('prompts — text to letter', () => {
  it('SYSTEM_TEXT_TO_LETTER demande un JSON pur avec les cles obligatoires', () => {
    expect(SYSTEM_TEXT_TO_LETTER).toContain('JSON PUR');
    expect(SYSTEM_TEXT_TO_LETTER).toContain('recipient_name');
    expect(SYSTEM_TEXT_TO_LETTER).toContain('sender_name');
  });
});

describe('prompts — adapt letter / extract meta', () => {
  it('SYSTEM_ADAPT_LETTER demande un JSON avec le corps de la lettre', () => {
    expect(SYSTEM_ADAPT_LETTER).toContain('JSON PUR');
    expect(SYSTEM_ADAPT_LETTER).toContain('"body":');
  });

  // Une lettre rendue avec « en tant que Poste occupé chez Entreprise » part telle quelle au
  // recruteur : c'est le pire bug possible de la fonctionnalité. Le prompt doit interdire le
  // trou explicitement, parce que le MODÈLE DE TON de HUMAN_TONE_RULE en montre lui-même.
  it('SYSTEM_ADAPT_LETTER interdit de laisser des trous à compléter', () => {
    expect(SYSTEM_ADAPT_LETTER).toContain('INTERDICTION ABSOLUE DE LAISSER UN TROU');
    expect(SYSTEM_ADAPT_LETTER).toContain('supprime la phrase');
    expect(HUMAN_TONE_RULE).toContain("les crochets ci-dessus n'existent que pour anonymiser");
  });

  // LE BUG DU 24/07 : le prompt ouvrait sur « adapter LÉGÈREMENT » + « CONSERVE le ton du
  // texte d'origine ». Appliqué au squelette d'usine (« [Argumentaire : décrivez vos
  // compétences…] »), ça produisait une lettre scolaire — la règle de tonalité, placée vingt
  // lignes plus bas, perdait l'arbitrage. Aucun registre ne doit réintroduire cette consigne.
  it("aucun prompt de lettre n'ordonne de conserver le ton du texte de départ", () => {
    for (const tone of TONES) {
      for (const mission of ["adapte", "redige"] as const) {
        const sys = adaptLetterSystem(tone, mission);
        expect(sys, `${tone}/${mission}`).not.toContain("CONSERVE le ton");
        expect(sys, `${tone}/${mission}`).not.toContain("adapter LÉGÈREMENT");
      }
    }
  });

  it("le mode « rédige » dit explicitement que le squelette n'a pas de voix à conserver", () => {
    const redige = adaptLetterSystem("humain", "redige");
    expect(redige).toContain("écrire le corps de la lettre");
    expect(redige).toContain("squelette");
    // Le mode « adapte », lui, protège la voix du candidat : c'est SON texte.
    const adapte = adaptLetterSystem("humain", "adapte");
    expect(adapte).toContain("Garde ses idées");
    // …mais pas au point de couvrir les formules toutes faites : c'est cette échappatoire qui
    // laissait passer « je me tiens à votre disposition », hérité du modèle d'usine.
    expect(adapte).toContain("n'est pas « sa voix »");
  });

  it("chaque registre porte son exemple de ton et garde les règles communes", () => {
    for (const tone of TONES) {
      const sys = adaptLetterSystem(tone, "adapte");
      expect(sys, tone).toContain("REGISTRE DEMANDÉ");
      expect(sys, tone).toContain("TONALITÉ");
      expect(sys, tone).toContain("INTERDICTION ABSOLUE DE LAISSER UN TROU");
      expect(sys, tone).toContain("NE RECOPIE PAS LE VOCABULAIRE DE L'OFFRE");
    }
    expect(adaptLetterSystem("factuel", "adapte")).toContain("FACTUEL ET CONCRET");
    expect(adaptLetterSystem("humain", "adapte")).toContain("AUTHENTIQUE, PERSONNEL ET HUMAIN");
  });

  // `flash-lite` recopiait la lettre-exemple en entier, amorces comprises, et la servait
  // au recruteur comme l'expérience du candidat. Un exemple assez long pour faire un
  // squelette de lettre EST un squelette de lettre : chaque registre décrit donc sa
  // mécanique et ne montre plus que des fragments.
  it("aucun registre ne contient de lettre-exemple complète", () => {
    for (const tone of TONES) {
      const sys = adaptLetterSystem(tone, "adapte");
      expect(sys, tone).toContain("MÉCANIQUE À REPRODUIRE");
      // Aucun fragment d'exemple ne doit atteindre la longueur d'un paragraphe.
      const fragments = sys.match(/«[^»]+»/g) ?? [];
      expect(fragments.length, tone).toBeGreaterThan(0);
      for (const f of fragments) expect(f.length, `${tone} : ${f}`).toBeLessThan(120);
    }
    // La phrase de bouchage qui se retrouvait telle quelle dans les lettres envoyées.
    expect(adaptLetterSystem("humain", "adapte"))
      .not.toContain("transformer des besoins métiers en résultats concrets");
  });

  // Le registre est le signal qui doit dominer : il passe AVANT les règles. Placé après une
  // page de consignes, il se perd — c'est exactement le bug d'origine.
  it("le registre est placé avant les règles générales", () => {
    for (const tone of TONES) {
      const sys = adaptLetterSystem(tone, "adapte");
      expect(sys.indexOf("REGISTRE DEMANDÉ"), tone).toBeLessThan(sys.indexOf("TONALITÉ"));
    }
  });

  // GARDE-FOU MESURÉ EN CONDITIONS RÉELLES (24/07, gemini-3.1-flash-lite) : à ~9 000
  // caractères de consignes, le modèle produisait les formules interdites deux lignes plus
  // haut ; à ~2 500, il rend le registre demandé du premier coup. Si ce test casse, c'est
  // qu'on est en train de réempiler des règles — condenser, ou montrer par l'exemple.
  it("le prompt de lettre reste court (le signal se dilue au-delà)", () => {
    for (const tone of TONES) {
      for (const mission of ["adapte", "redige"] as const) {
        expect(adaptLetterSystem(tone, mission).length, `${tone}/${mission}`).toBeLessThan(4000);
      }
    }
  });

  // Les crochets du prompt se retrouvaient recopiés dans la lettre (bug des « trous »), et
  // le garde-fou serveur les rejette : aucun exemple de ton ne doit en contenir.
  it("aucun modèle de ton ne contient de crochets", () => {
    for (const tone of TONES) {
      expect(adaptLetterSystem(tone, "redige"), tone).not.toMatch(/\[[^\]\n]{2,80}\]/);
    }
  });

  it('SYSTEM_EXTRACT_META demande l\'entreprise et le poste', () => {
    expect(SYSTEM_EXTRACT_META).toContain('JSON PUR');
    expect(SYSTEM_EXTRACT_META).toContain('"company":');
    expect(SYSTEM_EXTRACT_META).toContain('"role":');
  });
});

describe("prompts — tonalité humaine", () => {
  // Le style est une exigence produit, pas un détail cosmétique : un texte qui « sent l'IA »
  // fait éliminer la candidature. La règle doit donc être présente partout où le modèle
  // RÉDIGE — et nulle part où il se contente d'EXTRAIRE, sinon il réécrirait le CV importé
  // au lieu de le recopier fidèlement (ce qui ruinerait l'architecture « zéro perte »).
  it("les prompts qui rédigent portent la règle de tonalité", () => {
    for (const level of LEVELS) {
      expect(tailorResumeSystem(level), level).toContain("TONALITÉ");
    }
    expect(SYSTEM_EDITOR_CHAT).toContain("TONALITÉ");
    expect(SYSTEM_ADAPT_LETTER).toContain("TONALITÉ");
  });

  it("les prompts d'extraction ne portent PAS la règle de tonalité", () => {
    expect(SYSTEM_PDF_TO_RESUME).not.toContain("TONALITÉ");
    expect(SYSTEM_TEXT_TO_RESUME).not.toContain("TONALITÉ");
    expect(SYSTEM_TEXT_TO_LETTER).not.toContain("TONALITÉ");
    expect(SYSTEM_EXTRACT_META).not.toContain("TONALITÉ");
  });

  it("la règle proscrit les clichés de candidature et les tics d'IA", () => {
    expect(HUMAN_TONE_RULE).toContain("fort de mon expérience");
    expect(HUMAN_TONE_RULE).toContain("force de proposition");
    expect(HUMAN_TONE_RULE).toContain("participe présent");
  });

  it("la règle épargne les listes du candidat (compétences, savoir-être…)", () => {
    expect(HUMAN_TONE_RULE).toContain("PÉRIMÈTRE");
    expect(HUMAN_TONE_RULE).toContain("ne les réécris pas au nom du style");
  });

  // La règle bannit le tiret cadratin en prose, mais le format des compétences l'impose.
  // L'exception doit rester ALLUSIVE : citer « Mot clé — Description » ferait fuiter ce
  // format dans le niveau « subtil », qui interdit justement de reformater les compétences.
  it("la règle épargne le tiret cadratin des formats imposés, sans citer lequel", () => {
    expect(HUMAN_TONE_RULE).toContain("SEULE EXCEPTION");
    expect(HUMAN_TONE_RULE).not.toContain("Mot clé — Description");
    expect(tailorResumeSystem("peu")).not.toContain("Mot clé — Description");
    expect(tailorResumeSystem("adapte")).toContain("Mot clé — Description");
  });
});

describe("prompts — champs d'une lettre", () => {
  // Le chat recevait la lettre sans AUCUNE définition de ses champs (« respecte le même
  // schéma que l'entrée »), là où le CV a droit à RESUME_SCHEMA_DESC. Le modèle devait
  // deviner : il écrivait le nom du candidat dans la formule de politesse ~1 fois sur 3.
  // 'signoff' et 'signature' alimentent deux blocs distincts du PDF (LetterDocument) :
  // les confondre affiche le nom à la place de la politesse.
  it("le chat éditeur définit le rôle de chaque champ de lettre", () => {
    expect(SYSTEM_EDITOR_CHAT).toContain("RÔLE DE CHAQUE CHAMP D'UNE LETTRE");
    expect(SYSTEM_EDITOR_CHAT).toContain("'signoff'");
    expect(SYSTEM_EDITOR_CHAT).toContain("'signature'");
  });

  it("le chat interdit explicitement le nom dans la formule de politesse", () => {
    expect(LETTER_FIELDS_RULE).toContain("ce champ ne contient jamais de nom");
    expect(LETTER_FIELDS_RULE).toContain("Recopie la valeur de 'sender_name'");
  });

  it("les champs décrits au chat correspondent au schéma réel de la lettre", () => {
    for (const cle of Object.keys(letterSchema.shape)) {
      expect(LETTER_FIELDS_RULE, cle).toContain(`'${cle}'`);
    }
  });
});

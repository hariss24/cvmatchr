import { describe, it, expect } from "vitest";
import {
  SYSTEM_ADAPT_LETTER,
  SYSTEM_EXTRACT_META,
  TAILOR_SYSTEMS,
  SYSTEM_TEXT_TO_LETTER,
  RESUME_TAILOR_RULES,
  RESUME_SCHEMA_DESC,
  SYSTEM_TAILOR_RESUME_BASE_INVENT,
  SYSTEM_PDF_TO_RESUME,
  SYSTEM_TEXT_TO_RESUME,
  tailorResumeSystem,
  tailorHtmlSystem,
  type TailorLevel,
} from "./prompts";
import { resumeSchema } from "@/lib/resume/schema";

const LEVELS: TailorLevel[] = ["peu", "adapte", "hyper", "sur-mesure"];

describe("prompts — invariants métier", () => {
  it("chaque niveau d'adaptation HTML porte la règle anti-détection", () => {
    for (const level of LEVELS) {
      expect(TAILOR_SYSTEMS[level], level).toContain("ANTI-DÉTECTION");
    }
  });

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

  it("tailorResumeSystem n'utilise la base 'invention' que pour sur-mesure", () => {
    expect(tailorResumeSystem("sur-mesure")).toContain("optimisation de CV agressive");
    expect(tailorResumeSystem("adapte")).not.toContain("optimisation de CV agressive");
    expect(SYSTEM_TAILOR_RESUME_BASE_INVENT).toContain("optimisation de CV agressive");
  });

  it("un niveau inconnu retombe sur 'adapte'", () => {
    expect(tailorResumeSystem("n'importe quoi" as TailorLevel)).toBe(tailorResumeSystem("adapte"));
  });

  it("tailorHtmlSystem inclut les règles HTML communes", () => {
    const sys = tailorHtmlSystem("adapte");
    expect(sys).toContain("RÈGLES TECHNIQUES STRICTES");
    expect(sys).toContain("PRÉSERVATION INTÉGRALE");
  });

  it("tailorHtmlSystem en mode Maître bascule en élagage", () => {
    const sys = tailorHtmlSystem("hyper", true);
    expect(sys).toContain("RÈGLE DE SÉLECTION (CV MAÎTRE)");
    expect(sys).not.toContain("PRÉSERVATION INTÉGRALE");
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

  it("tous les niveaux JSON protègent les résultats chiffrés et la séniorité", () => {
    for (const level of LEVELS) {
      expect(tailorResumeSystem(level), level).toContain("RÉSULTATS CHIFFRÉS");
      expect(tailorResumeSystem(level), level).toContain("SÉNIORITÉ");
    }
  });

  it("les niveaux JSON hors sur-mesure interdisent d'ajouter des outils absents du CV", () => {
    for (const level of ["peu", "adapte", "hyper"] as const) {
      expect(tailorResumeSystem(level), level).toContain("outil, un logiciel");
    }
  });

  it("le sur-mesure JSON porte des garde-fous (pas d'outil nommé, ni certification, ni chiffre inventé)", () => {
    const sys = tailorResumeSystem("sur-mesure");
    expect(sys).toContain("GARDE-FOUS");
    expect(sys).toContain("certification");
    expect(sys).not.toContain("résultats chiffrés crédibles");
  });

  it("le niveau HTML 'peu' n'impose ni la page unique ni la réécriture des compétences", () => {
    const sys = tailorHtmlSystem("peu");
    expect(sys).not.toContain("1 PAGE");
    expect(sys).not.toContain("800 caractères");
  });

  it("les niveaux HTML 'adapte'/'hyper'/'sur-mesure' gardent les règles de réécriture", () => {
    for (const level of ["adapte", "hyper", "sur-mesure"] as const) {
      const sys = tailorHtmlSystem(level);
      expect(sys, level).toContain("1 PAGE");
      expect(sys, level).toContain("RÈGLES DE RÉÉCRITURE");
    }
  });

  it("tous les niveaux HTML protègent les résultats chiffrés et la séniorité", () => {
    for (const level of LEVELS) {
      expect(tailorHtmlSystem(level), level).toContain("RÉSULTATS CHIFFRÉS");
      expect(tailorHtmlSystem(level), level).toContain("SÉNIORITÉ");
    }
  });

  it("le sur-mesure HTML n'autorise plus les chiffres inventés", () => {
    const sys = tailorHtmlSystem("sur-mesure");
    expect(sys).toContain("GARDE-FOUS");
    expect(sys).not.toContain("résultats chiffrés crédibles");
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

  it('SYSTEM_EXTRACT_META demande l\'entreprise et le poste', () => {
    expect(SYSTEM_EXTRACT_META).toContain('JSON PUR');
    expect(SYSTEM_EXTRACT_META).toContain('"company":');
    expect(SYSTEM_EXTRACT_META).toContain('"role":');
  });
});

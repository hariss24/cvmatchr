/**
 * Assemblage de la lettre après une adaptation IA (parcours « Adapter à une offre »).
 *
 * Extrait de `TailorModal` pour être testable : c'est ici que se jouaient deux bugs
 * visibles par l'utilisateur — un en-tête resté sur la candidature précédente
 * (« Darwin Microfluidics » alors que l'offre visait le Ministère de l'Intérieur) et un
 * expéditeur jamais renseigné, laissé sur « Prénom Nom / email@example.com ».
 *
 * Règle : L'OFFRE COLLÉE FAIT FOI. La barre meta (entreprise/poste) n'est plus qu'un
 * repli quand l'extraction échoue, jamais une mémoire silencieuse du dossier précédent.
 */

import { DEFAULT_LETTER, type Letter, type Resume } from "@/lib/resume/schema";
import { renderTemplate } from "@/lib/templates/render";

export interface JobMeta {
  company: string;
  role: string;
}

/**
 * Entreprise/poste retenus : ce que l'IA a lu dans l'offre, sinon ce que l'utilisateur
 * avait saisi. Une extraction qui renvoie du vide ne doit pas effacer une saisie manuelle.
 */
export function resolveMeta(fromJob: JobMeta | null, current: JobMeta): JobMeta {
  return {
    company: fromJob?.company.trim() || current.company.trim(),
    role: fromJob?.role.trim() || current.role.trim(),
  };
}

/**
 * Le modèle de lettre du candidat porte SON appel et SA signature dans le corps (c'est le
 * format du Pack). La Letter a en plus des champs `greeting` / `signoff` / `signature`
 * rendus autour du corps : sans ça le PDF affiche « Madame, Monsieur, » puis « Bonjour
 * Madame, Monsieur, », et deux formules de politesse à la suite.
 */
const GREETING_RE = /^\s*(bonjour|madame|monsieur|cher\b|chère|chers|à l'attention)/i;
const SIGNOFF_RE = /(cordialement|salutations|sincèrement|respectueusement|bien à vous)/i;

/** Les dernières lignes non vides, là où se logent politesse et signature. */
function tail(body: string, lines = 3): string {
  return body.split("\n").map((l) => l.trim()).filter(Boolean).slice(-lines).join("\n");
}

/** Un champ encore sur sa valeur d'usine n'a jamais été renseigné : on peut le remplir. */
function isUntouched(value: string, factory: string): boolean {
  const v = value.trim();
  return !v || v === factory.trim();
}

/** Prénom + nom, pour les variables {Prénom} / {Nom} du corps. */
function splitName(full: string): { prenom: string; nom: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { prenom: "", nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

export interface AdaptedLetterInput {
  /** La lettre actuellement dans l'éditeur. */
  letter: Letter;
  /** Le corps renvoyé par l'IA, variables `{Entreprise}`… non encore substituées. */
  body: string;
  /** CV Maître, source de l'identité de l'expéditeur. */
  master: Resume | null;
  /** Entreprise/poste résolus par `resolveMeta`. */
  meta: JobMeta;
  /** Date du jour déjà formatée en français (« 24 juillet 2026 »). */
  today: string;
}

/**
 * Renvoie la lettre complète à écrire dans l'éditeur : corps adapté, en-tête aligné sur
 * l'offre, expéditeur pris dans le CV Maître.
 */
export function buildAdaptedLetter({ letter, body, master, meta, today }: AdaptedLetterInput): Letter {
  const company = meta.company.trim();
  const role = meta.role.trim();

  // Expéditeur : le CV Maître fait foi, mais on ne piétine pas une saisie manuelle —
  // seuls les champs vides ou restés sur la valeur d'usine sont remplis.
  const masterName = (master?.name ?? "").trim();
  const sender_name =
    masterName && isUntouched(letter.sender_name, DEFAULT_LETTER.sender_name)
      ? masterName
      : letter.sender_name;
  const masterAddress = (master?.location ?? "").trim();
  const sender_address =
    masterAddress && isUntouched(letter.sender_address, DEFAULT_LETTER.sender_address)
      ? masterAddress
      : letter.sender_address;
  const masterContact = [master?.email, master?.phone].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
  const sender_contact =
    masterContact && isUntouched(letter.sender_contact, DEFAULT_LETTER.sender_contact)
      ? masterContact
      : letter.sender_contact;

  // {Prénom}/{Nom} : le nom réel, jamais le « Prénom Nom » d'usine (il finirait dans le texte).
  const signatureName = isUntouched(letter.signature, DEFAULT_LETTER.signature) ? "" : letter.signature;
  const typedName = isUntouched(sender_name, DEFAULT_LETTER.sender_name) ? "" : sender_name;
  const { prenom, nom } = splitName(masterName || signatureName || typedName);

  const renderedBody = renderTemplate(body, {
    Entreprise: company,
    Poste: role,
    Date: today,
    "Prénom": prenom,
    Nom: nom,
    "M/Mme Nom": "",
  });

  const city = (master?.location ?? "").split(",")[0].trim();

  // L'entreprise a changé : l'adresse du destinataire appartenait à la précédente.
  const companyChanged = !!company && company !== letter.recipient_name.trim();

  // Anti-doublon : ce que le corps dit déjà, les champs autour ne le redisent pas.
  const end = tail(renderedBody);
  const bodyHasGreeting = GREETING_RE.test(renderedBody);
  const bodyHasSignoff = SIGNOFF_RE.test(end);
  const fullName = (masterName || signatureName || typedName).trim();
  const bodyHasSignature = !!fullName && end.includes(fullName);

  return {
    ...letter,
    greeting: bodyHasGreeting ? "" : letter.greeting,
    signoff: bodyHasSignoff ? "" : letter.signoff,
    sender_name,
    sender_address,
    sender_contact,
    date: city ? `${city}, le ${today}` : `Le ${today}`,
    recipient_name: company || letter.recipient_name,
    recipient_address: companyChanged ? "" : letter.recipient_address,
    subject: role ? `Candidature au poste de ${role}` : letter.subject,
    body: renderedBody,
    signature: bodyHasSignature
      ? ""
      : isUntouched(letter.signature, DEFAULT_LETTER.signature)
        ? masterName || letter.signature
        : letter.signature,
  };
}

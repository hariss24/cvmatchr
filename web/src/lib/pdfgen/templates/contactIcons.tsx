import React from "react";
import { Svg, Path } from "@react-pdf/renderer";
import {
  siGithub,
  siGitlab,
  siX,
  siStackoverflow,
  siBehance,
  siDribbble,
  siInstagram,
  siYoutube,
  siMedium,
  siMalt,
  siWhatsapp,
  siTelegram,
  siDiscord,
} from "simple-icons";
import { px } from "./primitives";

/**
 * Icônes des coordonnées libres (« GitHub », « Permis », « Portfolio »…), détectées
 * par le CONTENU du champ — l'utilisateur nomme ses champs comme il veut, on ne peut
 * pas se fier à un id.
 *
 * Chemins SVG réels, jamais dessinés à la main : simple-icons (CC0) pour les logos de
 * marques, Bootstrap Icons (MIT) pour LinkedIn — retiré de simple-icons pour raisons
 * de marque —, Material Icons (Apache-2.0) pour les pictos génériques.
 */
const ICONS: Record<string, { viewBox: string; d: string }> = {
  github: { viewBox: "0 0 24 24", d: siGithub.path },
  gitlab: { viewBox: "0 0 24 24", d: siGitlab.path },
  x: { viewBox: "0 0 24 24", d: siX.path },
  stackoverflow: { viewBox: "0 0 24 24", d: siStackoverflow.path },
  behance: { viewBox: "0 0 24 24", d: siBehance.path },
  dribbble: { viewBox: "0 0 24 24", d: siDribbble.path },
  instagram: { viewBox: "0 0 24 24", d: siInstagram.path },
  youtube: { viewBox: "0 0 24 24", d: siYoutube.path },
  medium: { viewBox: "0 0 24 24", d: siMedium.path },
  malt: { viewBox: "0 0 24 24", d: siMalt.path },
  whatsapp: { viewBox: "0 0 24 24", d: siWhatsapp.path },
  telegram: { viewBox: "0 0 24 24", d: siTelegram.path },
  discord: { viewBox: "0 0 24 24", d: siDiscord.path },
  // bootstrap-icons « linkedin »
  linkedin: {
    viewBox: "0 0 16 16",
    d: "M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z",
  },
  // material « directions_car »
  car: {
    viewBox: "0 0 24 24",
    d: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
  },
  // material « public »
  globe: {
    viewBox: "0 0 24 24",
    d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  },
  // material « mail »
  email: {
    viewBox: "0 0 24 24",
    d: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  },
  // material « call »
  phone: {
    viewBox: "0 0 24 24",
    d: "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z",
  },
  // material « event »
  calendar: {
    viewBox: "0 0 24 24",
    d: "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
  },
  // bootstrap-icons « link-45deg » : repli des champs libres non reconnus
  link: {
    viewBox: "0 0 16 16",
    d: "M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z",
  },
};

/**
 * Règles de détection, testées dans l'ordre sur `label + valeur` en minuscules.
 * Les marques passent AVANT le repli « globe » : « github.com/x » est un lien,
 * mais doit sortir le logo GitHub, pas un globe.
 */
const RULES: [RegExp, string][] = [
  [/github/, "github"],
  [/gitlab/, "gitlab"],
  [/linkedin/, "linkedin"],
  [/stack\s*overflow/, "stackoverflow"],
  [/behance/, "behance"],
  [/dribbble/, "dribbble"],
  [/instagram/, "instagram"],
  [/youtube|youtu\.be/, "youtube"],
  [/twitter|(^|[^a-z0-9])x\.com/, "x"],
  [/medium\.com/, "medium"],
  [/\bmalt\b/, "malt"],
  [/whatsapp|wa\.me\//, "whatsapp"],
  [/telegram|t\.me\//, "telegram"],
  [/discord/, "discord"],
  [/permis/, "car"],
  [/disponib/, "calendar"],
  [/[\w.+-]+@[\w-]+\.[a-z]/, "email"],
  [/(\+\d|\b0[1-9])[\d .()-]{7,}/, "phone"],
  [/portfolio|site\s*web|website|https?:\/\/|www\.|\.(fr|com|io|dev|net|org|me|app)(\/|$)/, "globe"],
];

/** Id d'icône correspondant au contenu d'une coordonnée ; « link » si rien ne matche. */
export function detectContactIcon(label: string, value: string): string {
  const text = `${label} ${value}`.toLowerCase();
  for (const [re, id] of RULES) if (re.test(text)) return id;
  return "link";
}

/** Rendu react-pdf d'une icône détectée, aux dimensions des icônes de contact. */
export function ContactIcon({ icon, color }: { icon: string; color: string }) {
  const def = ICONS[icon];
  if (!def) return null;
  return (
    <Svg viewBox={def.viewBox} style={{ width: "100%", height: px(11) }}>
      <Path d={def.d} fill={color} />
    </Svg>
  );
}

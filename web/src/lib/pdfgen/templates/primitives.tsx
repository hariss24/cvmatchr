import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ResumeSection } from "@/lib/resume/sections";

export const px = (n: number): number => n * 0.75;
export const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

/** Gris des informations secondaires (lieu, contrat, niveau de langue). */
export const MUTED = "#787673";

// On utilise un contexte de thème pour que les templates puissent facilement personnaliser les couleurs des primitives
export interface PdfTheme {
  accent: string;
  ink: string;
  body: string;
}

export const defaultTheme: PdfTheme = {
  accent: "#0078d4",
  ink: "#111",
  body: "#555",
};

export const ThemeContext = React.createContext<PdfTheme>(defaultTheme);

const s = StyleSheet.create({
  // Timeline
  tlItem: { flexDirection: "row", marginLeft: px(10) },
  tlGutter: { width: px(20) },
  tlDot: { width: px(10), height: px(10), borderRadius: px(5) },
  tlLine: { width: px(2), flexGrow: 1, marginLeft: px(4) },
  tlBody: { flex: 1, paddingBottom: px(12) },
  tlHead: { flexDirection: "row", justifyContent: "space-between" },
  tlTitle: { fontSize: 10, fontWeight: 700, flex: 1, paddingRight: px(8) },
  tlDate: { fontSize: 10, color: "#888" },
  tlSubtitleRow: { marginTop: px(1) },
  tlSubtitle: { fontSize: 9, fontWeight: 700 },
  tlDesc: { marginTop: px(3) },

  // Listes à puces
  bullets: { paddingLeft: px(15) },
  bulletRow: { flexDirection: "row", marginBottom: px(1) },
  bulletGlyph: { width: px(8) },
  bulletText: { flex: 1 },

  // Sections
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: px(10),
    marginBottom: px(10),
  },
});

export function TimelineItem({
  last,
  title,
  date,
  subtitleParts,
  children,
  hideGutter,
}: {
  last: boolean;
  title: string;
  date: string;
  subtitleParts: { text: string; bold?: boolean; muted?: boolean }[];
  children?: React.ReactNode;
  hideGutter?: boolean;
}) {
  const theme = React.useContext(ThemeContext);
  const parts = subtitleParts.filter((p) => t(p.text));
  return (
    <View style={[s.tlItem, hideGutter ? { marginLeft: 0 } : {}]} wrap={false}>
      {!hideGutter && (
        <View style={s.tlGutter}>
          <View style={[s.tlDot, { backgroundColor: theme.body }]} />
          {!last ? <View style={[s.tlLine, { backgroundColor: theme.body }]} /> : null}
        </View>
      )}
      <View style={s.tlBody}>
        <View style={s.tlHead}>
          <Text style={[s.tlTitle, { color: theme.ink }]}>{title}</Text>
          {t(date) ? <Text style={s.tlDate}>{date}</Text> : null}
        </View>
        {parts.length ? (
          <Text style={s.tlSubtitleRow}>
            {parts.map((p, i) => (
              <Text key={i} style={p.bold ? [s.tlSubtitle, { color: theme.ink }] : p.muted ? { color: "#787673" } : {}}>
                {i > 0 ? " — " : ""}
                {p.text}
              </Text>
            ))}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

export function Bullets({ items, color }: { items: string[], color?: string }) {
  const kept = items.filter((b) => t(b));
  if (!kept.length) return null;
  return (
    <View style={[s.tlDesc, s.bullets]}>
      {kept.map((b, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletGlyph}>•</Text>
          <Text style={[s.bulletText, color ? { color } : {}]}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const theme = React.useContext(ThemeContext);
  return <Text style={[s.sectionTitle, { color: theme.accent }]}>{children}</Text>;
}

/**
 * Corps d'une section, quel que soit son type. Le TITRE reste à la charge du modèle
 * (chacun a le sien) ; ici on ne rend que le contenu.
 *
 * C'est ce qui rend la perte de données impossible. Un modèle n'a plus besoin de
 * CONNAÎTRE une section pour l'afficher : il itère sur celles que le CV lui donne et
 * délègue le corps ici. Ajouter un champ au CV — ou laisser l'IA inventer une rubrique
 * à l'import — n'oblige donc plus à toucher aux 4 modèles, et n'ouvre plus la porte à
 * un oubli silencieux.
 */
export function SectionContent({
  section,
  hideGutter,
  color,
  subtitle = "bold",
}: {
  section: ResumeSection;
  hideGutter?: boolean;
  color?: string;
  /** Rendu du sous-titre d'un parcours (entreprise, école, organisation) : gras, ou capitales grisées. */
  subtitle?: "bold" | "caps";
}) {
  const theme = React.useContext(ThemeContext);
  const itemColor = color ?? theme.ink;

  switch (section.kind) {
    case "text":
      return (
        <Text style={[{ textAlign: "justify" }, color ? { color } : {}]}>{section.text}</Text>
      );

    case "list":
      return (
        <View style={s.bullets}>
          {section.items.map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletGlyph, { color: itemColor }]}>•</Text>
              <Text style={[s.bulletText, { color: itemColor }]}>
                <SkillText skill={item} />
              </Text>
            </View>
          ))}
        </View>
      );

    case "languages":
      return (
        <View style={s.bullets}>
          {section.items.map((l, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletGlyph, { color: itemColor }]}>•</Text>
              <Text style={[s.bulletText, { color: itemColor }]}>
                {l.name}
                {t(l.level) ? <Text style={{ color: MUTED }}> : {l.level}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      );

    case "timeline":
      return (
        <>
          {section.items.map((e, i) => (
            <TimelineItem
              key={i}
              last={i === section.items.length - 1}
              title={e.title}
              date={e.date}
              hideGutter={hideGutter}
              subtitleParts={[
                subtitle === "caps"
                  ? { text: e.subtitle.toUpperCase(), muted: true }
                  : { text: e.subtitle, bold: true },
                ...e.meta.map((m) => ({ text: m, muted: true })),
              ]}
            >
              {t(e.description) ? <Text style={{ marginTop: px(3) }}>{e.description}</Text> : null}
              <Bullets items={e.bullets} />
            </TimelineItem>
          ))}
        </>
      );
  }
}

/**
 * Regroupe deux sections VOISINES dont l'id figure dans `pairIds` — Graphique et Kakuna
 * affichent Langues et Centres d'intérêt côte à côte pour gagner de la hauteur.
 *
 * Le regroupement suit l'ordre RÉEL des sections : si l'utilisateur les sépare avec les
 * flèches, chacune reprend toute la largeur. La mise en page suit le CV, jamais l'inverse.
 */
export function pairAdjacent(
  sections: ResumeSection[],
  pairIds: Set<string>,
): (ResumeSection | [ResumeSection, ResumeSection])[] {
  const out: (ResumeSection | [ResumeSection, ResumeSection])[] = [];
  for (let i = 0; i < sections.length; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    if (b && pairIds.has(a.id) && pairIds.has(b.id)) {
      out.push([a, b]);
      i++;
    } else {
      out.push(a);
    }
  }
  return out;
}

export function SkillText({ skill }: { skill: string }) {
  let parts = skill.split(" — ");
  if (parts.length === 1) parts = skill.split(" - ");
  if (parts.length > 1) {
    return (
      <Text>
        <Text style={{ fontWeight: 700 }}>{parts[0].trim()}</Text>
        {" — "}
        {parts.slice(1).join(" — ").trim()}
      </Text>
    );
  }
  return <Text>{skill}</Text>;
}

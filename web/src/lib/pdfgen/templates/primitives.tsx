import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ResumeSection } from "@/lib/resume/sections";

export const px = (n: number): number => n * 0.75;
export const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

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
 * Rend les sections qu'un modèle ne stylise pas lui-même.
 *
 * C'est le filet qui rend la perte de données impossible : un modèle déclare les
 * sections qu'il prend en charge, TOUT le reste (y compris les sections libres créées
 * par l'IA à l'import) passe ici et s'affiche quand même. Ajouter un champ au CV
 * n'oblige donc plus à toucher aux 4 modèles.
 */
export function GenericSections({
  sections,
  Title,
  wrapperStyle,
}: {
  sections: ResumeSection[];
  Title: React.ComponentType<{ children: string }>;
  wrapperStyle?: Style;
}) {
  if (!sections.length) return null;
  return (
    <>
      {sections.map((sec) => (
        <View key={sec.id} style={wrapperStyle} wrap={false}>
          <Title>{sec.title}</Title>
          {sec.kind === "text" ? <Text style={{ textAlign: "justify" }}>{sec.text}</Text> : null}
          {sec.kind === "list" ? <Bullets items={sec.items} /> : null}
          {sec.kind === "languages" ? (
            <Bullets items={sec.items.map((l) => (t(l.level) ? `${l.name} : ${l.level}` : l.name))} />
          ) : null}
          {sec.kind === "timeline"
            ? sec.items.map((e, i) => (
                <TimelineItem
                  key={i}
                  last={i === sec.items.length - 1}
                  title={e.title}
                  date={e.date}
                  hideGutter={true}
                  subtitleParts={[
                    { text: e.subtitle, bold: true },
                    ...e.meta.map((m) => ({ text: m, muted: true })),
                  ]}
                >
                  {t(e.description) ? (
                    <Text style={{ marginTop: px(3) }}>{e.description}</Text>
                  ) : null}
                  <Bullets items={e.bullets} />
                </TimelineItem>
              ))
            : null}
        </View>
      ))}
    </>
  );
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

import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume/schema";

import { px, t, ThemeContext, defaultTheme, SectionContent, pairAdjacent } from "./primitives";
import { buildSections, buildContacts, contactText, type ResumeSection } from "@/lib/resume/sections";

/** Sections que Kakuna affiche côte à côte quand elles se suivent (gain de hauteur). */
const KAKUNA_PAIRS = new Set(["languages", "interests"]);

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9.5,
    color: defaultTheme.body,
    lineHeight: 1.25,
    paddingTop: px(24),
    paddingBottom: px(24),
    paddingHorizontal: px(36),
  },

  // En-tête centré (Kakuna style)
  header: {
    alignItems: "center",
    marginBottom: px(20),
  },
  photo: {
    width: px(80),
    height: px(80),
    borderRadius: px(4),
    marginBottom: px(12),
    objectFit: "cover",
  },
  name: {
    fontSize: 18,
    fontWeight: 700,
    color: defaultTheme.ink,
    lineHeight: 1.2,
    textAlign: "center",
  },
  jobTitle: {
    fontSize: 11,
    color: defaultTheme.body,
    marginTop: px(4),
    marginBottom: px(8),
    textAlign: "center",
  },
  contactList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: px(10),
    rowGap: px(4),
  },
  contactItem: {
    fontSize: 9.5,
    color: defaultTheme.body,
  },

  // Sections
  section: {
    marginBottom: px(12),
  },
  summary: {
    fontSize: 9.5,
    textAlign: "justify",
  },

  // Titre de section Kakuna (centré, bordure en bas)
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
    borderBottomWidth: px(1),
    paddingBottom: px(4),
    marginBottom: px(8),
  },

  // Deux sections côte à côte
  twoCols: { flexDirection: "row" },
  col: { width: "48%" },
  colSpacer: { width: "4%" },
});

export function KakunaSectionTitle({ children }: { children: string }) {
  const theme = React.useContext(ThemeContext);
  return (
    <Text style={[s.sectionTitle, { color: theme.accent, borderBottomColor: theme.accent }]}>
      {children}
    </Text>
  );
}

const kakunaTheme = {
  ...defaultTheme,
  accent: "#f97316", // orange
};

export function KakunaTemplate({
  resume,

}: {
  resume: Resume;

}) {
  const d = resume;

  const contacts = buildContacts(d).map(contactText);

  // Le modèle rend les sections DU CV, dans l'ordre du CV. Il ne décide que du style.
  const sections = buildSections(d);

  /** L'accroche est le seul bloc sans titre : elle sert d'introduction, pas de rubrique. */
  const renderSection = (sec: ResumeSection) => {
    if (sec.id === "summary" && sec.kind === "text") {
      return (
        <View key={sec.id} style={s.section}>
          <Text style={s.summary}>{sec.text}</Text>
        </View>
      );
    }
    return (
      <View key={sec.id} style={s.section}>
        <KakunaSectionTitle>{sec.title.toUpperCase()}</KakunaSectionTitle>
        <SectionContent section={sec} />
      </View>
    );
  };

  return (
    <ThemeContext.Provider value={kakunaTheme}>
      <Document>
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {d.photo ? <Image style={s.photo} src={d.photo} /> : null}

            <Text style={s.name}>{d.name.toUpperCase()}</Text>
            {t(d.title) ? <Text style={s.jobTitle}>{d.title}</Text> : null}

            {contacts.length > 0 && (
              <View style={s.contactList}>
                {contacts.map((c, idx) => (
                  <Text key={idx} style={s.contactItem}>
                    {c}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {pairAdjacent(sections, KAKUNA_PAIRS).map((slot) =>
            Array.isArray(slot) ? (
              <View key={slot[0].id} style={s.twoCols}>
                <View style={s.col}>
                  <KakunaSectionTitle>{slot[0].title.toUpperCase()}</KakunaSectionTitle>
                  <SectionContent section={slot[0]} />
                </View>
                <View style={s.colSpacer} />
                <View style={s.col}>
                  <KakunaSectionTitle>{slot[1].title.toUpperCase()}</KakunaSectionTitle>
                  <SectionContent section={slot[1]} />
                </View>
              </View>
            ) : (
              renderSection(slot)
            ),
          )}


        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

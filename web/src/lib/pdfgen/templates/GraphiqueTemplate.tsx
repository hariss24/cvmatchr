import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, defaultTheme, SectionTitle, SectionContent, pairAdjacent } from "./primitives";
import { buildSections, buildContacts, contactText, type ResumeSection } from "@/lib/resume/sections";

/** Sections que Graphique affiche côte à côte quand elles se suivent (gain de hauteur). */
const GRAPHIQUE_PAIRS = new Set(["languages", "interests"]);

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9.5,
    color: defaultTheme.body,
    lineHeight: 1.25,
    paddingTop: px(16),
    paddingBottom: px(12),
    paddingHorizontal: px(36),
  },

  // En-tête
  header: { flexDirection: "row", alignItems: "center", marginBottom: px(10) },
  photo: { width: px(75), height: px(75), borderRadius: px(4), marginRight: px(16), objectFit: "cover" },
  headerTitles: { flex: 1 },
  name: { fontSize: 14, fontWeight: 700, color: defaultTheme.ink, lineHeight: 1.2 },
  jobTitle: { fontSize: 12, fontWeight: 700, color: defaultTheme.accent, marginTop: px(2) },
  contact: {
    width: px(250),
    marginLeft: px(20),
    textAlign: "right",
    fontSize: 9.5,
    color: "#444",
    lineHeight: 1.5,
  },

  // Sections
  section: { borderTopWidth: px(2), borderTopColor: defaultTheme.accent, paddingTop: px(5) },
  summarySection: { marginBottom: px(6) },
  summary: { fontSize: 10, textAlign: "justify", marginBottom: px(10) },

  // Compétences (section bordée haut/bas — l'accent visuel du modèle)
  skillsSection: {
    borderTopWidth: px(2),
    borderTopColor: defaultTheme.accent,
    borderBottomWidth: px(2),
    borderBottomColor: defaultTheme.accent,
    paddingTop: px(5),
    paddingBottom: px(8),
    marginBottom: px(10),
  },

  // Deux sections côte à côte
  twoCols: { flexDirection: "row" },
  col: { width: "48%" },
  colSpacer: { width: "4%" },
});

function GraphiqueTitle({ children }: { children: string }) {
  return <SectionTitle>{children.toUpperCase()}</SectionTitle>;
}

export function GraphiqueTemplate({
  resume,
  atsKeywords,
}: {
  resume: Resume;
  atsKeywords?: string[];
}) {
  const d = resume;

  // Espaces insécables dans chaque élément : la ligne ne casse qu'aux séparateurs « · »
  const contact = buildContacts(d)
    .map((c) => contactText(c).replace(/ /g, " "))
    .join(" · ");

  // Le modèle rend les sections DU CV, dans l'ordre du CV. Il ne décide que du style.
  const sections = buildSections(d);

  /** L'accroche est le seul bloc sans titre : elle sert d'introduction, pas de rubrique. */
  const renderSection = (sec: ResumeSection) => {
    if (sec.id === "summary" && sec.kind === "text") {
      return (
        <View key={sec.id} style={[s.section, s.summarySection]}>
          <Text style={s.summary}>{sec.text}</Text>
        </View>
      );
    }
    return (
      <View key={sec.id} style={sec.id === "skills" ? s.skillsSection : s.section}>
        <GraphiqueTitle>{sec.title}</GraphiqueTitle>
        <SectionContent section={sec} />
      </View>
    );
  };

  return (
    <ThemeContext.Provider value={defaultTheme}>
      <Document>
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {d.photo ? <Image style={s.photo} src={d.photo} /> : null}
            <View style={s.headerTitles}>
              <Text style={s.name}>{d.name.toUpperCase()}</Text>
              {t(d.title) ? <Text style={s.jobTitle}>{d.title}</Text> : null}
            </View>
            {contact ? <Text style={s.contact}>{contact}</Text> : null}
          </View>

          {pairAdjacent(sections, GRAPHIQUE_PAIRS).map((slot) =>
            Array.isArray(slot) ? (
              <View key={slot[0].id} style={s.twoCols}>
                <View style={s.col}>
                  <SectionTitle>{slot[0].title.toUpperCase()}</SectionTitle>
                  <SectionContent section={slot[0]} />
                </View>
                <View style={s.colSpacer} />
                <View style={s.col}>
                  <SectionTitle>{slot[1].title.toUpperCase()}</SectionTitle>
                  <SectionContent section={slot[1]} />
                </View>
              </View>
            ) : (
              renderSection(slot)
            ),
          )}

          <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

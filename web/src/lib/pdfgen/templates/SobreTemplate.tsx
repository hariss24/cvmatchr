import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, PdfTheme, SkillText, SectionContent } from "./primitives";
import { buildSections, buildContacts, contactText, type ResumeSection } from "@/lib/resume/sections";

const theme: PdfTheme = {
  accent: "#c9c6c1", // La couleur de personnalisation par défaut du template sobre
  ink: "#000",
  body: "#555",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: theme.body,
    lineHeight: 1.25,
    paddingTop: px(16),
    paddingBottom: px(12),
    paddingHorizontal: px(36),
  },

  // Section styling
  section: {
    borderTopWidth: px(2),
    borderTopColor: theme.accent,
    paddingTop: px(5),
    marginBottom: px(10),
  },
  sectionTitle: {
    marginBottom: px(6),
    textTransform: "uppercase",
    fontSize: 8,
    letterSpacing: 0.5,
    color: theme.body,
    fontWeight: "heavy",
  },

  // Layouts
  flexRow: { flexDirection: "row" },
  flexCol: { flexDirection: "column" },
  leftCol: { width: "25%" },
  rightCol: { flex: 1 },

  // En-tête
  personalData: {
    flexDirection: "row",
    marginBottom: px(10),
    minHeight: px(80),
  },
  photoWrapper: {
    width: "25%",
  },
  photo: {
    width: px(80),
    height: px(80),
    borderRadius: px(6),
    objectFit: "cover",
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    marginBottom: px(4),
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  name: {
    fontSize: 14,
    fontWeight: "heavy",
    color: theme.ink,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "heavy",
    color: theme.ink,
  },
  contact: {
    fontSize: 9.5,
    color: theme.body,
  },

  // Composants spécifiques à Sobre
  sobreTitle: {
    fontSize: 10,
    fontWeight: "heavy",
    color: theme.ink,
  },
  sobreDate: {
    fontSize: 10,
    color: theme.body,
  },
  sobreSubtitle: {
    fontSize: 9.5,
    fontWeight: "heavy",
    color: theme.ink,
  },
  sobreLocation: {
    fontSize: 9.5,
    color: "#787673",
    marginLeft: px(4),
  },

  skillsWrapper: {
    flexDirection: "column",
  },
  skillItem: {
    marginBottom: px(4),
  },

  langItem: {
    flexDirection: "row",
    width: "33.33%",
    marginBottom: px(6),
  },
  langName: {
    color: theme.ink,
    fontWeight: "heavy",
    marginRight: px(4),
  },
  langLevel: {
    color: "#787673",
  },
});

/**
 * Corps d'une section « annexe » (tout sauf les parcours) au style Sobre : des lignes
 * nues, sans puces. Piloté par le TYPE de la section, jamais par son nom — une rubrique
 * que personne n'a prévue (« Publications ») hérite donc automatiquement du bon rendu.
 */
function SobreAside({ section }: { section: ResumeSection }) {
  if (section.kind === "text") {
    return <Text style={{ textAlign: "justify" }}>{section.text}</Text>;
  }
  if (section.kind === "languages") {
    return (
      <View style={[s.flexRow, { flexWrap: "wrap" }]}>
        {section.items.map((l, i) => (
          <View key={i} style={s.langItem}>
            <Text style={s.langName}>{l.name}</Text>
            {t(l.level) ? <Text style={s.langLevel}>({l.level})</Text> : null}
          </View>
        ))}
      </View>
    );
  }
  if (section.kind === "list") {
    return (
      <View style={s.skillsWrapper}>
        {section.items.map((item, i) => (
          <Text key={i} style={s.skillItem}>
            <SkillText skill={item} />
          </Text>
        ))}
      </View>
    );
  }
  return <SectionContent section={section} hideGutter />;
}

export function SobreTemplate({
  resume,
  atsKeywords,
}: {
  resume: Resume;
  atsKeywords?: string[];
}) {
  const d = resume;

  // Espaces insécables : la ligne de contact ne casse qu'aux séparateurs « · ».
  const contact = buildContacts(d)
    .map((c) => contactText(c).replace(/ /g, " "))
    .join(" · ");

  // Le modèle n'énumère plus les sections qu'il connaît : il rend CELLES DU CV, dans
  // l'ordre du CV. Il ne décide que de la mise en page — parcours en pleine largeur,
  // reste en deux colonnes (libellé à gauche, contenu à droite).
  const sections = buildSections(d);

  return (
    <ThemeContext.Provider value={theme}>
      <Document>
        <Page size="A4" style={s.page}>

          <View style={s.personalData}>
            <View style={s.photoWrapper}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              {d.photo ? <Image style={s.photo} src={d.photo} /> : null}
            </View>
            <View style={s.headerContent}>
              <View style={s.headerTitleRow}>
                <Text style={s.name}>{d.name}</Text>
                {t(d.title) ? <Text style={s.jobTitle}>, {d.title}</Text> : null}
              </View>
              {contact ? <Text style={s.contact}>{contact}</Text> : null}
            </View>
          </View>

          {sections.map((sec) =>
            sec.kind === "timeline" ? (
              <View key={sec.id} style={s.section}>
                <Text style={s.sectionTitle}>{sec.title}</Text>
                <SectionContent section={sec} hideGutter />
              </View>
            ) : (
              <View key={sec.id} style={s.section}>
                <View style={s.flexRow}>
                  <View style={s.leftCol}>
                    <Text style={s.sectionTitle}>{sec.title}</Text>
                  </View>
                  <View style={s.rightCol}>
                    <SobreAside section={sec} />
                  </View>
                </View>
              </View>
            ),
          )}

          <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

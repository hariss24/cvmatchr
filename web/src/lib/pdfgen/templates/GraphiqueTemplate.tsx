import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume, ExperienceItem, EducationItem, ProjectItem, VolunteerItem } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, defaultTheme, TimelineItem, Bullets, SectionTitle, SkillText, GenericSections } from "./primitives";
import { buildSections } from "@/lib/resume/sections";

/** Sections que Graphique met en page lui-même ; le reste passe par `GenericSections`. */
const GRAPHIQUE_HANDLED = new Set([
  "summary", "experience", "education", "skills",
  "projects", "certifications", "volunteer", "languages", "interests",
]);

function GraphiqueTitle({ children }: { children: string }) {
  return <SectionTitle>{children.toUpperCase()}</SectionTitle>;
}

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

  // Compétences (section bordée haut/bas)
  skillsSection: {
    borderTopWidth: px(2),
    borderTopColor: defaultTheme.accent,
    borderBottomWidth: px(2),
    borderBottomColor: defaultTheme.accent,
    paddingTop: px(5),
    paddingBottom: px(8),
    marginBottom: px(10),
  },
  skillItem: { color: defaultTheme.ink, marginBottom: px(4) },

  // Langues & centres d'intérêt côte à côte
  twoCols: { flexDirection: "row" },
  col: { width: "48%" },
  colSpacer: { width: "4%" },
  colItem: { color: defaultTheme.ink, marginBottom: px(4) },
  langLevel: { color: defaultTheme.body },
  
  // Bullets overrides for Graphique
  bulletRow: { flexDirection: "row", marginBottom: px(1) },
  bulletGlyph: { width: px(8) },
  bulletText: { flex: 1 },
});

export function GraphiqueTemplate({
  resume,
  atsKeywords,
}: {
  resume: Resume;
  atsKeywords?: string[];
}) {
  const d = resume;

  // Espaces insécables dans chaque élément : la ligne ne casse qu'aux séparateurs « · »
  const contact = [d.location, d.email, d.phone, d.linkedin]
    .map(t)
    .filter(Boolean)
    .map((p) => p.replace(/ /g, "\u00A0"))
    .join(" · ");
  const exp = d.experience.filter((e) => e && (e.title || e.company || e.bullets.length));
  const edu = d.education.filter((e) => e && (e.title || e.school));
  const skills = d.skills.filter((x) => t(x));
  const projects = d.projects.filter((p) => p && (p.title || p.description));
  const certs = d.certifications.filter((x) => t(x));
  const volunteer = d.volunteer.filter((v) => v && (v.title || v.organization || v.bullets.length));
  const langs = d.languages.filter((l) => l && t(l.name));
  const interests = d.interests.filter((x) => t(x));
  const extra = buildSections(d).filter((sec) => !GRAPHIQUE_HANDLED.has(sec.id));

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

          {t(d.summary) ? (
            <View style={[s.section, s.summarySection]}>
              <Text style={s.summary}>{d.summary}</Text>
            </View>
          ) : null}

          {exp.length > 0 ? (
            <View style={s.section}>
              <SectionTitle>EXPÉRIENCES</SectionTitle>
              {exp.map((e: ExperienceItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === exp.length - 1}
                  title={e.title}
                  date={e.date}
                  subtitleParts={[
                    { text: e.company, bold: true },
                    { text: e.contract, muted: true },
                    { text: e.location, muted: true },
                  ]}
                >
                  <Bullets items={e.bullets} />
                </TimelineItem>
              ))}
            </View>
          ) : null}

          {edu.length > 0 ? (
            <View style={s.section}>
              <SectionTitle>FORMATIONS</SectionTitle>
              {edu.map((e: EducationItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === edu.length - 1}
                  title={e.title}
                  date={e.date}
                  subtitleParts={[
                    { text: e.school, bold: true },
                    { text: e.location, muted: true },
                  ]}
                />
              ))}
            </View>
          ) : null}

          {skills.length > 0 ? (
            <View style={s.skillsSection}>
              <SectionTitle>COMPÉTENCES</SectionTitle>
              <View style={{ paddingLeft: px(15) }}>
                {skills.map((sk, i) => (
                  <View key={i} style={s.bulletRow}>
                    <Text style={s.bulletGlyph}>•</Text>
                    <Text style={[s.bulletText, s.skillItem]}>
                      <SkillText skill={sk} />
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {projects.length > 0 ? (
            <View style={s.section}>
              <SectionTitle>PROJETS</SectionTitle>
              {projects.map((p: ProjectItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === projects.length - 1}
                  title={p.title}
                  date={p.date}
                  subtitleParts={[]}
                >
                  {t(p.description) ? <Text style={{ marginTop: px(3) }}>{p.description}</Text> : null}
                </TimelineItem>
              ))}
            </View>
          ) : null}

          {certs.length > 0 ? (
            <View style={[s.section, { marginBottom: px(10) }]}>
              <SectionTitle>CERTIFICATIONS</SectionTitle>
              <View style={{ paddingLeft: px(15) }}>
                {certs.map((c, i) => (
                  <View key={i} style={s.bulletRow}>
                    <Text style={s.bulletGlyph}>•</Text>
                    <Text style={[s.bulletText, { color: defaultTheme.ink }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {volunteer.length > 0 ? (
            <View style={s.section}>
              <SectionTitle>BÉNÉVOLAT</SectionTitle>
              {volunteer.map((v: VolunteerItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === volunteer.length - 1}
                  title={v.title}
                  date={v.date}
                  subtitleParts={[
                    { text: v.organization, bold: true },
                    { text: v.location, muted: true },
                  ]}
                >
                  <Bullets items={v.bullets} />
                </TimelineItem>
              ))}
            </View>
          ) : null}

          {langs.length > 0 || interests.length > 0 ? (
            <View style={s.twoCols}>
              {langs.length > 0 ? (
                <View style={s.col}>
                  <SectionTitle>LANGUES</SectionTitle>
                  <View style={{ paddingLeft: px(15) }}>
                    {langs.map((l, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={s.bulletGlyph}>•</Text>
                        <Text style={[s.bulletText, s.colItem]}>
                          {l.name}
                          {t(l.level) ? <Text style={s.langLevel}> : {l.level}</Text> : null}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {langs.length > 0 && interests.length > 0 ? <View style={s.colSpacer} /> : null}
              {interests.length > 0 ? (
                <View style={s.col}>
                  <SectionTitle>{"CENTRES D'INTÉRÊT"}</SectionTitle>
                  <View style={{ paddingLeft: px(15) }}>
                    {interests.map((it, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={s.bulletGlyph}>•</Text>
                        <Text style={[s.bulletText, s.colItem]}>{it}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <GenericSections sections={extra} Title={GraphiqueTitle} wrapperStyle={s.section} />

          <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

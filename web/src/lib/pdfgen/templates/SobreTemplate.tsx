import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume, ExperienceItem, EducationItem, ProjectItem, VolunteerItem } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, PdfTheme, TimelineItem, Bullets, SkillText } from "./primitives";

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

export function SobreTemplate({
  resume,
  atsKeywords,
}: {
  resume: Resume;
  atsKeywords?: string[];
}) {
  const d = resume;

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

          {t(d.summary) ? (
            <View style={s.section}>
              <View style={s.flexRow}>
                <View style={s.leftCol}>
                  <Text style={s.sectionTitle}>À PROPOS</Text>
                </View>
                <View style={s.rightCol}>
                  <Text style={{ textAlign: "justify" }}>{d.summary}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {exp.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>EXPÉRIENCES</Text>
              {exp.map((e: ExperienceItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === exp.length - 1}
                  title={e.title}
                  date={e.date}
                  hideGutter={true}
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

          {edu.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>FORMATIONS</Text>
              {edu.map((e: EducationItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === edu.length - 1}
                  title={e.title}
                  date={e.date}
                  hideGutter={true}
                  subtitleParts={[
                    { text: e.school, bold: true },
                    { text: e.location, muted: true },
                  ]}
                />
              ))}
            </View>
          ) : null}

          {skills.length ? (
            <View style={s.section}>
              <View style={s.flexRow}>
                <View style={s.leftCol}>
                  <Text style={s.sectionTitle}>COMPÉTENCES</Text>
                </View>
                <View style={s.rightCol}>
                  <View style={s.skillsWrapper}>
                    {skills.map((sk, i) => (
                      <Text key={i} style={s.skillItem}>
                        <SkillText skill={sk} />
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {projects.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>PROJETS</Text>
              {projects.map((p: ProjectItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === projects.length - 1}
                  title={p.title}
                  date={p.date}
                  hideGutter={true}
                  subtitleParts={[]}
                >
                  {t(p.description) ? <Text style={{ marginTop: px(3) }}>{p.description}</Text> : null}
                </TimelineItem>
              ))}
            </View>
          ) : null}

          {certs.length ? (
            <View style={s.section}>
              <View style={s.flexRow}>
                <View style={s.leftCol}>
                  <Text style={s.sectionTitle}>CERTIFICATIONS</Text>
                </View>
                <View style={s.rightCol}>
                  <View style={s.skillsWrapper}>
                    {certs.map((c, i) => (
                      <Text key={i} style={s.skillItem}>{c}</Text>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {volunteer.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>BÉNÉVOLAT</Text>
              {volunteer.map((v: VolunteerItem, i) => (
                <TimelineItem
                  key={i}
                  last={i === volunteer.length - 1}
                  title={v.title}
                  date={v.date}
                  hideGutter={true}
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

          {langs.length ? (
            <View style={s.section}>
              <View style={s.flexRow}>
                <View style={s.leftCol}>
                  <Text style={s.sectionTitle}>LANGUES</Text>
                </View>
                <View style={s.rightCol}>
                  <View style={[s.flexRow, { flexWrap: "wrap" }]}>
                    {langs.map((l, i) => (
                      <View key={i} style={s.langItem}>
                        <Text style={s.langName}>{l.name}</Text>
                        {t(l.level) ? <Text style={s.langLevel}>({l.level})</Text> : null}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {interests.length ? (
            <View style={s.section}>
              <View style={s.flexRow}>
                <View style={s.leftCol}>
                  <Text style={s.sectionTitle}>CENTRES D&apos;INTÉRÊT</Text>
                </View>
                <View style={s.rightCol}>
                  <View style={s.skillsWrapper}>
                    {interests.map((it, i) => (
                      <Text key={i} style={s.skillItem}>{it}</Text>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

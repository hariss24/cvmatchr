import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume, ExperienceItem, EducationItem, ProjectItem, VolunteerItem } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, defaultTheme, TimelineItem, Bullets, SkillText, GenericSections } from "./primitives";
import { buildSections } from "@/lib/resume/sections";

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
    objectFit: "cover" 
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
    textAlign: "center" 
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
    color: defaultTheme.body 
  },

  // Sections
  section: { 
    marginBottom: px(12) 
  },
  summary: { 
    fontSize: 9.5, 
    textAlign: "justify" 
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

  // Bullets pour compétences, certifs...
  bulletRow: { flexDirection: "row", marginBottom: px(2) },
  bulletGlyph: { width: px(8) },
  bulletText: { flex: 1, color: defaultTheme.ink },
  
  // Langues & centres d'intérêt
  twoCols: { flexDirection: "row" },
  col: { width: "48%" },
  colSpacer: { width: "4%" },
  langLevel: { color: defaultTheme.body },
});

/** Sections que Kakuna met en page lui-même ; le reste passe par `GenericSections`. */
const KAKUNA_HANDLED = new Set([
  "summary", "experience", "education", "skills",
  "projects", "certifications", "volunteer", "languages", "interests",
]);

function KakunaTitle({ children }: { children: string }) {
  return <KakunaSectionTitle>{children.toUpperCase()}</KakunaSectionTitle>;
}

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
  atsKeywords,
}: {
  resume: Resume;
  atsKeywords?: string[];
}) {
  const d = resume;

  const exp = d.experience.filter((e) => e && (e.title || e.company || e.bullets.length));
  const edu = d.education.filter((e) => e && (e.title || e.school));
  const skills = d.skills.filter((x) => t(x));
  const projects = d.projects.filter((p) => p && (p.title || p.description));
  const certs = d.certifications.filter((x) => t(x));
  const volunteer = d.volunteer.filter((v) => v && (v.title || v.organization || v.bullets.length));
  const langs = d.languages.filter((l) => l && t(l.name));
  const interests = d.interests.filter((x) => t(x));
  const extra = buildSections(d).filter((sec) => !KAKUNA_HANDLED.has(sec.id));

  const contacts = [d.location, d.email, d.phone, d.linkedin].filter((c) => t(c));

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
                {contacts.map((contact, idx) => (
                  <Text key={idx} style={s.contactItem}>
                    {contact}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {t(d.summary) ? (
            <View style={s.section}>
              <Text style={s.summary}>{d.summary}</Text>
            </View>
          ) : null}

          {exp.length > 0 ? (
            <View style={s.section}>
              <KakunaSectionTitle>EXPÉRIENCES</KakunaSectionTitle>
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
              <KakunaSectionTitle>FORMATIONS</KakunaSectionTitle>
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
            <View style={s.section}>
              <KakunaSectionTitle>COMPÉTENCES</KakunaSectionTitle>
              <View style={{ paddingLeft: px(15) }}>
                {skills.map((sk, i) => (
                  <View key={i} style={s.bulletRow}>
                    <Text style={s.bulletGlyph}>•</Text>
                    <Text style={[s.bulletText, { color: defaultTheme.ink }]}>
                      <SkillText skill={sk} />
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {projects.length > 0 ? (
            <View style={s.section}>
              <KakunaSectionTitle>PROJETS</KakunaSectionTitle>
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
            <View style={s.section}>
              <KakunaSectionTitle>CERTIFICATIONS</KakunaSectionTitle>
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
              <KakunaSectionTitle>BÉNÉVOLAT</KakunaSectionTitle>
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
                  <KakunaSectionTitle>LANGUES</KakunaSectionTitle>
                  <View style={{ paddingLeft: px(15) }}>
                    {langs.map((l, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={s.bulletGlyph}>•</Text>
                        <Text style={s.bulletText}>
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
                  <KakunaSectionTitle>{"CENTRES D'INTÉRÊT"}</KakunaSectionTitle>
                  <View style={{ paddingLeft: px(15) }}>
                    {interests.map((it, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={s.bulletGlyph}>•</Text>
                        <Text style={s.bulletText}>{it}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <GenericSections sections={extra} Title={KakunaTitle} wrapperStyle={s.section} />

          <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

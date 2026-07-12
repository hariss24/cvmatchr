import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, Svg, Path, Circle } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume/schema";
import { AtsBoost } from "../AtsBoost";
import { px, t, ThemeContext, PdfTheme, SectionContent } from "./primitives";
import { buildSections, buildContacts, contactText, type ResumeSection } from "@/lib/resume/sections";

const theme: PdfTheme = {
  accent: "#26485a", // teal-navy des titres (nom du poste, titres de section)
  ink: "#1a1a1a",
  body: "#444",
};

const SIDEBAR_BG = "#14313f"; // navy profond de la barre latérale
const SIDEBAR_RULE = "#3c5766"; // ligne de séparation sous les titres de la sidebar
const MAIN_RULE = "#26485a"; // ligne de séparation sous les titres de la colonne principale
const SIDEBAR_INK = "#e8edf1"; // texte clair de la barre latérale

const SIDEBAR_WIDTH = "34%";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: theme.body,
    lineHeight: 1.3,
    flexDirection: "row",
  },

  // Sidebar
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: SIDEBAR_BG,
    color: "#fff",
    paddingVertical: px(32),
    paddingHorizontal: px(22),
  },
  photo: {
    width: px(120),
    height: px(120),
    borderRadius: px(60),
    objectFit: "cover",
    marginBottom: px(24),
    alignSelf: "center",
  },
  sideSection: {
    marginBottom: px(18),
  },
  sideTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    color: "#fff",
    paddingBottom: px(5),
    marginBottom: px(9),
    textTransform: "uppercase",
    borderBottomWidth: px(1),
    borderBottomColor: SIDEBAR_RULE,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: px(6),
  },
  contactIcon: {
    width: px(11),
    marginRight: px(6),
    marginTop: px(1),
  },
  contactText: {
    flex: 1,
    fontSize: 9,
    color: SIDEBAR_INK,
  },
  sideBulletRow: {
    flexDirection: "row",
    marginBottom: px(4),
  },
  sideBulletGlyph: {
    width: px(8),
    color: SIDEBAR_INK,
  },
  sideBulletText: {
    flex: 1,
    fontSize: 9,
    color: SIDEBAR_INK,
  },
  langRow: {
    marginBottom: px(6),
  },
  langName: {
    fontSize: 9,
    fontWeight: 700,
    color: "#fff",
  },
  langLevel: {
    fontSize: 8.5,
    color: "#c8d3da",
  },
  sideText: {
    fontSize: 9,
    color: SIDEBAR_INK,
    lineHeight: 1.4,
  },

  // Colonne principale
  main: {
    width: `${100 - parseFloat(SIDEBAR_WIDTH)}%`,
    paddingVertical: px(32),
    paddingHorizontal: px(30),
  },
  header: {
    marginBottom: px(20),
  },
  jobTitle: {
    fontSize: 21,
    fontWeight: 700,
    color: theme.accent,
    lineHeight: 1.15,
  },
  name: {
    fontSize: 12,
    color: theme.body,
    marginTop: px(2),
  },
  mainSection: {
    marginBottom: px(16),
  },
  mainSectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: theme.accent,
    letterSpacing: 1,
    paddingBottom: px(5),
    marginBottom: px(10),
    textTransform: "uppercase",
    borderBottomWidth: px(1),
    borderBottomColor: MAIN_RULE,
  },
});

function PinIcon() {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: "100%", height: px(11) }}>
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
        fill={SIDEBAR_INK}
      />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: "100%", height: px(11) }}>
      <Path
        d="M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5v-13zm2.2.5 7.3 5.4a.8.8 0 0 0 1 0l7.3-5.4H4.2zM20 7.4l-6.7 4.9a2.8 2.8 0 0 1-3.3 0L3.3 7.4V18h16.7V7.4z"
        fill={SIDEBAR_INK}
      />
    </Svg>
  );
}

function PhoneIcon() {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: "100%", height: px(11) }}>
      <Path
        d="M6.6 10.8c1.4 2.7 3.6 4.9 6.3 6.3l2.1-2.1c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1L6.6 10.8z"
        fill={SIDEBAR_INK}
      />
    </Svg>
  );
}

function LinkIcon() {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: "100%", height: px(11) }}>
      <Circle cx="12" cy="12" r="9" stroke={SIDEBAR_INK} strokeWidth={1.6} fill="none" />
      <Path
        d="M9.5 8.5a3.2 3.2 0 0 1 4.5 0l.5.5a3.2 3.2 0 0 1 0 4.5l-1.5 1.5M14.5 15.5a3.2 3.2 0 0 1-4.5 0l-.5-.5a3.2 3.2 0 0 1 0-4.5l1.5-1.5"
        stroke={SIDEBAR_INK}
        strokeWidth={1.4}
        fill="none"
      />
    </Svg>
  );
}

/** Puce neutre : icône des coordonnées libres (permis, portfolio, mobilité…), qui n'en ont pas. */
function DotIcon() {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: "100%", height: px(11) }}>
      <Circle cx="12" cy="12" r="4" fill={SIDEBAR_INK} />
    </Svg>
  );
}

const CONTACT_ICONS: Record<string, React.ComponentType> = {
  location: PinIcon,
  email: MailIcon,
  phone: PhoneIcon,
  linkedin: LinkIcon,
};

function SideList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={s.sideBulletRow}>
          <Text style={s.sideBulletGlyph}>•</Text>
          <Text style={s.sideBulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

/** Sections que Marine place dans sa barre latérale. Tout le reste va en colonne principale. */
const MARINE_SIDEBAR = new Set(["softSkills", "tools", "languages", "interests"]);

/** Marine nomme l'accroche « Profil » ; les autres sections gardent le titre porté par le CV. */
const MARINE_TITLES: Record<string, string> = { summary: "Profil" };

/** Corps d'une section de la barre latérale : texte clair sur fond navy, piloté par le type. */
function MarineSide({ section }: { section: ResumeSection }) {
  if (section.kind === "languages") {
    return (
      <>
        {section.items.map((l, i) => (
          <View key={i} style={s.langRow}>
            <Text style={s.langName}>
              {l.name}
              {t(l.level) ? <Text style={s.langLevel}> — {l.level}</Text> : null}
            </Text>
          </View>
        ))}
      </>
    );
  }
  if (section.kind === "text") {
    return <Text style={s.sideText}>{section.text}</Text>;
  }
  if (section.kind === "list") {
    // Les centres d'intérêt tiennent sur une ligne : Marine les met bout à bout plutôt
    // qu'en puces, pour économiser la hauteur de la barre latérale.
    return section.id === "interests" ? (
      <Text style={s.sideText}>{section.items.join(", ")}</Text>
    ) : (
      <SideList items={section.items} />
    );
  }
  return <SectionContent section={section} hideGutter color={SIDEBAR_INK} />;
}

export function MarineTemplate({
  resume,
  atsKeywords,
}: {
  resume: Resume;
  atsKeywords?: string[];
}) {
  const d = resume;

  const contacts = buildContacts(d);

  // Le modèle rend les sections DU CV, dans l'ordre du CV. Il ne décide que de la zone
  // (barre latérale ou colonne principale) et du style. Compétences, projets,
  // certifications, bénévolat et sections libres — jadis avalés — remontent d'eux-mêmes.
  const sections = buildSections(d);
  const sideSections = sections.filter((sec) => MARINE_SIDEBAR.has(sec.id));
  const mainSections = sections.filter((sec) => !MARINE_SIDEBAR.has(sec.id));

  return (
    <ThemeContext.Provider value={theme}>
      <Document>
        <Page size="A4" style={s.page}>
          <View style={s.sidebar}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {d.photo ? <Image style={s.photo} src={d.photo} /> : null}

            {contacts.length > 0 ? (
              <View style={s.sideSection}>
                <Text style={s.sideTitle}>Contact</Text>
                {contacts.map((c) => {
                  const Icon = CONTACT_ICONS[c.id] ?? DotIcon;
                  return (
                    <View key={c.id} style={s.contactRow}>
                      <View style={s.contactIcon}>
                        <Icon />
                      </View>
                      <Text style={s.contactText}>{contactText(c)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {sideSections.map((sec) => (
              <View key={sec.id} style={s.sideSection}>
                <Text style={s.sideTitle}>{sec.title}</Text>
                <MarineSide section={sec} />
              </View>
            ))}
          </View>

          <View style={s.main}>
            <View style={s.header}>
              {t(d.title) ? <Text style={s.jobTitle}>{d.title}</Text> : null}
              {t(d.name) ? <Text style={s.name}>{d.name}</Text> : null}
            </View>

            {mainSections.map((sec) => (
              <View key={sec.id} style={s.mainSection}>
                <Text style={s.mainSectionTitle}>{MARINE_TITLES[sec.id] ?? sec.title}</Text>
                <SectionContent section={sec} hideGutter subtitle="caps" />
              </View>
            ))}
          </View>

          <AtsBoost keywords={atsKeywords} />
        </Page>
      </Document>
    </ThemeContext.Provider>
  );
}

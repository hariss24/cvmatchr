import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Resume, ExperienceItem, EducationItem, ProjectItem, VolunteerItem } from "@/lib/resume/schema";
import { registerPdfFonts } from "./fonts";
import { AtsBoost } from "./AtsBoost";

/**
 * CV en React PDF — port visuel du template « Graphique » (templates.ts l.292-346).
 * Le JSON `Resume` est dessiné directement en PDF : plus de HTML intermédiaire.
 *
 * Écarts assumés vs le CSS d'origine (décisions du cadrage) :
 * - Police : Roboto (Segoe UI n'est pas redistribuable) ;
 * - la timeline (barre + pastille) est construite en colonnes flex, pas en `border-left`
 *   + `position:absolute` (plus robuste avec le moteur de layout de react-pdf).
 *
 * Filtrage des sections vides : mêmes conditions que `render.ts` (le rendu HTML).
 */

export type PdfTemplateId = "graphique";

const ACCENT = "#0078d4";
const INK = "#111";
const BODY = "#555";

/**
 * Le CSS d'origine mesure la géométrie en px CSS et les polices en pt.
 * react-pdf mesure tout en pt : 1 px = 0,75 pt. `px(n)` garde les nombres
 * du CSS lisibles tels quels (px(75) = photo 75px) sans erreur d'échelle.
 */
const px = (n: number): number => n * 0.75;

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9.5,
    color: BODY,
    lineHeight: 1.25,
    paddingTop: px(16),
    paddingBottom: px(12),
    paddingHorizontal: px(36),
  },

  // En-tête
  header: { flexDirection: "row", alignItems: "center", marginBottom: px(10) },
  photo: { width: px(75), height: px(75), borderRadius: px(4), marginRight: px(16), objectFit: "cover" },
  headerTitles: { flex: 1 },
  name: { fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.2 },
  jobTitle: { fontSize: 12, fontWeight: 700, color: ACCENT, marginTop: px(2) },
  contact: {
    width: px(250),
    marginLeft: px(20),
    textAlign: "right",
    fontSize: 9.5,
    color: "#444",
    lineHeight: 1.5,
  },

  // Sections : trait bleu séparateur au-dessus de chaque section (règle du template
  // de base), sauf en-tête et bloc langues/intérêts (override graphique).
  section: { borderTopWidth: px(2), borderTopColor: ACCENT, paddingTop: px(5) },
  sectionTitle: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: 700,
    marginTop: px(10),
    marginBottom: px(10),
  },
  summarySection: { marginBottom: px(6) },
  summary: { fontSize: 10, textAlign: "justify", marginBottom: px(10) },

  // Timeline (expériences, formations, projets, bénévolat)
  tlItem: { flexDirection: "row", marginLeft: px(10) },
  tlGutter: { width: px(20) },
  tlDot: { width: px(10), height: px(10), borderRadius: px(5), backgroundColor: BODY },
  tlLine: { width: px(2), flexGrow: 1, backgroundColor: BODY, marginLeft: px(4) },
  tlBody: { flex: 1, paddingBottom: px(12) },
  tlHead: { flexDirection: "row", justifyContent: "space-between" },
  tlTitle: { fontSize: 10, fontWeight: 700, color: INK, flex: 1, paddingRight: px(8) },
  tlDate: { fontSize: 10, color: "#888" },
  tlSubtitleRow: { marginTop: px(1) },
  tlSubtitle: { fontSize: 9, fontWeight: 700, color: INK },
  tlDesc: { marginTop: px(3) },

  // Listes à puces
  bullets: { paddingLeft: px(15) },
  bulletRow: { flexDirection: "row", marginBottom: px(1) },
  bulletGlyph: { width: px(8) },
  bulletText: { flex: 1 },

  // Compétences (section bordée haut/bas)
  skillsSection: {
    borderTopWidth: px(2),
    borderTopColor: ACCENT,
    borderBottomWidth: px(2),
    borderBottomColor: ACCENT,
    paddingTop: px(5),
    paddingBottom: px(8),
    marginBottom: px(10),
  },
  skillItem: { color: INK, marginBottom: px(4) },

  // Langues & centres d'intérêt côte à côte
  twoCols: { flexDirection: "row" },
  col: { width: "48%" },
  colSpacer: { width: "4%" },
  colItem: { color: INK, marginBottom: px(4) },
  langLevel: { color: BODY },
});

const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

/** `Titre` + `date` à droite, puis ligne « sous-titre — … » (morceaux vides filtrés). */
function TimelineItem({
  last,
  title,
  date,
  subtitleParts,
  children,
}: {
  last: boolean;
  title: string;
  date: string;
  subtitleParts: { text: string; bold?: boolean; muted?: boolean }[];
  children?: React.ReactNode;
}) {
  const parts = subtitleParts.filter((p) => t(p.text));
  return (
    <View style={s.tlItem} wrap={false}>
      <View style={s.tlGutter}>
        <View style={s.tlDot} />
        {!last ? <View style={s.tlLine} /> : null}
      </View>
      <View style={s.tlBody}>
        <View style={s.tlHead}>
          <Text style={s.tlTitle}>{title}</Text>
          {t(date) ? <Text style={s.tlDate}>{date}</Text> : null}
        </View>
        {parts.length ? (
          <Text style={s.tlSubtitleRow}>
            {parts.map((p, i) => (
              <Text key={i} style={p.bold ? s.tlSubtitle : p.muted ? { color: "#787673" } : {}}>
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

function Bullets({ items }: { items: string[] }) {
  const kept = items.filter((b) => t(b));
  if (!kept.length) return null;
  return (
    <View style={[s.tlDesc, s.bullets]}>
      {kept.map((b, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletGlyph}>•</Text>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

/** Compétence « Mot clé — Description » : partie gauche en gras (même split que render.ts). */
function SkillText({ skill }: { skill: string }) {
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

export function ResumeDocument({
  resume,
  templateId,
  atsKeywords,
}: {
  resume: Resume;
  templateId: PdfTemplateId;
  atsKeywords?: string[];
}) {
  registerPdfFonts();
  void templateId; // un seul template porté pour l'instant (« graphique ») — Phase 4 élargira l'union.
  const d = resume;

  // Espaces insécables dans chaque élément : la ligne ne casse qu'aux séparateurs « · »
  // (sinon react-pdf coupe le téléphone en plein milieu).
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
    <Document>
      <Page size="A4" style={s.page}>
        {/* En-tête : photo, nom + poste, contact à droite */}
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (dessin PDF), pas un <img> DOM */}
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

        {exp.length ? (
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

        {edu.length ? (
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

        {skills.length ? (
          <View style={s.skillsSection}>
            <SectionTitle>COMPÉTENCES</SectionTitle>
            <View style={s.bullets}>
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

        {projects.length ? (
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
                {t(p.description) ? <Text style={s.tlDesc}>{p.description}</Text> : null}
              </TimelineItem>
            ))}
          </View>
        ) : null}

        {certs.length ? (
          <View style={[s.section, { marginBottom: px(10) }]}>
            <SectionTitle>CERTIFICATIONS</SectionTitle>
            <View style={s.bullets}>
              {certs.map((c, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={s.bulletGlyph}>•</Text>
                  <Text style={[s.bulletText, { color: INK }]}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {volunteer.length ? (
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

        {langs.length || interests.length ? (
          <View style={s.twoCols}>
            {langs.length ? (
              <View style={s.col}>
                <SectionTitle>LANGUES</SectionTitle>
                <View style={s.bullets}>
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
            {langs.length && interests.length ? <View style={s.colSpacer} /> : null}
            {interests.length ? (
              <View style={s.col}>
                <SectionTitle>{"CENTRES D'INTÉRÊT"}</SectionTitle>
                <View style={s.bullets}>
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

        <AtsBoost keywords={atsKeywords} />
      </Page>
    </Document>
  );
}

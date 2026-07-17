import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Letter } from "@/lib/resume/schema";
import { registerPdfFonts } from "./fonts";


/**
 * Lettre de motivation en React PDF — port visuel de `renderLetter` (render.ts l.252-295) :
 * Inter, interligne aéré, destinataire à gauche / expéditeur à droite, objet en gras,
 * corps en paragraphes (lignes vides filtrées), signature en bas à droite.
 * Écart assumé : « Objet : » n'apparaît plus quand le sujet est vide.
 */

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10.5,
    color: "#222",
    lineHeight: 1.7,
    paddingVertical: 42,
    paddingHorizontal: 48,
  },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 36 },
  headerLeft: { flex: 1, paddingRight: 15 },
  headerRight: { flex: 1, paddingLeft: 15, textAlign: "right" },
  bold: { fontWeight: 700 },
  date: { marginTop: 12, color: "#555" },
  subject: { fontWeight: 700, marginBottom: 24 },
  paragraph: { marginBottom: 10 },
  signature: {
    fontWeight: 700,
    textAlign: "right",
    paddingRight: 30,
    marginTop: 24,
  },
});

const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

/** Découpe un texte multi-lignes en paragraphes (lignes vides filtrées — même logique que renderLetter). */
function Paragraphs({ text }: { text: string }) {
  const parts = text.split("\n").filter((p) => p.trim() !== "");
  return (
    <>
      {parts.map((p, i) => (
        <Text key={i} style={s.paragraph}>
          {p}
        </Text>
      ))}
    </>
  );
}

export function LetterDocument({
  letter,

}: {
  letter: Letter;

}) {
  registerPdfFonts();
  const d = letter;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {t(d.recipient_name) ? <Text style={s.bold}>{d.recipient_name}</Text> : null}
            {t(d.recipient_service) ? <Text>{d.recipient_service}</Text> : null}
            {t(d.recipient_address) ? <Text>{d.recipient_address}</Text> : null}
          </View>
          <View style={s.headerRight}>
            {t(d.sender_name) ? <Text style={s.bold}>{d.sender_name}</Text> : null}
            {t(d.sender_address) ? <Text>{d.sender_address}</Text> : null}
            {t(d.sender_contact) ? <Text>{d.sender_contact}</Text> : null}
            {t(d.date) ? <Text style={s.date}>{d.date}</Text> : null}
          </View>
        </View>

        {t(d.subject) ? <Text style={s.subject}>Objet : {d.subject}</Text> : null}

        {t(d.greeting) ? <Text style={s.paragraph}>{d.greeting}</Text> : null}

        <Paragraphs text={d.body} />
        <Paragraphs text={d.signoff} />

        {t(d.signature) ? <Text style={s.signature}>{d.signature}</Text> : null}


      </Page>
    </Document>
  );
}

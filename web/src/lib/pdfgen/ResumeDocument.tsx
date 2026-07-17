import type { Resume } from "@/lib/resume/schema";
import { registerPdfFonts } from "./fonts";
import { GraphiqueTemplate } from "./templates/GraphiqueTemplate";
import { SobreTemplate } from "./templates/SobreTemplate";
import { KakunaTemplate } from "./templates/KakunaTemplate";
import { MarineTemplate } from "./templates/MarineTemplate";

export type PdfTemplateId = "graphique" | "sobre" | "moderne" | "classique" | "minimal" | "kakuna" | "marine";

export function ResumeDocument({
  resume,
  templateId,

}: {
  resume: Resume;
  templateId: PdfTemplateId;

}) {
  registerPdfFonts();

  switch (templateId) {
    case "sobre":
      return <SobreTemplate resume={resume} />;
    case "kakuna":
      return <KakunaTemplate resume={resume} />;
    case "marine":
      return <MarineTemplate resume={resume} />;
    case "graphique":
    default:
      return <GraphiqueTemplate resume={resume} />;
  }
}

import type { Resume } from "@/lib/resume/schema";
import { registerPdfFonts } from "./fonts";
import { GraphiqueTemplate } from "./templates/GraphiqueTemplate";
import { SobreTemplate } from "./templates/SobreTemplate";

export type PdfTemplateId = "graphique" | "sobre" | "moderne" | "classique" | "minimal";

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

  switch (templateId) {
    case "sobre":
      return <SobreTemplate resume={resume} atsKeywords={atsKeywords} />;
    case "graphique":
    default:
      return <GraphiqueTemplate resume={resume} atsKeywords={atsKeywords} />;
  }
}
